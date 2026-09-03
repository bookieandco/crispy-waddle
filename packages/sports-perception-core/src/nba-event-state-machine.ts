import type { RandomSource } from './simulation.js';
import type { NBALineupState } from './nba-lineup-state.js';

export type NBAEventKind =
  | 'POSSESSION_START'
  | 'PASS'
  | 'DRIVE'
  | 'SHOT'
  | 'FOUL'
  | 'FREE_THROW'
  | 'REBOUND'
  | 'TURNOVER'
  | 'SUBSTITUTION'
  | 'POSSESSION_END';

export type NBAFoulKind = 'SHOOTING' | 'NON_SHOOTING' | 'OFFENSIVE' | 'TECHNICAL';
export type NBAReboundKind = 'OFFENSIVE' | 'DEFENSIVE';

export interface NBAEvent {
  eventId: string;
  sequence: number;
  kind: NBAEventKind;
  teamId: string;
  playerId?: string;
  opponentPlayerId?: string;
  foulKind?: NBAFoulKind;
  freeThrows?: number;
  made?: boolean;
  points?: 0 | 1 | 2 | 3;
  reboundKind?: NBAReboundKind;
  elapsedSeconds?: number;
  evidenceIds: readonly string[];
}

export interface NBAEventPlayer {
  playerId: string;
  teamId: string;
  personalFouls: number;
  fatigue: number;
  eligible: boolean;
}

export interface NBAEventGameState {
  gameId: string;
  period: number;
  periodSecondsRemaining: number;
  shotClockSeconds: number;
  offenseTeamId: string;
  defenseTeamId: string;
  scores: Readonly<Record<string, number>>;
  players: Readonly<Record<string, NBAEventPlayer>>;
  offenseLineup?: NBALineupState;
  defenseLineup?: NBALineupState;
  sequence: number;
  lastEventId?: string;
  evidenceIds: readonly string[];
}

export interface NBAEventTransition {
  state: NBAEventGameState;
  event: NBAEvent;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function addScore(scores: Readonly<Record<string, number>>, teamId: string, points: number) {
  return Object.freeze({ ...scores, [teamId]: (scores[teamId] ?? 0) + points });
}

function appendEvidence(state: NBAEventGameState, ids: readonly string[]) {
  return Object.freeze([...new Set([...state.evidenceIds, ...ids])].sort());
}

function playerWith(player: NBAEventPlayer, patch: Partial<NBAEventPlayer>): NBAEventPlayer {
  return Object.freeze({ ...player, ...patch });
}

export function applyNBAEvent(state: NBAEventGameState, event: NBAEvent): NBAEventGameState {
  if (event.sequence !== state.sequence + 1) throw new Error('NBA event sequence must advance exactly by one');
  if (!event.eventId.trim()) throw new Error('NBA event ID is required');
  if (event.teamId !== state.offenseTeamId && event.kind !== 'FOUL' && event.kind !== 'FREE_THROW' && event.kind !== 'REBOUND' && event.kind !== 'SUBSTITUTION') {
    throw new Error('Event team does not match current possession');
  }

  let scores = state.scores;
  let offenseTeamId = state.offenseTeamId;
  let defenseTeamId = state.defenseTeamId;
  let shotClockSeconds = state.shotClockSeconds;
  let periodSecondsRemaining = state.periodSecondsRemaining;
  let players = { ...state.players };

  const elapsed = clamp(event.elapsedSeconds ?? 0, 0, periodSecondsRemaining);
  periodSecondsRemaining -= elapsed;
  shotClockSeconds = clamp(shotClockSeconds - elapsed, 0, 24);

  if (event.kind === 'SHOT' && event.made) {
    const points = event.points ?? 2;
    scores = addScore(scores, event.teamId, points);
    offenseTeamId = state.defenseTeamId;
    defenseTeamId = state.offenseTeamId;
    shotClockSeconds = 24;
  } else if (event.kind === 'TURNOVER') {
    offenseTeamId = state.defenseTeamId;
    defenseTeamId = state.offenseTeamId;
    shotClockSeconds = 24;
  } else if (event.kind === 'REBOUND') {
    if (!event.reboundKind) throw new Error('Rebound kind is required');
    if (event.reboundKind === 'OFFENSIVE') {
      offenseTeamId = state.offenseTeamId;
      defenseTeamId = state.defenseTeamId;
      shotClockSeconds = 14;
    } else {
      offenseTeamId = state.defenseTeamId;
      defenseTeamId = state.offenseTeamId;
      shotClockSeconds = 24;
    }
  } else if (event.kind === 'FOUL' && event.playerId) {
    const player = players[event.playerId];
    if (!player) throw new Error(`Unknown foul player: ${event.playerId}`);
    const fouls = player.personalFouls + 1;
    players[event.playerId] = playerWith(player, { personalFouls: fouls, eligible: fouls < 6 });
  } else if (event.kind === 'FREE_THROW' && event.made) {
    scores = addScore(scores, event.teamId, 1);
  }

  if (event.kind === 'POSSESSION_END') {
    offenseTeamId = state.defenseTeamId;
    defenseTeamId = state.offenseTeamId;
    shotClockSeconds = 24;
  }

  return Object.freeze({
    ...state,
    scores,
    offenseTeamId,
    defenseTeamId,
    shotClockSeconds,
    periodSecondsRemaining,
    players: Object.freeze(players),
    sequence: event.sequence,
    lastEventId: event.eventId,
    evidenceIds: appendEvidence(state, event.evidenceIds),
  });
}

export function createNBAEvent(
  state: NBAEventGameState,
  kind: NBAEventKind,
  fields: Omit<NBAEvent, 'eventId' | 'sequence' | 'kind'>,
): NBAEvent {
  return Object.freeze({
    ...fields,
    eventId: `${state.gameId}:${state.sequence + 1}:${kind}`,
    sequence: state.sequence + 1,
    kind,
  });
}

export function resolveMissedShotRebound(
  state: NBAEventGameState,
  rng: RandomSource,
  offensiveReboundProbability: number,
  defensiveReboundProbability: number,
  evidenceIds: readonly string[] = [],
): NBAEvent {
  const offense = clamp(offensiveReboundProbability, 0, 1);
  const defense = clamp(defensiveReboundProbability, 0, 1);
  const total = offense + defense;
  const offensiveProbability = total > 0 ? offense / total : 0;
  return createNBAEvent(state, 'REBOUND', {
    teamId: rng.next() < offensiveProbability ? state.offenseTeamId : state.defenseTeamId,
    reboundKind: rng.next() < offensiveProbability ? 'OFFENSIVE' : 'DEFENSIVE',
    evidenceIds,
  });
}
