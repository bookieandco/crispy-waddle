/**
 * B&W-6.2 — Home Assistant State/Event Ingestion Pipeline
 *
 * Pipeline: HA event → validate → idempotency claim → normalize → order →
 * durable state CAS → publish → complete idempotency.
 *
 * Durable stores are injected; no Home-specific policy, capability registry,
 * or event bus is created here.
 */

import { DeterministicHomeAssistantAdapter } from './ha-adapter.js';
import type { RawHomeAssistantEvent } from './ha-event-envelope.js';
import { validateHaEvent } from './ha-event-envelope.js';
import type { IdempotencyStore } from './ha-idempotency.js';
import type { EntityStateStore, HomeEntityState } from './ha-state-machine.js';
import { determineOrdering } from './ha-state-machine.js';
import type { HomeAssistantAvailability, HomeAssistantEntityDomain } from './ha-entity.js';

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

export interface HaEntityStatePayload {
  readonly current: HomeEntityState;
  readonly previous: HomeEntityState | null;
}

export const HA_STATE_CHANGED_EVENT_TYPE = 'ha.entity.state_changed';
export const HA_STATE_CHANGED_EVENT_VERSION = 1;

export type IngestionResult =
  | { outcome: 'accepted'; entityId: `ha:entity:${string}`; eventId: string }
  | { outcome: 'duplicate'; eventId: string; reason: string }
  | { outcome: 'stale'; eventId: string; entityId: `ha:entity:${string}`; reason: string }
  | { outcome: 'rejected'; reason: string };

export interface HomeAssistantIngestionPipelineOptions {
  adapter?: DeterministicHomeAssistantAdapter;
  clock?: () => string;
}

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

  async ingest(raw: RawHomeAssistantEvent): Promise<IngestionResult> {
    const validation = validateHaEvent(raw);
    if (!validation.ok) return { outcome: 'rejected', reason: validation.reason };
    const envelope = validation.envelope;

    // Durable implementations use an atomic database claim. The legacy
    // hasSeen fallback remains for compatibility with older test doubles.
    let claimed = false;
    if (this.idempotency.claim) {
      claimed = await this.idempotency.claim(envelope.eventId, envelope.sourceEntityId);
      if (!claimed) {
        return { outcome: 'duplicate', eventId: envelope.eventId, reason: 'already processed or in flight' };
      }
    } else if (await this.idempotency.hasSeen(envelope.eventId)) {
      return { outcome: 'duplicate', eventId: envelope.eventId, reason: 'already processed' };
    }

    const releaseClaim = async () => {
      if (claimed && this.idempotency.release) await this.idempotency.release(envelope.eventId);
    };

    const rawState = envelope.newState ?? envelope.oldState;
    if (!rawState) {
      await releaseClaim();
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
      await releaseClaim();
      return { outcome: 'rejected', reason: normResult.reason };
    }

    const current = await this.stateStore.get(normResult.entity.entityId);
    const ordering = determineOrdering(current, envelope);
    if (ordering === 'reject-stale') {
      await releaseClaim();
      return {
        outcome: 'stale',
        eventId: envelope.eventId,
        entityId: normResult.entity.entityId,
        reason: `Stale event: incoming ${envelope.eventOccurredAt} ≤ current ${current!.stateAt}`,
      };
    }

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
      updatedAt: this.clock(),
      correlationId: envelope.correlationId,
      causationId: envelope.causationId,
    });

    // Durable implementations perform compare-and-swap on the previously
    // observed stateAt. This prevents a stale concurrent writer from
    // overwriting a newer canonical snapshot.
    const committed = await this.stateStore.set(newState, current?.stateAt);
    if (committed === false) {
      const latest = await this.stateStore.get(newState.entityId);
      await releaseClaim();
      return {
        outcome: 'stale',
        eventId: envelope.eventId,
        entityId: newState.entityId,
        reason: latest
          ? `Concurrent state update won: current ${latest.stateAt}`
          : 'Concurrent state update prevented commit',
      };
    }

    const domainEvent: DomainEvent<HaEntityStatePayload> = {
      id: envelope.eventId,
      type: HA_STATE_CHANGED_EVENT_TYPE,
      version: HA_STATE_CHANGED_EVENT_VERSION,
      occurredAt: envelope.eventOccurredAt,
      payload: { current: newState, previous: current ?? null },
      aggregate: { type: 'ha:entity', id: newState.entityId },
      provenance: 'home-assistant',
      correlationId: envelope.correlationId,
      causationId: envelope.causationId,
    };

    try {
      await this.eventBus.publish(domainEvent);
    } catch (error) {
      // State is already committed. Release the idempotency claim so an
      // external retry can attempt publication again. Production should use
      // a transactional outbox to make state + publication atomic.
      await releaseClaim();
      throw error;
    }

    await this.idempotency.markSeen(envelope.eventId, envelope.sourceEntityId);

    return {
      outcome: 'accepted',
      entityId: newState.entityId,
      eventId: envelope.eventId,
    };
  }
}
