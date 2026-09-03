import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runNBAGameLoop } from './nba-game-loop.js';
import { replayCanonicalNBAEvents, verifyCanonicalNBAReplay } from './nba-canonical-ledger.js';
import type { NBAEventGameState } from './nba-event-state-machine.js';
import type { NBAActivePlayer, NBALineupState } from './nba-lineup-state.js';
import type { NBAPossessionState } from './nba-possession.js';
import { buildPlayerMatchup, toSimulationProfile } from './player-simulation.js';
import type { ResolvedPlayerState } from './player-attributes.js';

const player = (playerId: string, teamId: string): NBAActivePlayer => ({ playerId, teamId, minutesPlayed: 0, personalFouls: 0, fatigue: 0, eligible: true });
const lineup = (teamId: string): NBALineupState => ({ teamId, onCourt: [1, 2, 3, 4, 5].map((n) => player(`${teamId}-${n}`, teamId)), bench: [player(`${teamId}-6`, teamId)], substitutions: 0 });

const resolved = (playerId: string): ResolvedPlayerState => ({
  playerId, sport: 'NBA', asOf: '2026-09-03T00:00:00Z',
  sliders: { finishing: { attribute: 'finishing', value: 80, uncertainty: 5, components: { BASE: 80, RECENT_FORM: 0, MATCHUP: 0, ROLE: 0, FATIGUE: 0, PRESSURE: 0, CURRENT_STATE: 0 }, evidenceIds: [`evidence:${playerId}`] } },
});

const possession = (state: NBAEventGameState): NBAPossessionState => ({
  possessionId: `${state.gameId}:p${state.sequence + 1}`,
  offenseTeamId: state.offenseTeamId,
  defenseTeamId: state.defenseTeamId,
  clockSeconds: state.periodSecondsRemaining,
  shotClockSeconds: state.shotClockSeconds,
  scoreMargin: (state.scores[state.offenseTeamId] ?? 0) - (state.scores[state.defenseTeamId] ?? 0),
  ballHandler: { playerId: `${state.offenseTeamId}-1`, usage: 20, finishing: 80, shotCreation: 80, threePoint: 50, ballSecurity: 80 },
  primaryDefender: { playerId: `${state.defenseTeamId}-1`, usage: 15, finishing: 70, shotCreation: 60, threePoint: 40, ballSecurity: 90 },
  matchup: buildPlayerMatchup(toSimulationProfile(resolved(`${state.offenseTeamId}-1`)), toSimulationProfile(resolved(`${state.defenseTeamId}-1`))),
});

const initialState = (): NBAEventGameState => ({
  gameId: 'loop-test', period: 1, periodSecondsRemaining: 120, shotClockSeconds: 24,
  offenseTeamId: 'A', defenseTeamId: 'B', scores: { A: 0, B: 0 },
  players: Object.fromEntries([...Array.from({ length: 6 }, (_, i) => [`A-${i + 1}`, player(`A-${i + 1}`, 'A')]), ...Array.from({ length: 6 }, (_, i) => [`B-${i + 1}`, player(`B-${i + 1}`, 'B')])]),
  offenseLineup: lineup('A'), defenseLineup: lineup('B'), sequence: 0, evidenceIds: [],
});

const rng = (values: readonly number[]) => { let i = 0; return { next: () => values[i++ % values.length] }; };

describe('NBA game loop canonical integration', () => {
  it('returns events and final state from the canonical ledger and replays identically', () => {
    const initial = initialState();
    const result = runNBAGameLoop({ state: initial, possessionFactory: possession, rng: rng([0.99, 0.99, 0.99, 0.01, 0.99, 0.99]), maxPossessions: 2 });
    assert.equal(result.events.length, result.ledger.transitions.length);
    assert.equal(result.finalState, result.ledger.finalState);
    const replay = replayCanonicalNBAEvents(initial, result.events);
    assert.equal(replay.finalStateHash, result.ledger.finalStateHash);
    assert.doesNotThrow(() => verifyCanonicalNBAReplay(result.ledger));
  });

  it('keeps the possession count bounded and advances canonical sequence', () => {
    const result = runNBAGameLoop({ state: initialState(), possessionFactory: possession, rng: rng([0.99, 0.99, 0.99, 0.99]), maxPossessions: 3 });
    assert.equal(result.possessions, 3);
    assert.equal(result.finalState.sequence, result.events.length);
    assert.ok(result.events.every((event, index) => event.sequence === index + 1));
  });
});
