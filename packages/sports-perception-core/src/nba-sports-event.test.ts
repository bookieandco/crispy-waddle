import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toNBASportsEvent } from './nba-sports-event.js';

const base = {
  eventId: 'nba-event-v2:game%3A2026%3A01:7:SHOT',
  sequence: 7,
  kind: 'SHOT' as const,
  teamId: 'A',
  playerId: 'p1',
  opponentPlayerId: 'p2',
  made: true,
  points: 3 as const,
  period: 2,
  elapsedSeconds: 4,
  evidenceIds: ['e1'],
};

describe('NBA SportsEvent adapter', () => {
  it('preserves canonical identity and nested game IDs', () => {
    const event = toNBASportsEvent(base, {
      sourceId: 'test-feed',
      sourceType: 'FEED',
      observedAt: '2026-09-03T12:00:00.000Z',
      receivedAt: '2026-09-03T12:00:01.000Z',
    });

    assert.equal(event.gameId, 'game:2026:01');
    assert.equal(event.sequence, 7);
    assert.equal(event.eventType, 'SHOT');
    assert.equal(event.observationClass, 'OBSERVED');
    assert.deepEqual(event.participants, [
      { participantId: 'A', role: 'TEAM' },
      { participantId: 'p1', role: 'PLAYER' },
      { participantId: 'p2', role: 'PLAYER' },
    ]);
    assert.deepEqual(event.provenance.evidenceIds, ['e1']);
    assert.deepEqual(event.provenance.derivedFromEventIds, [base.eventId]);
  });
});
