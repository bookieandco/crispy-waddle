import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SportsEvent } from './sports-event.js';
import { RealityStateEventResolver } from './reality-state-event-resolver.js';

const makeEvent = (eventId: string, sequence: number, observedAt: string, delta: number): SportsEvent => ({
  eventId,
  sport: 'NBA',
  gameId: 'game-1',
  sequence,
  eventType: 'SCORE_DELTA',
  phase: 'LIVE',
  participants: [],
  payload: { delta },
  observationClass: 'OBSERVED',
  confidence: 1,
  provenance: {
    evidenceIds: [eventId],
    source: { sourceId: 'test', sourceType: 'FEED', observedAt, receivedAt: '2026-09-03T12:00:10.000Z' },
  },
});

describe('RealityStateEventResolver', () => {
  const reducer = {
    initialState: () => ({ score: 0 }),
    reduce: (state: { score: number }, event: SportsEvent) => ({ score: state.score + Number(event.payload.delta) }),
  };

  it('rebuilds deterministically when a late event arrives', () => {
    const resolver = new RealityStateEventResolver(reducer, 1_000);
    resolver.ingest(makeEvent('e2', 2, '2026-09-03T12:00:02.000Z', 3));
    const result = resolver.ingest(makeEvent('e1', 1, '2026-09-03T12:00:01.000Z', 2));
    assert.equal(result.disposition, 'LATE');
    assert.equal(result.requiresReplay, true);
    assert.equal(result.state.state.score, 5);
    assert.deepEqual(result.state.eventIds, ['e1', 'e2']);
  });

  it('is idempotent for duplicate event IDs', () => {
    const resolver = new RealityStateEventResolver(reducer);
    resolver.ingest(makeEvent('e1', 1, '2026-09-03T12:00:01.000Z', 2));
    const result = resolver.ingest(makeEvent('e1', 1, '2026-09-03T12:00:01.000Z', 2));
    assert.equal(result.disposition, 'DUPLICATE');
    assert.equal(result.inserted, false);
    assert.equal(result.state.state.score, 2);
  });

  it('marks current state provisional until watermark advances past the event', () => {
    const resolver = new RealityStateEventResolver(reducer, 1_000);
    const result = resolver.ingest(makeEvent('e1', 1, '2026-09-03T12:00:01.000Z', 2));
    assert.equal(result.state.provisional, true);
    const settled = resolver.advanceWatermark('2026-09-03T12:00:03.000Z');
    assert.equal(settled.provisional, false);
  });
});
