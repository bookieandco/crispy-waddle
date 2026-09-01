/**
 * B&W-6.2 — Home Assistant Ingestion Idempotency
 *
 * The pipeline supports an optional durable claim protocol. Durable stores
 * must make claim() atomic so concurrent deliveries of the same event cannot
 * both enter the state-transition path.
 */

export type MaybePromise<T> = T | Promise<T>;

export interface IdempotencyStore {
  /** Legacy/read-only lookup retained for compatibility and diagnostics. */
  hasSeen(eventId: string): MaybePromise<boolean>;

  /**
   * Atomically claims an event for processing.
   * Returns true only for the delivery that owns the claim.
   * Durable implementations must enforce uniqueness in the database.
   */
  claim?(eventId: string, entityId: string): MaybePromise<boolean>;

  /** Marks a successfully published event as completed. */
  markSeen(eventId: string, entityId: string): MaybePromise<void>;

  /** Releases an in-flight claim when validation/processing fails before commit. */
  release?(eventId: string): MaybePromise<void>;
}

/**
 * In-process implementation for tests/local development only.
 * @testOnly
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly seen = new Map<string, { entityId: string; seenAt: number }>();
  private readonly processing = new Set<string>();

  hasSeen(eventId: string): boolean {
    return this.seen.has(eventId);
  }

  claim(eventId: string, entityId: string): boolean {
    if (this.seen.has(eventId) || this.processing.has(eventId)) return false;
    this.processing.add(eventId);
    return true;
  }

  markSeen(eventId: string, entityId: string): void {
    this.processing.delete(eventId);
    if (!this.seen.has(eventId)) {
      this.seen.set(eventId, { entityId, seenAt: Date.now() });
    }
  }

  release(eventId: string): void {
    this.processing.delete(eventId);
  }

  seenCount(): number {
    return this.seen.size;
  }

  clear(): void {
    this.seen.clear();
    this.processing.clear();
  }
}
