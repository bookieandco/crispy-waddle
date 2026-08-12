import type { GrowthEvent } from '../events/event-contract.js';

export class DuplicateGrowthEventError extends Error {
  constructor(public readonly idempotencyKey: string) {
    super(`Growth event already exists: ${idempotencyKey}`);
    this.name = 'DuplicateGrowthEventError';
  }
}

export interface GrowthEventStore {
  append<TPayload>(event: GrowthEvent<TPayload>): void;
  get(eventId: string): GrowthEvent | undefined;
  hasIdempotencyKey(key: string): boolean;
  list(): readonly GrowthEvent[];
}

export class InMemoryGrowthEventStore implements GrowthEventStore {
  private readonly events = new Map<string, GrowthEvent>();
  private readonly idempotencyKeys = new Set<string>();

  append<TPayload>(event: GrowthEvent<TPayload>): void {
    if (this.events.has(event.eventId) || this.idempotencyKeys.has(event.idempotencyKey)) {
      throw new DuplicateGrowthEventError(event.idempotencyKey);
    }
    this.events.set(event.eventId, event as GrowthEvent);
    this.idempotencyKeys.add(event.idempotencyKey);
  }

  get(eventId: string): GrowthEvent | undefined {
    return this.events.get(eventId);
  }

  hasIdempotencyKey(key: string): boolean {
    return this.idempotencyKeys.has(key);
  }

  list(): readonly GrowthEvent[] {
    return [...this.events.values()];
  }
}
