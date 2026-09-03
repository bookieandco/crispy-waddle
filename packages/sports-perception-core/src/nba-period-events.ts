import type { NBAEvent, NBAEventGameState } from './nba-event-state-machine.js';
import { createNBAEvent } from './nba-event-state-machine.js';
import { NBA_REGULATION_PERIODS, NBA_REGULATION_PERIOD_SECONDS, NBA_OVERTIME_PERIOD_SECONDS } from './nba-period-lifecycle.js';

export function createNBAEndOfPeriodEvent(state: NBAEventGameState, evidenceIds: readonly string[] = []): NBAEvent {
  if (state.periodSecondsRemaining > 0) throw new Error('Cannot end an NBA period before the clock expires');
  return createNBAEvent(state, state.period >= NBA_REGULATION_PERIODS && Object.values(state.scores).slice(0, 2).every((score, _, values) => score === values[0]) ? 'PERIOD_END' : state.period < NBA_REGULATION_PERIODS ? 'PERIOD_END' : 'GAME_END', { teamId: state.offenseTeamId, period: state.period, elapsedSeconds: 0, evidenceIds });
}

export function createNBANextPeriodEvent(state: NBAEventGameState, evidenceIds: readonly string[] = []): NBAEvent {
  if (state.periodSecondsRemaining > 0) throw new Error('Cannot start the next NBA period before the current period ends');
  const scores = Object.values(state.scores).slice(0, 2);
  const tied = scores.length >= 2 && scores[0] === scores[1];
  if (state.period < NBA_REGULATION_PERIODS) {
    return createNBAEvent(state, 'PERIOD_START', { teamId: state.offenseTeamId, period: state.period + 1, elapsedSeconds: 0, evidenceIds });
  }
  if (tied) {
    return createNBAEvent(state, 'OVERTIME_START', { teamId: state.offenseTeamId, period: state.period + 1, elapsedSeconds: 0, evidenceIds });
  }
  throw new Error('NBA game is complete; no next period exists');
}

export const nbaPeriodDurationSeconds = (period: number): number => period <= NBA_REGULATION_PERIODS ? NBA_REGULATION_PERIOD_SECONDS : NBA_OVERTIME_PERIOD_SECONDS;
