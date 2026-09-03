import type { RandomSource } from './simulation.js';
import type { PlayerFatigueState } from './player-fatigue.js';
import { applyPlayerExertion, recoverPlayer } from './player-fatigue.js';
import type { NBAEventGameState } from './nba-event-state-machine.js';

export interface NBALivePlayerState {
  playerId: string;
  teamId: string;
  fatigue: PlayerFatigueState;
  formMultiplier: number;
  roleMultiplier: number;
  matchupMultiplier: number;
  pressureMultiplier: number;
  confidence: number;
  updatedByEventId?: string;
  evidenceIds: readonly string[];
}

export interface NBALiveStateUpdate {
  eventId: string;
  playerId: string;
  intensity: number;
  durationSeconds: number;
  formDelta?: number;
  roleDelta?: number;
  matchupDelta?: number;
  pressureDelta?: number;
  confidenceDelta?: number;
  evidenceIds: readonly string[];
  asOf: string;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function applyNBALivePlayerUpdate(
  state: NBALivePlayerState,
  update: NBALiveStateUpdate,
): NBALivePlayerState {
  if (update.playerId !== state.playerId) throw new Error('Live player update identity mismatch');
  const fatigue = applyPlayerExertion(state.fatigue, {
    eventId: update.eventId,
    playerId: update.playerId,
    intensity: update.intensity,
    durationSeconds: update.durationSeconds,
    asOf: update.asOf,
    evidenceIds: update.evidenceIds,
  });
  return Object.freeze({
    ...state,
    fatigue,
    formMultiplier: clamp(state.formMultiplier + (update.formDelta ?? 0), 0.5, 1.5),
    roleMultiplier: clamp(state.roleMultiplier + (update.roleDelta ?? 0), 0.5, 1.5),
    matchupMultiplier: clamp(state.matchupMultiplier + (update.matchupDelta ?? 0), 0.5, 1.5),
    pressureMultiplier: clamp(state.pressureMultiplier + (update.pressureDelta ?? 0), 0.5, 1.5),
    confidence: clamp(state.confidence + (update.confidenceDelta ?? 0), 0, 100),
    updatedByEventId: update.eventId,
    evidenceIds: Object.freeze([...new Set([...state.evidenceIds, ...update.evidenceIds, update.eventId])].sort()),
  });
}

export function recoverNBABenchPlayers(
  players: readonly NBALivePlayerState[],
  benchMinutes: number,
  asOf: string,
): readonly NBALivePlayerState[] {
  return Object.freeze(players.map((player) => Object.freeze({
    ...player,
    fatigue: recoverPlayer(player.fatigue, benchMinutes, asOf),
  })));
}

export interface NBALiveSimulationProfile {
  abilityMultiplier: number;
  uncertaintyMultiplier: number;
  fatigue: number;
  confidence: number;
}

export function resolveNBALiveSimulationProfile(state: NBALivePlayerState): NBALiveSimulationProfile {
  const dynamic = state.formMultiplier * state.roleMultiplier * state.matchupMultiplier * state.pressureMultiplier;
  const fatiguePenalty = clamp(1 - state.fatigue.fatigue / 100 * 0.35, 0.55, 1);
  return Object.freeze({
    abilityMultiplier: dynamic * fatiguePenalty,
    uncertaintyMultiplier: 1 + state.fatigue.fatigue / 200,
    fatigue: state.fatigue.fatigue,
    confidence: state.confidence,
  });
}

export function evolveNBAPlayersFromEvent(
  players: Readonly<Record<string, NBALivePlayerState>>,
  gameState: NBAEventGameState,
  eventId: string,
  rng: RandomSource,
  asOf: string,
): Readonly<Record<string, NBALivePlayerState>> {
  const next: Record<string, NBALivePlayerState> = { ...players };
  const activeIds = new Set([
    ...(gameState.offenseLineup?.onCourt ?? []).map((p) => p.playerId),
    ...(gameState.defenseLineup?.onCourt ?? []).map((p) => p.playerId),
  ]);
  for (const playerId of activeIds) {
    const player = next[playerId];
    if (!player) continue;
    const intensity = 35 + rng.next() * 35;
    next[playerId] = applyNBALivePlayerUpdate(player, {
      eventId,
      playerId,
      intensity,
      durationSeconds: 4,
      evidenceIds: gameState.evidenceIds,
      asOf,
    });
  }
  return Object.freeze(next);
}
