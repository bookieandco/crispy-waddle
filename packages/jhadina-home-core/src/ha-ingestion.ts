/**
 * B&W-6.2 — Home Assistant State/Event Ingestion Pipeline
 *
 * Pipeline: HA event → validate → idempotency → ordering → normalize → publish
 *
 * Architecture:
 * - Uses the existing Jhadina EventBus (EventBus interface from @jhadina/event-bus).
 * - Does NOT create a HomeEventBus, HomePolicyEngine, or HomeCapabilityRegistry.
 * - Does NOT grant capability authorization — state ingestion is knowledge-only.
 * - Does NOT mutate canonical state before validation.
 * - Rejected events produce no downstream domain events.
 * - Every accepted state transition produces exactly one DomainEvent on the bus.
 */

import { DeterministicHomeAssistantAdapter } from './ha-adapter.js';
import type { RawHomeAssistantEvent, HaEventEnvelope } from './ha-event-envelope.js';
import { validateHaEvent } from './ha-event-envelope.js';
import type { IdempotencyStore } from './ha-idempotency.js';
import type { EntityStateStore, HomeEntityState } from './ha-state-machine.js';
import { determineOrdering } from './ha-state-machine.js';
import type { HomeAssistantAvailability, HomeAssistantEntityDomain } from './ha-entity.js';

// ---------------------------------------------------------------------------
// EventBus port (matches the existing @jhadina/event-bus DomainEvent contract)
// ---------------------------------------------------------------------------

export interface DomainEvent<TPayload = unknown> {
  readonly id: string;
  readonly type: string;
  readonly version: number;
  readonly occurredAt: string;
  readonly payload: TPayload;
  readonly aggregate?: { type: string; id: string };
  readonly actor?: string;
  readonly causationId?: string;
  readonly correlationId?: string;
  readonly provenance?: string;
}

export interface EventBusPort {
  publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;
}

// ---------------------------------------------------------------------------
// Domain event payload
// ---------------------------------------------------------------------------

/**
 * Payload for a ha.entity.state_changed domain event.
 *
 * Contains the full HomeEntityState snapshot PLUS the stale old state for
 * consumers that need to compute transitions (e.g. capability evaluation
 * reacting to unavailable → available).
 */
export interface HaEntityStatePayload {
  readonly current: HomeEntityState;
  readonly previous: HomeEntityState | null;
}

export const HA_STATE_CHANGED_EVENT_TYPE = 'ha.entity.state_changed';
export const HA_STATE_CHANGED_EVENT_VERSION = 1;

// ---------------------------------------------------------------------------
// Pipeline result
// ---------------------------------------------------------------------------

export type IngestionResult =
  | { outcome: 'accepted'; entityId: `ha:entity:${string}`; eventId: string }
  | { outcome: 'duplicate'; eventId: string; reason: string }
  | { outcome: 'stale'; eventId: string; entityId: `ha:entity:${string}`; reason: string }
  | { outcome: 'rejected'; reason: string };

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export interface HomeAssistantIngestionPipelineOptions {
  /** Injected adapter for testability; defaults to DeterministicHomeAssistantAdapter(). */
  adapter?: DeterministicHomeAssistantAdapter;
  /** Injected clock for deterministic test control. */
  clock?: () => string;
}

/**
 * HomeAssistantIngestionPipeline — B&W-6.2
 *
 * Dependencies are injected so the composition root controls durability:
 * - idempotencyStore: swap InMemoryIdempotencyStore for a durable Supabase store
 * - stateStore: swap InMemoryEntityStateStore for a durable entity-state table
 * - eventBus: the existing Jhadina InMemoryEventBus or a durable outbox bus
 * - options.adapter: injected for testability; defaults to DeterministicHomeAssistantAdapter
 * - options.clock: injected for deterministic test control
 */
export class HomeAssistantIngestionPipeline {
  private readonly adapter: DeterministicHomeAssistantAdapter;
  private readonly clock: () => string;

  constructor(
    private readonly idempotency: IdempotencyStore,
    private readonly stateStore: EntityStateStore,
    private readonly eventBus: EventBusPort,
    options: HomeAssistantIngestionPipelineOptions = {},
  ) {
    this.adapter = options.adapter ?? new DeterministicHomeAssistantAdapter();
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  /**
   * Ingest a raw HA event.
   *
   * Pipeline stages:
   * 1. Validate — reject malformed events; produce no side effects on failure.
   * 2. Idempotency — return 'duplicate' without mutating state.
   * 3. Normalize — call B&W-6.1 DeterministicHomeAssistantAdapter.
   *    Normalization failure → reject.
   * 4. Ordering — determine if the incoming event is newer/stale/tied.
   *    Stale → return 'stale' without mutating state.
   * 5. Commit state — update the entity state store.
   * 6. Publish — emit exactly one DomainEvent on the EventBus.
   * 7. Mark seen — record the eventId in the idempotency store.
   */
  async ingest(raw: RawHomeAssistantEvent): Promise<IngestionResult> {
    // Stage 1: Validate
    const validation = validateHaEvent(raw);
    if (!validation.ok) {
      return { outcome: 'rejected', reason: validation.reason };
    }
    const envelope = validation.envelope;

    // Stage 2: Idempotency check
    if (this.idempotency.hasSeen(envelope.eventId)) {
      return { outcome: 'duplicate', eventId: envelope.eventId, reason: 'already processed' };
    }

    // Stage 3: Normalize
    const rawState = envelope.newState ?? envelope.oldState;
    if (!rawState) {
      return { outcome: 'rejected', reason: 'Both new_state and old_state are null' };
    }

    const normResult = this.adapter.normalizeEntity(
      {
        entity_id: envelope.sourceEntityId,
        state: typeof rawState['state'] === 'string' ? rawState['state'] : 'unknown',
        attributes: typeof rawState['attributes'] === 'object' && rawState['attributes'] !== null
          ? rawState['attributes'] as Record<string, unknown>
          : {},
        last_changed: typeof rawState['last_changed'] === 'string' ? rawState['last_changed'] : undefined,
        last_updated: typeof rawState['last_updated'] === 'string' ? rawState['last_updated'] : undefined,
      },
      envelope.eventOccurredAt,
    );

    if (!normResult.ok) {
      return { outcome: 'rejected', reason: normResult.reason };
    }

    // Stage 4: Ordering
    const current = this.stateStore.get(normResult.entity.entityId);
    const ordering = determineOrdering(current, envelope);

    if (ordering === 'reject-stale') {
      return {
        outcome: 'stale',
        eventId: envelope.eventId,
        entityId: normResult.entity.entityId,
        reason: `Stale event: incoming ${envelope.eventOccurredAt} ≤ current ${current!.stateAt}`,
      };
    }

    // Stage 5: Build new canonical state
    const updatedAt = this.clock();
    const newState: HomeEntityState = Object.freeze({
      entityId: normResult.entity.entityId,
      domain: normResult.entity.domain as HomeAssistantEntityDomain,
      friendlyName: normResult.entity.friendlyName,
      availability: normResult.entity.availability as HomeAssistantAvailability,
      attributes: normResult.entity.attributes,
      provider: 'home-assistant',
      sourceEntityId: envelope.sourceEntityId,
      sourceEventId: envelope.eventId,
      stateAt: envelope.eventOccurredAt,
      timestampMissing: envelope.timestampMissing,
      updatedAt,
      correlationId: envelope.correlationId,
      causationId: envelope.causationId,
    });

    // Stage 5b: Commit state
    this.stateStore.set(newState);

    // Stage 6: Publish exactly one DomainEvent
    const domainEvent: DomainEvent<HaEntityStatePayload> = {
      id: envelope.eventId,
      type: HA_STATE_CHANGED_EVENT_TYPE,
      version: HA_STATE_CHANGED_EVENT_VERSION,
      occurredAt: envelope.eventOccurredAt,
      payload: { current: newState, previous: current ?? null },
      aggregate: { type: 'ha:entity', id: normResult.entity.entityId },
      provenance: 'home-assistant',
      correlationId: envelope.correlationId,
      causationId: envelope.causationId,
    };
    await this.eventBus.publish(domainEvent);

    // Stage 7: Mark seen — after successful publish so a bus failure allows retry
    this.idempotency.markSeen(envelope.eventId, envelope.sourceEntityId);

    return {
      outcome: 'accepted',
      entityId: normResult.entity.entityId,
      eventId: envelope.eventId,
    };
  }
}
