import type { NBAEventGameState } from './nba-event-state-machine.js';

export interface NBAGameIdentity {
  gameId: string;
  homeTeamId: string;
  awayTeamId: string;
}

export type NBAGameStatus = 'LIVE' | 'FINAL';
export type NBAPeriodPhase = 'REGULATION' | 'OVERTIME' | 'FINAL';

export interface CanonicalNBAGameStatus {
  status: NBAGameStatus;
  phase: NBAPeriodPhase;
}

export function createNBAGameIdentity(state: NBAEventGameState): NBAGameIdentity {
  const teamIds = Object.keys(state.scores);
  if (teamIds.length !== 2) throw new Error('NBA canonical game identity requires exactly two score teams');
  if (state.offenseTeamId === state.defenseTeamId) throw new Error('NBA offense and defense teams must differ');
  if (!teamIds.includes(state.offenseTeamId) || !teamIds.includes(state.defenseTeamId)) throw new Error('NBA possession teams must exist in the score map');
  const homeTeamId = teamIds[0];
  const awayTeamId = teamIds[1];
  return Object.freeze({ gameId: state.gameId, homeTeamId, awayTeamId });
}

export function resolveNBAGameStatus(state: NBAEventGameState): CanonicalNBAGameStatus {
  if (state.periodSecondsRemaining > 0) {
    return Object.freeze({ status: 'LIVE', phase: state.period <= 4 ? 'REGULATION' : 'OVERTIME' });
  }
  if (state.period < 4) return Object.freeze({ status: 'LIVE', phase: 'REGULATION' });
  const identity = createNBAGameIdentity(state);
  const tied = state.scores[identity.homeTeamId] === state.scores[identity.awayTeamId];
  if (tied) return Object.freeze({ status: 'LIVE', phase: 'OVERTIME' });
  return Object.freeze({ status: 'FINAL', phase: 'FINAL' });
}

export function assertNBAEventTeam(identity: NBAGameIdentity, teamId: string): void {
  if (teamId !== identity.homeTeamId && teamId !== identity.awayTeamId) {
    throw new Error(`NBA event team ${teamId} is not part of game ${identity.gameId}`);
  }
}
