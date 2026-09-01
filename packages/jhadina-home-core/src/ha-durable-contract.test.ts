import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryIdempotencyStore } from './ha-idempotency.js';
import { InMemoryEntityStateStore } from './ha-state-machine.js';

const STATE = {
  entityId: 'ha:entity:light.living_room' as `ha:entity:${string}`,
  domain: 'light' as const,
  friendlyName: 'Living Room',
  availability: 'available' as const,
  attributes: { brightness: 100 },
  provider: 'home-assistant' as const,
  sourceEntityId: 'light.living_room',
  sourceEventId: 'evt-1',
  stateAt: '2026-09-01T00:01:00.000Z',
  timestampMissing: false,
  updatedAt: '2026-09-01T00:01:01.000Z',
};

describe('B&W-6.2 durable persistence contracts', () => {
  it('idempotency claim is single-owner and completion remains idempotent', () => {
    const store = new InMemoryIdempotencyStore();
    assert.equal(store.claim('evt-1', 'light.living_room'), true);
    assert.equal(store.claim('evt-1', 'light.living_room'), false);
    store.markSeen('evt-1', 'light.living_room');
    assert.equal(store.hasSeen('evt-1'), true);
    assert.equal(store.claim('evt-1', 'light.living_room'), false);
  });

  it('failed processing can release an in-flight claim', () => {
    const store = new InMemoryIdempotencyStore();
    assert.equal(store.claim('evt-2', 'light.living_room'), true);
    store.release('evt-2');
    assert.equal(store.claim('evt-2', 'light.living_room'), true);
  });

  it('state CAS rejects a writer based on an obsolete stateAt', () => {
    const store = new InMemoryEntityStateStore();
    assert.equal(store.set(STATE), true);
    const newer = { ...STATE, sourceEventId: 'evt-2', stateAt: '2026-09-01T00:02:00.000Z' };
    assert.equal(store.set(newer, STATE.stateAt), true);
    const stale = { ...STATE, sourceEventId: 'evt-3', stateAt: '2026-09-01T00:01:30.000Z' };
    assert.equal(store.set(stale, STATE.stateAt), false);
    assert.equal(store.get(STATE.entityId)?.sourceEventId, 'evt-2');
  });
});
