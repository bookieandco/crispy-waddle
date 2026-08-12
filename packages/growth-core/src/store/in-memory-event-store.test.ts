import { describe, expect, it } from 'vitest';
import { InMemoryGrowthEventStore, DuplicateGrowthEventError } from './in-memory-event-store.js';
import type { GrowthEvent } from '../events/event-contract.js';

const event: GrowthEvent = {
  eventId: 'evt_001',
  eventType: 'creative_created',
  entityType: 'creative_concept',
  entityId: 'creative_001',
  actor: 'creative-center',
  source: 'jhadina',
  payload: { name: 'Test concept' },
  occurredAt: '2026-08-12T18:00:00.000Z',
  correlationId: 'corr_001',
  idempotencyKey: 'creative-created:creative_001:v1',
};

describe('InMemoryGrowthEventStore', () => {
  it('stores and retrieves an event', () => {
    const store = new InMemoryGrowthEventStore();
    store.append(event);

    expect(store.get(event.eventId)).toEqual(event);
    expect(store.list()).toHaveLength(1);
  });

  it('rejects duplicate event ids', () => {
    const store = new InMemoryGrowthEventStore();
    store.append(event);

    expect(() => store.append(event)).toThrow(DuplicateGrowthEventError);
  });

  it('rejects duplicate idempotency keys even for a different event id', () => {
    const store = new InMemoryGrowthEventStore();
    store.append(event);

    expect(() => store.append({ ...event, eventId: 'evt_002' })).toThrow(DuplicateGrowthEventError);
  });
});
