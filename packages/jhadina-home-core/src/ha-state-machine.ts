/**
 * B&W-6.2 — Canonical Home Entity State Snapshot and Ordering
 *
 * Defines the canonical state representation for a Home Assistant entity
 * and the deterministic ordering logic that prevents stale events from
 * overwriting newer canonical state.
 *
 * Architecture contract:
 * - HomeEntityState is the authoritative current-state record.
 * - No authorization fields (granted, allowed, authorized) appear here.
 *   Entity state ≠ capability authorization.
 * - Ordering is timestamp-based with deterministic tie-breaking.
 * - Stale events preserve provenance but do not mutate canonical state.
 */

import type { HomeAssistantAvailability, HomeAssistantEntityDomain } from './ha-entity.js';
import type { HaEventEnvelope } from './ha-event-envelope.js';

/**
 * Ordering outcome for two competing events on the same entity.
 */
export type OrderingDecision =
  | 'accept'        // incoming event is newer — accept it
  | 'reject-stale'  // incoming event is older — discard it (but preserve provenance)
  | 'accept-tie';   // equal timestamps — deterministic tie-breaking applied (accept)

/**
 * Canonical Home entity state snapshot.
 *
 * Suitable for:
 * - current-state queries
 * - event consumers
 * - capability evaluation (state informs which capabilities are meaningful)
 * - future automation (triggers, conditions)
 * - audit/evidence
 *
 * DOES NOT contain:
 * - authorization fields (granted, allowed, authorized)
 * - transport configuration (baseUrl, accessToken)
 * - raw HA internal attributes (only the allowlisted safe subset)
 */
export interface HomeEntityState {
  /** Jhadina canonical entity identifier — ha:entity:<entity_id> */
  readonly entityId: `ha:entity:${string}`;
  /** HA entity domain */
  readonly domain: HomeAssistantEntityDomain;
  /** Human-readable name */
  readonly friendlyName: string;
  /** Current availability */
  readonly availability: HomeAssistantAvailability;
  /**
   * Allowlisted normalized state attributes.
   * Same allowlist as CanonicalHomeAssistantEntity — no transport secrets.
   */
  readonly attributes: Readonly<Record<string, string | number | boolean | null>>;

  // --- Provenance ---
  /** Always 'home-assistant' */
  readonly provider: 'home-assistant';
  /** Raw HA entity_id — preserved for provenance */
  readonly sourceEntityId: string;
  /** Deterministic event ID that produced this state */
  readonly sourceEventId: string;

  // --- Ordering / timestamps ---
  /** ISO 8601 timestamp of the HA event that produced this state */
  readonly stateAt: string;
  /** True when the stateAt timestamp was derived from receivedAt (timeFired was absent) */
  readonly timestampMissing: boolean;
  /** ISO 8601 timestamp when this state was written */
  readonly updatedAt: string;

  // --- Correlation ---
  readonly correlationId?: string;
  readonly causationId?: string;
}

/**
 * Determine whether an incoming event should replace the current canonical state.
 *
 * Ordering rules (deterministic):
 * 1. No current state → always accept.
 * 2. Incoming event timestamp > current stateAt → accept (newer wins).
 * 3. Incoming event timestamp < current stateAt → reject-stale.
 * 4. Equal timestamps → accept-tie (last-write-wins by arrival order;
 *    documented tie-break: the caller is responsible for serialization).
 * 5. Missing incoming timestamp (timestampMissing) → treat as equal to
 *    current stateAt → accept-tie (conservative: do not discard, do not
 *    silently overwrite verified timestamps with unverified ones).
 *
 * NOTE: This is a local ordering decision. Distributed ordering (e.g. across
 * multiple HA instances or after a failover) requires durable event log
 * ordering — marked as a B&W-6.2 durability gap.
 */
export function determineOrdering(
  current: HomeEntityState | undefined,
  incoming: HaEventEnvelope,
): OrderingDecision {
  if (!current) return 'accept';

  const incomingTs = new Date(incoming.eventOccurredAt).getTime();
  const currentTs = new Date(current.stateAt).getTime();

  if (isNaN(incomingTs) || isNaN(currentTs)) {
    // Unparseable timestamps — conservative: accept (do not silently discard)
    return 'accept-tie';
  }

  if (incomingTs > currentTs) return 'accept';
  if (incomingTs < currentTs) return 'reject-stale';
  return 'accept-tie'; // equal
}

/**
 * In-memory entity state store.
 *
 * @testOnly / local-dev only — canonical state is lost on process restart.
 *
 * DURABILITY GAP: Production requires a durable entity-state table with
 * optimistic-locking / compare-and-swap semantics on stateAt. See B&W-6.2.
 *
 * Interface is kept simple intentionally — the pipeline calls get/set and
 * nothing else.  A durable implementation substitutes the same interface.
 */
export interface EntityStateStore {
  get(entityId: string): HomeEntityState | undefined;
  set(state: HomeEntityState): void;
  list(): readonly HomeEntityState[];
}

export class InMemoryEntityStateStore implements EntityStateStore {
  private readonly states = new Map<string, HomeEntityState>();

  get(entityId: string): HomeEntityState | undefined {
    return this.states.get(entityId);
  }

  set(state: HomeEntityState): void {
    this.states.set(state.entityId, state);
  }

  list(): readonly HomeEntityState[] {
    return [...this.states.values()];
  }

  /** Test helper. */
  clear(): void {
    this.states.clear();
  }
}
