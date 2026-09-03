import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NBAEventLedger, hashNBAState, replayCanonicalNBAEvents, verifyCanonicalNBAReplay } from './nba-canonical-ledger.js';
import type { NBAEventGameState } from './nba-event-state-machine.js';
import type { NBALineupState, NBAActivePlayer } from './nba-lineup-state.js';
import { createNBAEvent } from './nba-event-state-machine.js';

const player = (playerId: string, teamId: string): NBAActivePlayer => ({ playerId, teamId, minutesPlayed: 0, personalFouls: 0, fatigue: 0, eligible: true });
const lineup = (teamId: string): NBALineupState => ({ teamId, onCourt: [1, 2, 3, 4, 5].map((n) => player(`${teamId}-${n}`, teamId)), bench: [player(`${teamId}-6`, teamId)], substitutions: 0 });

const initialState = (): NBAEventGameState => ({
  gameId: 'ledger-test',
  period: 1,
  periodSecondsRemaining: 720,
  shotClockSeconds: 24,
  offenseTeamId: 'A',
  defenseTeamId: 'B',
  scores: { A: 0, B: 0 },
  players: Object.fromEntries([...Array.from({ length: 6 }, (_, i) => [`A-${i + 1}`, player(`A-${i + 1}`, 'A')]), ...Array.from({ length: 6 }, (_, i) => [`B-${i + 1}`, player(`B-${i + 1}`, 'B')])]),
  offenseLineup: lineup('A'),
  defenseLineup: lineup('B'),
  sequence: 0,
  evidenceIds: [],
});

describe('canonical NBA event ledger', () => {
  it('applies substitutions canonically and preserves replayability', () => {
    const state = initialState();
    const ledger = new NBAEventLedger(state);
    const event = createNBAEvent(state, 'SUBSTITUTION', { teamId: 'A', playerId: 'A-6', opponentPlayerId: 'A-1', evidenceIds: ['rotation-e1'] });
    ledger.append(event);
    const snapshot = ledger.snapshot();
    assert.equal(snapshot.finalState.offenseLineup?.onCourt.some((p) => p.playerId === 'A-6'), true);
    assert.equal(snapshot.finalState.offenseLineup?.bench.some((p) => p.playerId === 'A-1'), true);
    assert.doesNotThrow(() => verifyCanonicalNBAReplay(snapshot));
    assert.equal(replayCanonicalNBAEvents(state, [event]).finalStateHash, snapshot.finalStateHash);
  });

  it('rejects duplicate event IDs and sequence gaps', () => {
    const state = initialState();
    const ledger = new NBAEventLedger(state);
    const first = createNBAEvent(state, 'POSSESSION_START', { teamId: 'A', evidenceIds: ['e1'] });
    ledger.append(first);
    assert.throws(() => ledger.append(first), /Duplicate NBA event ID/);
    const gap = { ...createNBAEvent(ledger.snapshot().finalState, 'PASS', { teamId: 'A', evidenceIds: ['e2'] }), sequence: 99 };
    assert.throws(() => ledger.append(gap), /sequence must advance/);
  });

  it('retains evidence and detects state-hash tampering', () => {
    const state = initialState();
    const ledger = new NBAEventLedger(state);
    const event = createNBAEvent(state, 'SHOT', { teamId: 'A', playerId: 'A-1', made: true, points: 2, evidenceIds: ['video:12.4'] });
    ledger.append(event);
    const snapshot = ledger.snapshot();
    assert.deepEqual(snapshot.finalState.evidenceIds, ['video:12.4']);
    assert.notEqual(hashNBAState(snapshot.initialState), snapshot.finalStateHash);
    const tampered = Object.freeze({ ...snapshot, finalStateHash: 'deadbeef' });
    assert.throws(() => verifyCanonicalNBAReplay(tampered), /final-state hash mismatch/);
  });
});
