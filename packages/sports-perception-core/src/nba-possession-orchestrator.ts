import type { RandomSource } from './simulation.js';
import type { NBAEvent, NBAEventGameState } from './nba-event-state-machine.js';
import { applyNBAEvent, createNBAEvent, resolveMissedShotRebound } from './nba-event-state-machine.js';
import type { NBAPossessionState } from './nba-possession.js';
import { resolveNBAPossession } from './nba-possession.js';

export interface NBAOrchestratedPossessionResult {
  initialState: NBAEventGameState;
  finalState: NBAEventGameState;
  events: readonly NBAEvent[];
  possession: ReturnType<typeof resolveNBAPossession>;
}

export interface NBAReboundPolicy {
  offensive: number;
  defensive: number;
}

const eventForAction = (state: NBAEventGameState, possession: NBAPossessionState, action: ReturnType<typeof resolveNBAPossession>['action']): NBAEvent => {
  const kind = action === 'SHOT_2' || action === 'SHOT_3' ? 'SHOT' : action;
  return createNBAEvent(state, kind as NBAEvent['kind'], {
    teamId: possession.offenseTeamId,
    playerId: possession.ballHandler.playerId,
    opponentPlayerId: possession.primaryDefender.playerId,
    made: action === 'SHOT_2' || action === 'SHOT_3' ? undefined : undefined,
    points: action === 'SHOT_3' ? 3 : action === 'SHOT_2' ? 2 : 0,
    elapsedSeconds: 1,
    evidenceIds: possession.matchup.attacker.evidenceIds,
  });
};

export function resolveNBAOrchestratedPossession(
  state: NBAEventGameState,
  possession: NBAPossessionState,
  rng: RandomSource,
  reboundPolicy: NBAReboundPolicy = { offensive: 0.25, defensive: 0.75 },
): NBAOrchestratedPossessionResult {
  if (state.offenseTeamId !== possession.offenseTeamId) throw new Error('Possession offense team does not match game state');
  const initialState = state;
  const resolved = resolveNBAPossession(possession, rng);
  const events: NBAEvent[] = [];
  let current = state;

  const actionEvent = eventForAction(current, possession, resolved.action);
  if (resolved.action === 'SHOT_2' || resolved.action === 'SHOT_3') {
    const shot = Object.freeze({ ...actionEvent, made: resolved.madeShot, points: resolved.madeShot ? resolved.points : 0 });
    current = applyNBAEvent(current, shot);
    events.push(shot);
    if (!resolved.madeShot) {
      const rebound = resolveMissedShotRebound(current, rng, reboundPolicy.offensive, reboundPolicy.defensive, resolved.evidenceIds);
      current = applyNBAEvent(current, rebound);
      events.push(rebound);
    }
  } else {
    current = applyNBAEvent(current, actionEvent);
    events.push(actionEvent);
  }

  return Object.freeze({ initialState, finalState: current, events: Object.freeze(events), possession: resolved });
}
