import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SportsEvent } from './sports-event.js';
import { RealityStateEventResolver } from './reality-state-event-resolver.js';
import { RealityStateCorrectionEngine } from './reality-state-corrections.js';

const event = (id: string, sequence: number, delta: number): SportsEvent => ({
  eventId: id, sport: 'NBA', gameId: 'game-1', sequence, eventType: 'SCORE_DELTA', phase: 'LIVE', participants: [],
  payload: { delta }, observationClass: 'OBSERVED', confidence: 1,
  provenance: { evidenceIds: [id], source: { sourceId: 'test', sourceType: 'FEED', observedAt: `2026-09-03T12:00:0${sequence}.000Z`, receivedAt: `2026-09-03T12:00:1${sequence}.000Z` } },
});

const reducer = {
  initialState: () => ({ score: 0 }),
  reduce: (state: { score: number }, e: SportsEvent) => ({ score: state.score + Number(e.payload.delta) }),
};

describe('RealityStateCorrectionEngine', () => {
  it('creates a replacement branch and reports state change', () => {
    const resolver = new RealityStateEventResolver(reducer);
    resolver.ingest(event('e1', 1, 2));
    resolver.ingest(event('e2', 2, 3));
    const engine = new RealityStateCorrectionEngine(resolver, reducer);
    const branch = engine.apply({ correctionId: 'c1', targetEventId: 'e2', kind: 'REPLACEMENT', replacementEvent: event('e2-corrected', 2, 5), reason: 'official correction', evidenceIds: ['official:e2'], issuedAt: '2026-09-03T12:01:00.000Z' });
    assert.equal(branch.state.state.score, 7);
    assert.equal(branch.diff.changed, true);
    assert.deepEqual(branch.diff.removedEventIds, ['e2']);
    assert.deepEqual(branch.diff.addedEventIds, ['e2-corrected']);
  });

  it('supports retraction without changing the canonical resolver history', () => {
    const resolver = new RealityStateEventResolver(reducer);
    resolver.ingest(event('e1', 1, 2));
    resolver.ingest(event('e2', 2, 3));
    const engine = new RealityStateCorrectionEngine(resolver, reducer);
    const branch = engine.apply({ correctionId: 'c2', targetEventId: 'e2', kind: 'RETRACTION', reason: 'duplicate official event', evidenceIds: ['official:retract'], issuedAt: '2026-09-03T12:01:00.000Z' });
    assert.equal(branch.state.state.score, 2);
    assert.deepEqual(branch.diff.removedEventIds, ['e2']);
    assert.deepEqual(resolver.currentVersion().eventIds, ['e1', 'e2']);
  });
});
