import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SportsEventReconciler } from './sports-event-reconciliation.js';
import type { SportsEvent } from './sports-event.js';

const event = (sourceId: string, score: number, confidence = 1): SportsEvent => ({
  eventId: 'game-1:event-10',
  sport: 'NBA',
  gameId: 'game-1',
  sequence: 10,
  eventType: 'SCORE',
  phase: 'LIVE',
  period: 2,
  clockSecondsRemaining: 300,
  participants: [{ participantId: 'team-a', role: 'TEAM', side: 'HOME' }],
  payload: { score, possession: 'team-a' },
  observationClass: 'OBSERVED',
  confidence,
  provenance: {
    evidenceIds: [`${sourceId}:e10`],
    source: {
      sourceId,
      sourceType: 'FEED',
      observedAt: '2026-09-03T12:00:00.000Z',
      receivedAt: '2026-09-03T12:00:01.000Z',
    },
  },
});

describe('SportsEventReconciler', () => {
  it('selects the highest-trust source when sources agree', () => {
    const reconciler = new SportsEventReconciler([
      { sourceId: 'api-sports', priority: 10 },
      { sourceId: 'video', priority: 20 },
    ]);
    const result = reconciler.reconcile([event('api-sports', 88), event('video', 88)]);
    assert.equal(result.status, 'CANONICAL');
    assert.deepEqual(result.fields.score?.value, 88);
    assert.equal(result.fields.score?.sourceId, 'video');
    assert.deepEqual(result.sourceIds, ['api-sports', 'video']);
  });

  it('quarantines equal-trust conflicting observations instead of guessing', () => {
    const reconciler = new SportsEventReconciler([
      { sourceId: 'feed-a', priority: 10 },
      { sourceId: 'feed-b', priority: 10 },
    ]);
    const result = reconciler.reconcile([event('feed-a', 88), event('feed-b', 89)]);
    assert.equal(result.status, 'CONFLICT');
    assert.deepEqual(result.conflicts, ['score']);
    assert.equal(result.fields.score?.value, undefined);
    assert.equal(result.fields.score?.sourceId, 'UNRESOLVED');
  });

  it('produces a validated canonical event with complete evidence lineage', () => {
    const reconciler = new SportsEventReconciler([{ sourceId: 'api-sports', priority: 10 }]);
    const canonical = reconciler.canonicalize([event('api-sports', 88, 0.95)]);
    assert.equal(canonical.observationClass, 'VALIDATED');
    assert.deepEqual(canonical.provenance.evidenceIds, ['api-sports:e10']);
    assert.deepEqual(canonical.provenance.derivedFromEventIds, ['game-1:event-10']);
    assert.equal(canonical.payload.score, 88);
  });
});
