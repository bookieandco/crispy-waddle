import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryEventBus } from './index.js';

const makeEvent = (overrides: Record<string, unknown> = {}) => ({
  id: 'evt-1',
  type: 'overage.reviewed',
  version: 1,
  occurredAt: '2026-08-22T12:00:00.000Z',
  payload: { opportunityId: 'opp-1' },
  ...overrides,
});

describe('InMemoryEventBus', () => {
  it('publishes events to subscribers in registration order', async () => {
    const bus = new InMemoryEventBus();
    const seen: string[] = [];
    bus.subscribe('overage.reviewed', async (event) => { seen.push(`first:${event.id}`); });
    bus.subscribe('overage.reviewed', async (event) => { seen.push(`second:${event.id}`); });

    await bus.publish(makeEvent({ id: 'evt-1' }));
    assert.deepEqual(seen, ['first:evt-1', 'second:evt-1']);
  });

  it('supports unsubscribe without affecting other subscribers', async () => {
    const bus = new InMemoryEventBus();
    let first = 0;
    let second = 0;
    const unsubscribe = bus.subscribe('reviewed', () => { first += 1; });
    bus.subscribe('reviewed', () => { second += 1; });
    unsubscribe();

    await bus.publish(makeEvent({ id: 'evt-2', type: 'reviewed' }));
    assert.equal(first, 0);
    assert.equal(second, 1);
  });

  it('fails closed on malformed events (missing id)', async () => {
    const bus = new InMemoryEventBus();
    await assert.rejects(
      () => bus.publish(makeEvent({ id: '' })),
      /Invalid domain event/,
    );
  });

  it('fails closed on missing version', async () => {
    const bus = new InMemoryEventBus();
    const { version: _v, ...withoutVersion } = makeEvent();
    await assert.rejects(
      () => bus.publish(withoutVersion as Parameters<typeof bus.publish>[0]),
      /version must be a positive integer/,
    );
  });

  it('fails closed on non-integer version', async () => {
    const bus = new InMemoryEventBus();
    await assert.rejects(
      () => bus.publish(makeEvent({ version: 1.5 }) as Parameters<typeof bus.publish>[0]),
      /version must be a positive integer/,
    );
  });

  it('fails closed on version < 1', async () => {
    const bus = new InMemoryEventBus();
    await assert.rejects(
      () => bus.publish(makeEvent({ version: 0 }) as Parameters<typeof bus.publish>[0]),
      /version must be a positive integer/,
    );
  });

  it('canonical metadata fields are passed through to handlers', async () => {
    const bus = new InMemoryEventBus();
    let received: unknown;
    bus.subscribe('memory.proposed', (e) => { received = e; });

    const full = makeEvent({
      id: 'evt-full',
      type: 'memory.proposed',
      version: 2,
      actor: 'user-a',
      causationId: 'cmd-1',
      correlationId: 'corr-1',
      provenance: 'jhadina-web',
      aggregate: { type: 'Memory', id: 'mem-1' },
    });
    await bus.publish(full);

    assert.deepEqual(received, full);
  });

  it('idempotency key — same event id can be published; bus does not deduplicate (dedup is outbox concern)', async () => {
    const bus = new InMemoryEventBus();
    let count = 0;
    bus.subscribe('ping', () => { count++; });

    const evt = makeEvent({ id: 'dup-id', type: 'ping' });
    await bus.publish(evt);
    await bus.publish(evt);

    // InMemoryEventBus delivers both; deduplication belongs to the durable outbox adapter.
    assert.equal(count, 2);
  });
});

