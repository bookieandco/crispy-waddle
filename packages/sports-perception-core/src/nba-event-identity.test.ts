import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertCanonicalNBAEvent,
  createCanonicalNBAEventId,
  parseCanonicalNBAEventId,
} from './nba-event-identity.js';
import { createNBAEvent, type NBAEventGameState } from './nba-event-state-machine.js';

const state = (gameId = 'game:2026:01'): NBAEventGameState => Object.freeze({
  gameId,
  period: 1,
  periodSecondsRemaining: 720,
  shotClockSeconds: 24,
  offenseTeamId: 'A',
  defenseTeamId: 'B',
  scores: Object.freeze({ A: 0, B: 0 }),
  players: Object.freeze({}),
  sequence: 0,
  evidenceIds: Object.freeze([]),
});

describe('NBA canonical event identity', () => {
  it('round-trips game IDs containing colons', () => {
    const id = createCanonicalNBAEventId('game:2026:01', 7, 'SHOT');
    assert.deepEqual(parseCanonicalNBAEventId(id), { gameId: 'game:2026:01', sequence: 7, kind: 'SHOT' });
  });

  it('creates canonical IDs for generated events', () => {
    const event = createNBAEvent(state(), 'PASS', { teamId: 'A', evidenceIds: [] });
    assert.equal(event.eventId, 'nba-event-v2:game%3A2026%3A01:1:PASS');
  });

  it('rejects canonical identity payload mismatches', () => {
    const current = state();
    const event = createNBAEvent(current, 'PASS', { teamId: 'A', evidenceIds: [] });
    assert.throws(() => assertCanonicalNBAEvent(current, { ...event, sequence: 2 }), /sequence/);
    assert.throws(() => assertCanonicalNBAEvent(current, { ...event, eventId: createCanonicalNBAEventId(current.gameId, 1, 'SHOT') }), /kind/);
    assert.throws(() => assertCanonicalNBAEvent(current, { ...event, eventId: createCanonicalNBAEventId('other', 1, 'PASS') }), /does not belong/);
  });

  it('rejects events from a foreign team', () => {
    const current = state();
    const event = createNBAEvent(current, 'PASS', { teamId: 'C', evidenceIds: [] });
    assert.throws(() => assertCanonicalNBAEvent(current, event), /not part of game/);
  });

  it('keeps legacy IDs replayable during migration', () => {
    const current = state();
    const legacy = { ...createNBAEvent(current, 'PASS', { teamId: 'A', evidenceIds: [] }), eventId: 'game:2026:01:1:PASS' };
    assert.doesNotThrow(() => assertCanonicalNBAEvent(current, legacy));
  });
});
