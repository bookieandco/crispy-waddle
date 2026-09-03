import type { NBALineupState } from './nba-lineup-state.js';

export interface NBAPossessionContextInput {
  offense: NBALineupState;
  defense: NBALineupState;
  ballHandlerId: string;
  primaryDefenderId: string;
}

export interface NBAPossessionContext {
  ballHandlerId: string;
  primaryDefenderId: string;
  usageShare: number;
  offenseFatigue: number;
  defenseFatigue: number;
  offenseFoulPressure: number;
  defenseFoulPressure: number;
  offensiveLineupFactor: number;
  defensiveLineupFactor: number;
  turnoverFactor: number;
  foulFactor: number;
  evidenceIds: readonly string[];
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export function resolveNBAPossessionContext(input: NBAPossessionContextInput): NBAPossessionContext {
  if (input.offense.onCourt.length !== 5 || input.defense.onCourt.length !== 5) {
    throw new Error('NBA possession requires five players on each side');
  }

  const handler = input.offense.onCourt.find((p) => p.playerId === input.ballHandlerId);
  const defender = input.defense.onCourt.find((p) => p.playerId === input.primaryDefenderId);
  if (!handler) throw new Error('Ball handler must be on the offensive lineup');
  if (!defender) throw new Error('Primary defender must be on the defensive lineup');

  const offenseFatigue = input.offense.onCourt.reduce((sum, p) => sum + p.fatigue, 0) / 5;
  const defenseFatigue = input.defense.onCourt.reduce((sum, p) => sum + p.fatigue, 0) / 5;
  const offenseFoulPressure = input.offense.onCourt.reduce((sum, p) => sum + Math.max(0, p.personalFouls - 3), 0) / 5;
  const defenseFoulPressure = input.defense.onCourt.reduce((sum, p) => sum + Math.max(0, p.personalFouls - 3), 0) / 5;
  const totalUsage = input.offense.onCourt.reduce((sum, p) => sum + Math.max(0, p.targetMinutes ?? 0), 0);
  const usageShare = totalUsage > 0 ? clamp((handler.targetMinutes ?? 0) / totalUsage, 0, 1) : 0.2;

  const offensiveLineupFactor = clamp(1 - offenseFatigue * 0.002 + defenseFatigue * 0.0015, 0.7, 1.3);
  const defensiveLineupFactor = clamp(1 - defenseFatigue * 0.002 + offenseFatigue * 0.001, 0.7, 1.3);
  const turnoverFactor = clamp(1 + offenseFatigue * 0.004 + offenseFoulPressure * 0.03, 0.8, 1.7);
  const foulFactor = clamp(1 + defenseFatigue * 0.004 + defenseFoulPressure * 0.04, 0.8, 1.8);

  const evidenceIds = Object.freeze(
    [...input.offense.onCourt, ...input.defense.onCourt]
      .map((player) => `${player.teamId}:${player.playerId}`)
      .sort(),
  );

  return Object.freeze({
    ballHandlerId: handler.playerId,
    primaryDefenderId: defender.playerId,
    usageShare,
    offenseFatigue,
    defenseFatigue,
    offenseFoulPressure,
    defenseFoulPressure,
    offensiveLineupFactor,
    defensiveLineupFactor,
    turnoverFactor,
    foulFactor,
    evidenceIds,
  });
}
