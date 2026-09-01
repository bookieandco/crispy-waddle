/**
 * B&W-6.2 — Home Assistant State/Event Ingestion Tests
 *
 * Covers all required test scenarios from the B&W-6.2 problem statement.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { validateHaEvent, HA_INGESTION_SCHEMA_VERSION } from './ha-event-envelope.js';
import type { RawHomeAssistantEvent } from './ha-event-envelope.js';
import { InMemoryIdempotencyStore } from './ha-idempotency.js';
import { InMemoryEntityStateStore, determineOrdering } from './ha-state-machine.js';
import type { HomeEntityState } from './ha-state-machine.js';
import {
  HomeAssistantIngestionPipeline,
  HA_STATE_CHANGED_EVENT_TYPE,
  HA_STATE_CHANGED_EVENT_VERSION,
} from './ha-ingestion.js';
import type { DomainEvent, HaEntityStatePayload, EventBusPort } from './ha-ingestion.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const T0 = '2026-09-01T00:00:00.000Z';
const T1 = '2026-09-01T00:01:00.000Z';
const T2 = '2026-09-01T00:02:00.000Z';

function makeRaw(overrides: Partial<RawHomeAssistantEvent> = {}): RawHomeAssistantEvent {
  return {
    eventType: 'state_changed',
    receivedAt: T1,
    timeFired: T1,
    transportEventId: 'evt-001',
    data: {
      entity_id: 'light.living_room',
      new_state: {
        entity_id: 'light.living_room',
        state: 'on',
        attributes: { friendly_name: 'Living Room', brightness: 128 },
        last_changed: T1,
        last_updated: T1,
      },
      old_state: {
        entity_id: 'light.living_room',
        state: 'off',
        attributes: { friendly_name: 'Living Room', brightness: 0 },
        last_changed: T0,
        last_updated: T0,
      },
    },
    context: { id: 'ctx-001', parent_id: 'ctx-000', user_id: null },
    ...overrides,
  };
}

function makeBus(): EventBusPort & { events: DomainEvent[] } {
  const events: DomainEvent[] = [];
  return {
    events,
    async publish(event) { events.push(event as DomainEvent); },
  };
}

function makePipeline(busOverride?: EventBusPort & { events: DomainEvent[] }) {
  const idempotency = new InMemoryIdempotencyStore();
  const stateStore = new InMemoryEntityStateStore();
  const bus = busOverride ?? makeBus();
  const clock = () => T2;
  const pipeline = new HomeAssistantIngestionPipeline(idempotency, stateStore, bus, { clock });
  return { idempotency, stateStore, bus: bus as ReturnType<typeof makeBus>, pipeline };
}

function makeExistingState(overrides: Partial<HomeEntityState> = {}): HomeEntityState {
  return Object.freeze({
    entityId: 'ha:entity:light.living_room' as `ha:entity:${string}`,
    domain: 'light' as const,
    friendlyName: 'Living Room',
    availability: 'available' as const,
    attributes: Object.freeze({ brightness: 0 }),
    provider: 'home-assistant' as const,
    sourceEntityId: 'light.living_room',
    sourceEventId: 'evt-000',
    stateAt: T0,
    timestampMissing: false,
    updatedAt: T0,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// SECTION 1 — Validation (validateHaEvent)
// ---------------------------------------------------------------------------

describe('B&W-6.2 Validation', () => {
  it('valid state_changed event is accepted and envelope populated', () => {
    const result = validateHaEvent(makeRaw());
    assert.ok(result.ok);
    assert.equal(result.envelope.provider, 'home-assistant');
    assert.equal(result.envelope.eventType, 'state_changed');
    assert.equal(result.envelope.schemaVersion, HA_INGESTION_SCHEMA_VERSION);
    assert.equal(result.envelope.sourceEntityId, 'light.living_room');
    assert.equal(result.envelope.eventId, 'evt-001'); // transportEventId used
    assert.equal(result.envelope.timestampMissing, false);
  });

  it('malformed event — missing eventType — rejected', () => {
    const result = validateHaEvent(makeRaw({ eventType: '' }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.reason.length > 0);
  });

  it('malformed event — null data — rejected', () => {
    const result = validateHaEvent({ ...makeRaw(), data: null as unknown as Record<string, unknown> });
    assert.equal(result.ok, false);
  });

  it('malformed event — data is array — rejected', () => {
    const result = validateHaEvent({ ...makeRaw(), data: [] as unknown as Record<string, unknown> });
    assert.equal(result.ok, false);
  });

  it('unsupported event type — rejected with explicit reason (not silently discarded)', () => {
    const result = validateHaEvent(makeRaw({ eventType: 'call_service' }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.reason.includes('call_service'));
  });

  it('missing entity_id in both new_state and old_state — rejected', () => {
    const result = validateHaEvent({
      ...makeRaw(),
      data: { new_state: { state: 'on', attributes: {} }, old_state: null },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.reason.includes('entity_id'));
  });

  it('missing timeFired — accepted with timestampMissing=true; receivedAt used as timestamp', () => {
    const result = validateHaEvent(makeRaw({ timeFired: undefined }));
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(result.envelope.timestampMissing, true);
      assert.equal(result.envelope.eventOccurredAt, T1); // receivedAt
    }
  });

  it('missing transportEventId — deterministic eventId derived from entity+timestamp', () => {
    const result = validateHaEvent(makeRaw({ transportEventId: undefined }));
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(result.envelope.eventId, `ha:state:light.living_room:${T1}`);
    }
  });

  it('event version is validated — schema version is set', () => {
    const result = validateHaEvent(makeRaw());
    assert.ok(result.ok);
    if (result.ok) assert.equal(result.envelope.schemaVersion, 1);
  });
});

// ---------------------------------------------------------------------------
// SECTION 2 — Provenance
// ---------------------------------------------------------------------------

describe('B&W-6.2 Provenance', () => {
  it('provider is always home-assistant — cannot masquerade as native Jhadina event', () => {
    const result = validateHaEvent(makeRaw());
    assert.ok(result.ok);
    if (result.ok) assert.equal(result.envelope.provider, 'home-assistant');
  });

  it('sourceEntityId is preserved from the raw HA event', () => {
    const result = validateHaEvent(makeRaw());
    assert.ok(result.ok);
    if (result.ok) assert.equal(result.envelope.sourceEntityId, 'light.living_room');
  });

  it('correlationId is propagated from HA context.id', () => {
    const result = validateHaEvent(makeRaw({ context: { id: 'corr-xyz', parent_id: null, user_id: null } }));
    assert.ok(result.ok);
    if (result.ok) assert.equal(result.envelope.correlationId, 'corr-xyz');
  });

  it('causationId is propagated from HA context.parent_id', () => {
    const result = validateHaEvent(makeRaw({ context: { id: 'ctx-002', parent_id: 'parent-001', user_id: null } }));
    assert.ok(result.ok);
    if (result.ok) assert.equal(result.envelope.causationId, 'parent-001');
  });

  it('published DomainEvent has provenance=home-assistant', async () => {
    const { pipeline, bus } = makePipeline();
    await pipeline.ingest(makeRaw());
    assert.equal(bus.events[0]!.provenance, 'home-assistant');
  });

  it('HomeEntityState retains sourceEntityId and sourceEventId for provenance', async () => {
    const { pipeline, stateStore } = makePipeline();
    await pipeline.ingest(makeRaw());
    const state = stateStore.get('ha:entity:light.living_room');
    assert.ok(state);
    assert.equal(state!.sourceEntityId, 'light.living_room');
    assert.equal(state!.sourceEventId, 'evt-001');
    assert.equal(state!.provider, 'home-assistant');
  });

  it('canonical entity identity contains no transport secrets', async () => {
    const { pipeline, stateStore } = makePipeline();
    await pipeline.ingest(makeRaw());
    const state = stateStore.get('ha:entity:light.living_room');
    assert.ok(state);
    assert.ok(!('baseUrl' in state!));
    assert.ok(!('accessToken' in state!));
    assert.ok(!('token' in state!));
  });

  it('correlation/causation metadata preserved in DomainEvent and state', async () => {
    const { pipeline, bus, stateStore } = makePipeline();
    await pipeline.ingest(makeRaw({
      context: { id: 'corr-abc', parent_id: 'caus-xyz', user_id: null },
    }));
    const evt = bus.events[0]!;
    assert.equal(evt.correlationId, 'corr-abc');
    assert.equal(evt.causationId, 'caus-xyz');
    const state = stateStore.get('ha:entity:light.living_room');
    assert.equal(state!.correlationId, 'corr-abc');
    assert.equal(state!.causationId, 'caus-xyz');
  });
});

// ---------------------------------------------------------------------------
// SECTION 3 — Idempotency
// ---------------------------------------------------------------------------

describe('B&W-6.2 Idempotency', () => {
  it('same event received twice — second is duplicate; state unchanged', async () => {
    const { pipeline, bus, stateStore } = makePipeline();
    const raw = makeRaw();
    const r1 = await pipeline.ingest(raw);
    const r2 = await pipeline.ingest(raw);

    assert.equal(r1.outcome, 'accepted');
    assert.equal(r2.outcome, 'duplicate');
    assert.equal(bus.events.length, 1); // exactly one event published
    assert.equal(stateStore.list().length, 1);
  });

  it('same event received multiple times — all after first are duplicate', async () => {
    const { pipeline, bus } = makePipeline();
    const raw = makeRaw();
    await pipeline.ingest(raw);
    await pipeline.ingest(raw);
    await pipeline.ingest(raw);
    assert.equal(bus.events.length, 1);
  });

  it('same entity with different event IDs — both accepted as independent events', async () => {
    const { pipeline, bus } = makePipeline();
    const r1 = await pipeline.ingest(makeRaw({ transportEventId: 'evt-A', timeFired: T0 }));
    const r2 = await pipeline.ingest(makeRaw({ transportEventId: 'evt-B', timeFired: T1 }));
    assert.equal(r1.outcome, 'accepted');
    assert.equal(r2.outcome, 'accepted');
    assert.equal(bus.events.length, 2);
  });

  it('equivalent events with different transport metadata (no transportEventId) — deterministic dedup', async () => {
    // Same entity + same timeFired → same derived eventId → second is duplicate
    const { pipeline, bus } = makePipeline();
    const base: Partial<RawHomeAssistantEvent> = { transportEventId: undefined, timeFired: T1 };
    const r1 = await pipeline.ingest(makeRaw(base));
    const r2 = await pipeline.ingest(makeRaw({ ...base, receivedAt: T2 })); // different receivedAt, same derived key
    assert.equal(r1.outcome, 'accepted');
    assert.equal(r2.outcome, 'duplicate');
    assert.equal(bus.events.length, 1);
  });

  it('replay of an old event (already seen) — idempotent, no state mutation', async () => {
    const { pipeline, bus, stateStore } = makePipeline();
    await pipeline.ingest(makeRaw({ transportEventId: 'evt-new', timeFired: T2 }));
    const stateBefore = stateStore.get('ha:entity:light.living_room');
    const replay = await pipeline.ingest(makeRaw({ transportEventId: 'evt-new', timeFired: T2 }));
    assert.equal(replay.outcome, 'duplicate');
    assert.equal(stateStore.get('ha:entity:light.living_room')!.sourceEventId, stateBefore!.sourceEventId);
    assert.equal(bus.events.length, 1);
  });
});

// ---------------------------------------------------------------------------
// SECTION 4 — Ordering / stale events
// ---------------------------------------------------------------------------

describe('B&W-6.2 Ordering / stale events', () => {
  it('newer event after older event — newer wins (accepted)', () => {
    const current = makeExistingState({ stateAt: T0 });
    const envelope = validateHaEvent(makeRaw({ timeFired: T1, transportEventId: 'new-evt' }));
    assert.ok(envelope.ok);
    assert.equal(determineOrdering(current, envelope.envelope), 'accept');
  });

  it('older event after newer event — stale (reject-stale)', () => {
    const current = makeExistingState({ stateAt: T2 });
    const envelope = validateHaEvent(makeRaw({ timeFired: T1, transportEventId: 'old-evt' }));
    assert.ok(envelope.ok);
    assert.equal(determineOrdering(current, envelope.envelope), 'reject-stale');
  });

  it('equal timestamps — accept-tie (deterministic tie-break)', () => {
    const current = makeExistingState({ stateAt: T1 });
    const envelope = validateHaEvent(makeRaw({ timeFired: T1, transportEventId: 'tie-evt' }));
    assert.ok(envelope.ok);
    assert.equal(determineOrdering(current, envelope.envelope), 'accept-tie');
  });

  it('no current state — always accept (first event)', () => {
    const envelope = validateHaEvent(makeRaw());
    assert.ok(envelope.ok);
    assert.equal(determineOrdering(undefined, envelope.envelope), 'accept');
  });

  it('stale event cannot overwrite newer canonical state', async () => {
    const { pipeline, bus, stateStore } = makePipeline();
    await pipeline.ingest(makeRaw({ transportEventId: 'newer', timeFired: T2 }));
    const result = await pipeline.ingest(makeRaw({ transportEventId: 'stale', timeFired: T0 }));
    assert.equal(result.outcome, 'stale');
    // State still reflects the newer event
    assert.equal(stateStore.get('ha:entity:light.living_room')!.sourceEventId, 'newer');
    // No second event bus publish
    assert.equal(bus.events.length, 1);
  });

  it('missing timestamp — accept-tie (conservative — do not silently discard)', () => {
    const current = makeExistingState({ stateAt: T1 });
    const envelope = validateHaEvent(makeRaw({ timeFired: undefined, transportEventId: 'no-ts' }));
    assert.ok(envelope.ok);
    // receivedAt = T1, same as stateAt → accept-tie
    const decision = determineOrdering(current, envelope.envelope);
    assert.ok(decision === 'accept-tie' || decision === 'accept');
  });

  it('unavailable → available transition is accepted and preserved', async () => {
    const { pipeline, stateStore } = makePipeline();
    // First: unavailable
    await pipeline.ingest(makeRaw({
      transportEventId: 'evt-unavail',
      timeFired: T0,
      data: {
        entity_id: 'light.living_room',
        new_state: { entity_id: 'light.living_room', state: 'unavailable', attributes: {} },
        old_state: null,
      },
    }));
    // Then: available
    await pipeline.ingest(makeRaw({
      transportEventId: 'evt-avail',
      timeFired: T1,
    }));
    const state = stateStore.get('ha:entity:light.living_room');
    assert.equal(state!.availability, 'available');
  });

  it('available → unavailable transition is preserved explicitly', async () => {
    const { pipeline, stateStore } = makePipeline();
    await pipeline.ingest(makeRaw({ transportEventId: 'evt-on', timeFired: T0 }));
    await pipeline.ingest(makeRaw({
      transportEventId: 'evt-unavail',
      timeFired: T1,
      data: {
        entity_id: 'light.living_room',
        new_state: { entity_id: 'light.living_room', state: 'unavailable', attributes: {} },
        old_state: null,
      },
    }));
    const state = stateStore.get('ha:entity:light.living_room');
    assert.equal(state!.availability, 'unavailable');
  });
});

// ---------------------------------------------------------------------------
// SECTION 5 — Normalization and canonical state
// ---------------------------------------------------------------------------

describe('B&W-6.2 Normalization', () => {
  it('normalized state is deterministic given the same input', async () => {
    const { pipeline: p1, stateStore: s1 } = makePipeline();
    const { pipeline: p2, stateStore: s2 } = makePipeline();
    const raw = makeRaw();
    await p1.ingest(raw);
    await p2.ingest(raw);
    const state1 = s1.get('ha:entity:light.living_room');
    const state2 = s2.get('ha:entity:light.living_room');
    assert.deepEqual(state1, state2);
  });

  it('unknown state is preserved — not silently replaced with a fabricated value', async () => {
    const { pipeline, stateStore } = makePipeline();
    await pipeline.ingest(makeRaw({
      transportEventId: 'evt-unknown',
      data: {
        entity_id: 'light.living_room',
        new_state: { entity_id: 'light.living_room', state: 'unknown', attributes: {} },
        old_state: null,
      },
    }));
    assert.equal(stateStore.get('ha:entity:light.living_room')!.availability, 'unknown');
  });

  it('unavailable state is preserved — not silently replaced', async () => {
    const { pipeline, stateStore } = makePipeline();
    await pipeline.ingest(makeRaw({
      transportEventId: 'evt-ua',
      data: {
        entity_id: 'sensor.temperature',
        new_state: { entity_id: 'sensor.temperature', state: 'unavailable', attributes: {} },
        old_state: null,
      },
    }));
    assert.equal(stateStore.get('ha:entity:sensor.temperature')!.availability, 'unavailable');
  });

  it('state snapshot has no authorization fields (granted/allowed/authorized)', async () => {
    const { pipeline, stateStore } = makePipeline();
    await pipeline.ingest(makeRaw());
    const state = stateStore.get('ha:entity:light.living_room') as Record<string, unknown>;
    assert.ok(!('granted' in state));
    assert.ok(!('allowed' in state));
    assert.ok(!('authorized' in state));
  });
});

// ---------------------------------------------------------------------------
// SECTION 6 — Event Bus
// ---------------------------------------------------------------------------

describe('B&W-6.2 Event Bus', () => {
  it('accepted state transition emits exactly one canonical Event Bus event', async () => {
    const { pipeline, bus } = makePipeline();
    await pipeline.ingest(makeRaw());
    assert.equal(bus.events.length, 1);
    const evt = bus.events[0]!;
    assert.equal(evt.type, HA_STATE_CHANGED_EVENT_TYPE);
    assert.equal(evt.version, HA_STATE_CHANGED_EVENT_VERSION);
  });

  it('rejected event emits no canonical Event Bus event', async () => {
    const { pipeline, bus } = makePipeline();
    await pipeline.ingest(makeRaw({ eventType: 'call_service' }));
    assert.equal(bus.events.length, 0);
  });

  it('duplicate event emits no additional Event Bus event', async () => {
    const { pipeline, bus } = makePipeline();
    const raw = makeRaw();
    await pipeline.ingest(raw);
    await pipeline.ingest(raw);
    assert.equal(bus.events.length, 1);
  });

  it('stale event emits no Event Bus event', async () => {
    const { pipeline, bus } = makePipeline();
    await pipeline.ingest(makeRaw({ transportEventId: 'newer', timeFired: T2 }));
    await pipeline.ingest(makeRaw({ transportEventId: 'stale', timeFired: T0 }));
    assert.equal(bus.events.length, 1);
  });

  it('published DomainEvent uses the existing event envelope contract', async () => {
    const { pipeline, bus } = makePipeline();
    await pipeline.ingest(makeRaw({ context: { id: 'corr-1', parent_id: 'caus-0', user_id: null } }));
    const evt = bus.events[0]!;
    assert.ok(typeof evt.id === 'string' && evt.id.length > 0);
    assert.ok(typeof evt.type === 'string');
    assert.ok(typeof evt.version === 'number' && evt.version >= 1);
    assert.ok(typeof evt.occurredAt === 'string');
    assert.equal(evt.aggregate?.type, 'ha:entity');
    assert.equal(evt.correlationId, 'corr-1');
    assert.equal(evt.causationId, 'caus-0');
  });

  it('payload contains current state and previous state', async () => {
    const { pipeline, bus } = makePipeline();
    await pipeline.ingest(makeRaw({ transportEventId: 'evt-first', timeFired: T0 }));
    await pipeline.ingest(makeRaw({ transportEventId: 'evt-second', timeFired: T1 }));
    const secondEvt = bus.events[1]! as DomainEvent<HaEntityStatePayload>;
    assert.ok(secondEvt.payload.previous !== null);
    assert.equal(secondEvt.payload.previous!.sourceEventId, 'evt-first');
    assert.equal(secondEvt.payload.current.sourceEventId, 'evt-second');
  });

  it('first event payload has previous=null', async () => {
    const { pipeline, bus } = makePipeline();
    await pipeline.ingest(makeRaw());
    const firstEvt = bus.events[0]! as DomainEvent<HaEntityStatePayload>;
    assert.equal(firstEvt.payload.previous, null);
  });
});

// ---------------------------------------------------------------------------
// SECTION 7 — Error boundaries
// ---------------------------------------------------------------------------

describe('B&W-6.2 Error boundaries', () => {
  it('malformed event does not mutate canonical state', async () => {
    const { pipeline, stateStore } = makePipeline();
    await pipeline.ingest(makeRaw({ eventType: 'bad_type' }));
    assert.equal(stateStore.list().length, 0);
  });

  it('missing entity_id does not mutate canonical state', async () => {
    const { pipeline, stateStore } = makePipeline();
    await pipeline.ingest({
      ...makeRaw(),
      data: { new_state: { state: 'on', attributes: {} } },
    });
    assert.equal(stateStore.list().length, 0);
  });

  it('pipeline handles null new_state gracefully when old_state is valid', async () => {
    const { pipeline, stateStore } = makePipeline();
    const result = await pipeline.ingest(makeRaw({
      transportEventId: 'evt-del',
      data: {
        entity_id: 'light.living_room',
        new_state: null,
        old_state: {
          entity_id: 'light.living_room',
          state: 'on',
          attributes: { friendly_name: 'Living Room' },
        },
      },
    }));
    // Should not throw; result is either accepted (old_state used) or rejected with a reason
    assert.ok(result.outcome === 'accepted' || result.outcome === 'rejected');
  });
});

// ---------------------------------------------------------------------------
// SECTION 8 — Durability boundary (interface verification)
// ---------------------------------------------------------------------------

describe('B&W-6.2 Durability boundary', () => {
  it('IdempotencyStore interface is injectable — can substitute test double', async () => {
    const seenIds: string[] = [];
    const testStore = {
      hasSeen: (id: string) => seenIds.includes(id),
      markSeen: (id: string, _entityId: string) => { seenIds.push(id); },
      seenCount: () => seenIds.length,
    };
    const { pipeline: _, bus } = (() => {
      const idempotency = testStore;
      const stateStore = new InMemoryEntityStateStore();
      const bus = makeBus();
      const pipeline = new HomeAssistantIngestionPipeline(idempotency, stateStore, bus, { clock: () => T2 });
      return { pipeline, bus };
    })();
    await _.ingest(makeRaw());
    assert.equal(seenIds.length, 1);
    assert.equal(seenIds[0], 'evt-001');
    assert.equal(bus.events.length, 1);
  });

  it('InMemoryIdempotencyStore is correctly marked — seenCount increments on first markSeen only', () => {
    const store = new InMemoryIdempotencyStore();
    store.markSeen('e1', 'entity.x');
    store.markSeen('e1', 'entity.x'); // duplicate — must not double-count
    assert.equal(store.seenCount(), 1);
  });

  it('InMemoryEntityStateStore is injectable — pipeline uses the same interface', () => {
    const customStore = new InMemoryEntityStateStore();
    const pipeline = new HomeAssistantIngestionPipeline(
      new InMemoryIdempotencyStore(),
      customStore,
      makeBus(),
      { clock: () => T2 },
    );
    assert.ok(typeof pipeline.ingest === 'function');
    assert.equal(customStore.list().length, 0);
  });
});
