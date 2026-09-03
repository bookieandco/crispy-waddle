import type { NBAEvent, NBAEventGameState } from './nba-event-state-machine.js';
import { createNBAEvent } from './nba-event-state-machine.js';
import { NBA_REGULATION_PERIODS } from './nba-period-lifecycle.js';
import { createNBAGameIdentity } from './nba-game-identity.js';

export function createNBAEndOfPeriodEvent(state: NBAEventGameState, evidenceIds: readonly string[] = []): NBAEvent {
  if (state.periodSecondsRemaining > 0) throw new Error('Cannot end an NBA period before the clock expires');
  const identity = createNBAGameIdentity(state);
  const tied = state.scores[identity.homeTeamId] === state.scores[identity.awayTeamId];
  const kind = state.period < NBA_REGULATION_PERIODS || tied ? 'PERIOD_END' : 'GAME_END';
  return createNBAEvent(state, kind, {
    teamId: state.offenseTeamId,
    period: state.period,
    elapsedSeconds: 0,
    evidenceIds,
  });
}

export function createNBANextPeriodEvent(state: NBAEventGameState, evidenceIds: readonly string[] = []): NBAEvent {
  if (state.periodSecondsRemaining > 0) throw new Error('Cannot start the next NBA period before the current period ends');
  const identity = createNBAGameIdentity(state);
  const tied = state.scores[identity.homeTeamId] === state.scores[identity.awayTeamId];
  if (state.period < NBA_REGULATION_PERIODS) {
    return createNBAEvent(state, 'PERIOD_START', { teamId: state.offenseTeamId, period: state.period + 1, elapsedSeconds: 0, evidenceIds });
  }
  if (tied) {
    return createNBAEvent(state, 'OVERTIME_START', { teamId: state.offenseTeamId, period: state.period + 1, elapsedSeconds: 0, evidenceIds });
  }
  throw new Error('NBA game is complete; no next period exists');
}

export const nbaPeriodDurationSeconds = (period: number): number => period <= NBA_REGULATION_PERIODS ? 12 * 60 : 5 * 60;
