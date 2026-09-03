import type { NBAEventGameState } from './nba-event-state-machine.js';
import { createNBAGameIdentity } from './nba-game-identity.js';

export const NBA_REGULATION_PERIOD_SECONDS = 12 * 60;
export const NBA_OVERTIME_PERIOD_SECONDS = 5 * 60;
export const NBA_REGULATION_PERIODS = 4;

export type NBAClockPhase = 'REGULATION' | 'OVERTIME' | 'FINAL';

export interface NBAPeriodTransition {
  state: NBAEventGameState;
  phase: NBAClockPhase;
  periodEnded: boolean;
  gameEnded: boolean;
  overtimeStarted: boolean;
  nextPeriod?: number;
}

export function nbaClockPhase(state: NBAEventGameState): NBAClockPhase {
  if (state.periodSecondsRemaining > 0) return state.period <= NBA_REGULATION_PERIODS ? 'REGULATION' : 'OVERTIME';
  if (state.period < NBA_REGULATION_PERIODS) return 'REGULATION';
  const identity = createNBAGameIdentity(state);
  if (state.scores[identity.homeTeamId] === state.scores[identity.awayTeamId]) return 'OVERTIME';
  return 'FINAL';
}

export function resolveNBAEndOfPeriod(state: NBAEventGameState): NBAPeriodTransition {
  if (state.periodSecondsRemaining > 0) {
    return Object.freeze({ state, phase: nbaClockPhase(state), periodEnded: false, gameEnded: false, overtimeStarted: false });
  }

  const identity = createNBAGameIdentity(state);
  const tied = state.scores[identity.homeTeamId] === state.scores[identity.awayTeamId];
  if (state.period < NBA_REGULATION_PERIODS) {
    const nextPeriod = state.period + 1;
    const nextState = Object.freeze({
      ...state,
      period: nextPeriod,
      periodSecondsRemaining: NBA_REGULATION_PERIOD_SECONDS,
      shotClockSeconds: 24,
    });
    return Object.freeze({ state: nextState, phase: 'REGULATION', periodEnded: true, gameEnded: false, overtimeStarted: false, nextPeriod });
  }

  if (tied) {
    const nextPeriod = state.period + 1;
    const nextState = Object.freeze({
      ...state,
      period: nextPeriod,
      periodSecondsRemaining: NBA_OVERTIME_PERIOD_SECONDS,
      shotClockSeconds: 24,
    });
    return Object.freeze({ state: nextState, phase: 'OVERTIME', periodEnded: true, gameEnded: false, overtimeStarted: true, nextPeriod });
  }

  return Object.freeze({ state, phase: 'FINAL', periodEnded: true, gameEnded: true, overtimeStarted: false });
}
