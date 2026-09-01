/**
 * B&W-6.2 — Canonical Home Entity State Snapshot and Ordering
 */

import type { HomeAssistantAvailability, HomeAssistantEntityDomain } from './ha-entity.js';
import type { HaEventEnvelope } from './ha-event-envelope.js';
import type { MaybePromise } from './ha-idempotency.js';

export type OrderingDecision = 'accept' | 'reject-stale' | 'accept-tie';

export interface HomeEntityState {
  readonly entityId: `ha:entity:${string}`;
  readonly domain: HomeAssistantEntityDomain;
  readonly friendlyName: string;
  readonly availability: HomeAssistantAvailability;
  readonly attributes: Readonly<Record<string, string | number | boolean | null>>;
  readonly provider: 'home-assistant';
  readonly sourceEntityId: string;
  readonly sourceEventId: string;
  readonly stateAt: string;
  readonly timestampMissing: boolean;
  readonly updatedAt: string;
  readonly correlationId?: string;
  readonly causationId?: string;
}

export function determineOrdering(
  current: HomeEntityState | undefined,
  incoming: HaEventEnvelope,
): OrderingDecision {
  if (!current) return 'accept';
  const incomingTs = new Date(incoming.eventOccurredAt).getTime();
  const currentTs = new Date(current.stateAt).getTime();
  if (isNaN(incomingTs) || isNaN(currentTs)) return 'accept-tie';
  if (incomingTs > currentTs) return 'accept';
  if (incomingTs < currentTs) return 'reject-stale';
  return 'accept-tie';
}

/**
 * Durable implementations use compare-and-swap semantics on stateAt.
 * `set` returns false when another writer has already committed a newer
 * state. In-memory implementations remain synchronous for existing tests.
 */
export interface EntityStateStore {
  get(entityId: string): MaybePromise<HomeEntityState | undefined>;
  set(state: HomeEntityState, expectedStateAt?: string): MaybePromise<boolean | void>;
  list(): MaybePromise<readonly HomeEntityState[]>;
}

/** @testOnly / local-development only. */
export class InMemoryEntityStateStore implements EntityStateStore {
  private readonly states = new Map<string, HomeEntityState>();

  get(entityId: string): HomeEntityState | undefined {
    return this.states.get(entityId);
  }

  set(state: HomeEntityState, expectedStateAt?: string): boolean {
    const current = this.states.get(state.entityId);
    if (expectedStateAt !== undefined && current?.stateAt !== expectedStateAt) return false;
    if (current && expectedStateAt === undefined) {
      const incomingTs = new Date(state.stateAt).getTime();
      const currentTs = new Date(current.stateAt).getTime();
      if (Number.isFinite(incomingTs) && Number.isFinite(currentTs) && incomingTs < currentTs) return false;
    }
    this.states.set(state.entityId, state);
    return true;
  }

  list(): readonly HomeEntityState[] {
    return [...this.states.values()];
  }

  clear(): void {
    this.states.clear();
  }
}
