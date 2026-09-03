export type NBAPlayerAvailability = 'ON_COURT' | 'BENCH' | 'FOULED_OUT' | 'INACTIVE';

export interface NBARotationPlayer {
  playerId: string;
  teamId: string;
  availability: NBAPlayerAvailability;
  minutes: number;
  personalFouls: number;
  fatigue: number;
  usage: number;
  defensiveImpact: number;
  offensiveImpact: number;
}

export interface NBALineupState {
  teamId: string;
  players: readonly NBARotationPlayer[];
  teamFatigue: number;
  teamOffensiveImpact: number;
  teamDefensiveImpact: number;
}

export interface NBAPossessionRotationContext {
  offense: NBALineupState;
  defense: NBALineupState;
}

export interface NBAAdjustedPossessionContext {
  usageMultiplier: number;
  offensiveMultiplier: number;
  defensiveMultiplier: number;
  turnoverMultiplier: number;
  foulMultiplier: number;
  evidenceIds: readonly string[];
}

const clamp = (v: number, min = 0, max = 2): number => Math.max(min, Math.min(max, v));

export function resolveRotationPossessionContext(
  context: NBAPossessionRotationContext,
): NBAAdjustedPossessionContext {
  if (context.offense.players.length !== 5 || context.defense.players.length !== 5) {
    throw new Error('NBA possession rotation context requires exactly five players per lineup');
  }

  const offenseFatigue = context.offense.players.reduce((s, p) => s + p.fatigue, 0) / 5;
  const defenseFatigue = context.defense.players.reduce((s, p) => s + p.fatigue, 0) / 5;
  const foulTrouble = context.defense.players.reduce((s, p) => s + Math.max(0, p.personalFouls - 2), 0) / 5;

  const offenseFatiguePenalty = offenseFatigue * 0.18;
  const defenseFatiguePenalty = defenseFatigue * 0.12;
  const usageMultiplier = clamp(1 + offenseFatigue * 0.08, 0.8, 1.35);
  const offensiveMultiplier = clamp(
    1 + (context.offense.teamOffensiveImpact - context.defense.teamDefensiveImpact) / 100 - offenseFatiguePenalty + defenseFatiguePenalty,
    0.55,
    1.45,
  );
  const defensiveMultiplier = clamp(
    1 + (context.defense.teamDefensiveImpact - context.offense.teamOffensiveImpact) / 100 - defenseFatiguePenalty + offenseFatiguePenalty,
    0.55,
    1.45,
  );
  const turnoverMultiplier = clamp(1 + offenseFatigue * 0.35 + foulTrouble * 0.08, 0.75, 1.65);
  const foulMultiplier = clamp(1 + foulTrouble * 0.2 + defenseFatigue * 0.25, 0.75, 1.75);

  const evidenceIds = Object.freeze(
    [...context.offense.players, ...context.defense.players]
      .map((p) => `${p.teamId}:${p.playerId}`)
      .sort(),
  );

  return Object.freeze({
    usageMultiplier,
    offensiveMultiplier,
    defensiveMultiplier,
    turnoverMultiplier,
    foulMultiplier,
    evidenceIds,
  });
}
