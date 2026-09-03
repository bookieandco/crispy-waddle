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
  it('preserves canonical event identity and nested game IDs', () => {
    const event = toNBASportsEvent(base);
    assert.equal(event.gameId, 'game:2026:01');
    assert.equal(event.sequence, 7);
    assert.equal(event.eventType, 'SHOT');
    assert.deepEqual(event.participants, { teamId: 'A', playerId: 'p1', opponentPlayerId: 'p2' });
    assert.deepEqual(event.evidenceIds, ['e1']);
  });
});
