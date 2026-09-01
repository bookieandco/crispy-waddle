/**
 * B&W-6.2 — Home Assistant Ingestion Idempotency
 *
 * Prevents duplicate HA events from producing duplicate state transitions
 * or duplicate downstream domain events.
 *
 * DURABILITY GAP — explicitly documented:
 * The InMemoryIdempotencyStore is @testOnly / local-development only.
 * It provides no durability across process restarts or horizontal scaling.
 *
 * Production requires a durable IdempotencyStore backed by a persistent
 * store (e.g. Supabase table with a unique constraint on eventId).
 * The correct schema would be:
 *
 *   CREATE TABLE ha_ingestion_idempotency (
 *     event_id   TEXT PRIMARY KEY,
 *     seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
 *     entity_id  TEXT NOT NULL
 *   );
 *
 * When this table exists, a DurableSupabaseIdempotencyStore implementing
 * IdempotencyStore should replace InMemoryIdempotencyStore in the
 * production composition root.
 *
 * This gap is tracked under B&W-6.2 and must be resolved before the
 * ingestion pipeline is deployed to production.
 */

/**
 * Idempotency store interface.
 *
 * Callers:
 * 1. Call hasSeen(eventId) before processing — if true, skip.
 * 2. After successful state transition, call markSeen(eventId, entityId).
 *
 * The interface is separate from the in-memory implementation so the
 * composition root can substitute a durable implementation without
 * changing the pipeline code.
 */
export interface IdempotencyStore {
  /**
   * Returns true if the event has already been processed.
   * Must be safe to call multiple times — must not mutate state.
   */
  hasSeen(eventId: string): boolean;

  /**
   * Records the event as processed. Called exactly once after a successful
   * state transition. Implementations must be safe to call with the same
   * eventId multiple times (defensive idempotency).
   */
  markSeen(eventId: string, entityId: string): void;

  /**
   * Returns the number of unique events that have been seen.
   * Useful for diagnostics and tests.
   */
  seenCount(): number;
}

/**
 * In-process non-durable idempotency store.
 *
 * @testOnly / local-dev only — data is lost on process restart.
 *
 * DURABILITY GAP: See module header above.
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly seen = new Map<string, { entityId: string; seenAt: number }>();

  hasSeen(eventId: string): boolean {
    return this.seen.has(eventId);
  }

  markSeen(eventId: string, entityId: string): void {
    if (!this.seen.has(eventId)) {
      this.seen.set(eventId, { entityId, seenAt: Date.now() });
    }
  }

  seenCount(): number {
    return this.seen.size;
  }

  /** Test helper: clear all seen events. */
  clear(): void {
    this.seen.clear();
  }
}
