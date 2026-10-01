import { strict as assert } from 'node:assert';
import test from 'node:test';
import { EvidenceBackedRealityStateBuilder, InMemoryEvidenceStore } from './evidence-store.js';

test('evidence store is append-only and reconstructs canonical world state', () => {
  const store = new InMemoryEvidenceStore();
  store.append({
    observationId: 'obs-1',
    eventId: 'game-1',
    sourceId: 'feed-a',
    domain: 'WORLD',
    observedAt: '2026-09-03T19:00:00.000Z',
    receivedAt: '2026-09-03T19:00:01.000Z',
    payload: { score: { home: 1, away: 0 }, period: 1 },
    contentHash: 'hash-1',
  });
  store.append({
    observationId: 'obs-2',
    eventId: 'game-1',
    sourceId: 'feed-b',
    domain: 'WORLD',
    observedAt: '2026-09-03T19:05:00.000Z',
    receivedAt: '2026-09-03T19:05:01.000Z',
    payload: { period: 2 },
    contentHash: 'hash-2',
  });

  assert.throws(() => store.append({
    observationId: 'obs-1',
    eventId: 'game-1',
    sourceId: 'feed-a',
    domain: 'WORLD',
    observedAt: '2026-09-03T19:00:00.000Z',
    receivedAt: '2026-09-03T19:00:01.000Z',
    payload: {},
    contentHash: 'different',
  }));

  const state = new EvidenceBackedRealityStateBuilder(store).build('game-1', '2026-09-03T19:04:00.000Z');
  assert.deepEqual(state.worldState, { score: { home: 1, away: 0 }, period: 1 });
  assert.deepEqual(state.sourceEvidenceIds, ['obs-1']);
  assert.equal(state.canonical, true);
});

test('market evidence never becomes world state', () => {
  const store = new InMemoryEvidenceStore();
  store.append({
    observationId: 'market-1',
    eventId: 'game-2',
    sourceId: 'book-a',
    domain: 'MARKET',
    observedAt: '2026-09-03T19:00:00.000Z',
    receivedAt: '2026-09-03T19:00:01.000Z',
    payload: { homePrice: 1.8 },
    contentHash: 'market-hash',
  });
  assert.throws(() => new EvidenceBackedRealityStateBuilder(store).build('game-2', '2026-09-03T19:01:00.000Z'));
});
