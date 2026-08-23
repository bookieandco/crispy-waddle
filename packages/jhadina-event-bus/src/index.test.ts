import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryEventBus } from './index.js';

describe('InMemoryEventBus', () => {
  it('publishes events to subscribers in registration order', async () => {
    const bus = new InMemoryEventBus();
    const seen: string[] = [];
    bus.subscribe('overage.reviewed', async (event) => { seen.push(`first:${event.id}`); });
    bus.subscribe('overage.reviewed', async (event) => { seen.push(`second:${event.id}`); });

    await bus.publish({ id: 'evt-1', type: 'overage.reviewed', occurredAt: '2026-08-22T12:00:00.000Z', payload: { opportunityId: 'opp-1' } });
    assert.deepEqual(seen, ['first:evt-1', 'second:evt-1']);
  });

  it('supports unsubscribe without affecting other subscribers', async () => {
    const bus = new InMemoryEventBus();
    let first = 0;
    let second = 0;
    const unsubscribe = bus.subscribe('reviewed', () => { first += 1; });
    bus.subscribe('reviewed', () => { second += 1; });
    unsubscribe();

    await bus.publish({ id: 'evt-2', type: 'reviewed', occurredAt: '2026-08-22T12:00:00.000Z', payload: null });
    assert.equal(first, 0);
    assert.equal(second, 1);
  });

  it('fails closed on malformed events', async () => {
    const bus = new InMemoryEventBus();
    await assert.rejects(() => bus.publish({ id: '', type: 'reviewed', occurredAt: '', payload: null }), /Invalid domain event/);
  });
});
