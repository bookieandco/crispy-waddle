import type { RandomSource } from './simulation.js';
import type { NBALineupState } from './nba-lineup-state.js';

export type NBAEventKind = 'POSSESSION_START' | 'PASS' | 'DRIVE' | 'SHOT' | 'FOUL' | 'FREE_THROW' | 'REBOUND' | 'TURNOVER' | 'SUBSTITUTION' | 'POSSESSION_END' | 'PERIOD_END' | 'PERIOD_START' | 'OVERTIME_START' | 'GAME_END';
export type NBAFoulKind = 'SHOOTING' | 'NON_SHOOTING' | 'OFFENSIVE' | 'TECHNICAL';
export type NBAReboundKind = 'OFFENSIVE' | 'DEFENSIVE';

export interface NBAEvent { eventId: string; sequence: number; kind: NBAEventKind; teamId: string; playerId?: string; opponentPlayerId?: string; foulKind?: NBAFoulKind; freeThrows?: number; made?: boolean; points?: 0 | 1 | 2 | 3; reboundKind?: NBAReboundKind; elapsedSeconds?: number; period?: number; evidenceIds: readonly string[]; }
export interface NBAEventPlayer { playerId: string; teamId: string; personalFouls: number; fatigue: number; eligible: boolean; }
export interface NBAEventGameState { gameId: string; period: number; periodSecondsRemaining: number; shotClockSeconds: number; offenseTeamId: string; defenseTeamId: string; scores: Readonly<Record<string, number>>; players: Readonly<Record<string, NBAEventPlayer>>; offenseLineup?: NBALineupState; defenseLineup?: NBALineupState; sequence: number; lastEventId?: string; evidenceIds: readonly string[]; }
export interface NBAEventTransition { state: NBAEventGameState; event: NBAEvent; }

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const addScore = (scores: Readonly<Record<string, number>>, teamId: string, points: number) => Object.freeze({ ...scores, [teamId]: (scores[teamId] ?? 0) + points });
const appendEvidence = (state: NBAEventGameState, ids: readonly string[]) => Object.freeze([...new Set([...state.evidenceIds, ...ids])].sort());
const playerWith = (player: NBAEventPlayer, patch: Partial<NBAEventPlayer>): NBAEventPlayer => Object.freeze({ ...player, ...patch });

export function applyNBAEvent(state: NBAEventGameState, event: NBAEvent): NBAEventGameState {
  if (event.sequence !== state.sequence + 1) throw new Error('NBA event sequence must advance exactly by one');
  if (!event.eventId.trim()) throw new Error('NBA event ID is required');
  let scores = state.scores;
  let offenseTeamId = state.offenseTeamId;
  let defenseTeamId = state.defenseTeamId;
  let shotClockSeconds = state.shotClockSeconds;
  let periodSecondsRemaining = state.periodSecondsRemaining;
  const players = { ...state.players };
  const elapsed = clamp(event.elapsedSeconds ?? 0, 0, periodSecondsRemaining);
  periodSecondsRemaining -= elapsed;
  shotClockSeconds = clamp(shotClockSeconds - elapsed, 0, 24);

  if (event.kind === 'SHOT' && event.made) {
    scores = addScore(scores, event.teamId, event.points ?? 2);
    offenseTeamId = state.defenseTeamId; defenseTeamId = state.offenseTeamId; shotClockSeconds = 24;
  } else if (event.kind === 'TURNOVER') {
    offenseTeamId = state.defenseTeamId; defenseTeamId = state.offenseTeamId; shotClockSeconds = 24;
  } else if (event.kind === 'REBOUND') {
    if (!event.reboundKind) throw new Error('Rebound kind is required');
    if (event.reboundKind === 'OFFENSIVE') { offenseTeamId = state.offenseTeamId; defenseTeamId = state.defenseTeamId; shotClockSeconds = 14; }
    else { offenseTeamId = state.defenseTeamId; defenseTeamId = state.offenseTeamId; shotClockSeconds = 24; }
  } else if (event.kind === 'FOUL' && event.playerId) {
    const player = players[event.playerId]; if (!player) throw new Error(`Unknown foul player: ${event.playerId}`);
    const fouls = player.personalFouls + 1; players[event.playerId] = playerWith(player, { personalFouls: fouls, eligible: fouls < 6 });
  } else if (event.kind === 'FREE_THROW' && event.made) scores = addScore(scores, event.teamId, 1);

  if (event.kind === 'POSSESSION_END') { offenseTeamId = state.defenseTeamId; defenseTeamId = state.offenseTeamId; shotClockSeconds = 24; }
  if (event.kind === 'PERIOD_END' || event.kind === 'GAME_END') { periodSecondsRemaining = 0; shotClockSeconds = 0; }
  if (event.kind === 'PERIOD_START' || event.kind === 'OVERTIME_START') {
    if (!event.period || event.period < 1) throw new Error('NBA period start requires a valid period');
    periodSecondsRemaining = event.period > 4 ? 300 : 720;
    shotClockSeconds = 24;
  }

  return Object.freeze({ ...state, period: event.kind === 'PERIOD_START' || event.kind === 'OVERTIME_START' ? event.period! : state.period, scores, offenseTeamId, defenseTeamId, shotClockSeconds, periodSecondsRemaining, players: Object.freeze(players), sequence: event.sequence, lastEventId: event.eventId, evidenceIds: appendEvidence(state, event.evidenceIds) });
}

export function createNBAEvent(state: NBAEventGameState, kind: NBAEventKind, fields: Omit<NBAEvent, 'eventId' | 'sequence' | 'kind'>): NBAEvent {
  return Object.freeze({ ...fields, eventId: `${state.gameId}:${state.sequence + 1}:${kind}`, sequence: state.sequence + 1, kind });
}

export function resolveMissedShotRebound(state: NBAEventGameState, rng: RandomSource, offensiveReboundProbability: number, defensiveReboundProbability: number, evidenceIds: readonly string[] = []): NBAEvent {
  const offense = clamp(offensiveReboundProbability, 0, 1); const defense = clamp(defensiveReboundProbability, 0, 1); const total = offense + defense;
  const offensiveProbability = total > 0 ? offense / total : 0; const offensive = rng.next() < offensiveProbability;
  return createNBAEvent(state, 'REBOUND', { teamId: offensive ? state.offenseTeamId : state.defenseTeamId, reboundKind: offensive ? 'OFFENSIVE' : 'DEFENSIVE', evidenceIds });
}
