import type { Sport } from './contracts.js';
import type { ResolvedPlayerState } from './player-attributes.js';
import { aggregateMatchupAdjustment, resolveSportMatchup } from './player-matchup-rules.js';

export type PlayerSimulationDimension = 'BASE' | 'FORM' | 'MATCHUP' | 'FATIGUE' | 'PRESSURE' | 'ROLE' | 'VARIANCE';
export interface PlayerSimulationProfile { playerId: string; sport: Sport; asOf: string; sliders: Readonly<Record<string, number>>; uncertainty: number; dimensions: Readonly<Record<PlayerSimulationDimension, number>>; evidenceIds: readonly string[]; }
export interface PlayerSimulationMatchup { attacker: PlayerSimulationProfile; defender: PlayerSimulationProfile; attributeAdjustments: Readonly<Record<string, number>>; combinedUncertainty: number; upsideScenarioWeight: number; downsideScenarioWeight: number; }

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value));
const average = (values: readonly number[]): number => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

export function toSimulationProfile(state: ResolvedPlayerState): PlayerSimulationProfile {
  const sliders: Record<string, number> = {};
  const evidence = new Set<string>();
  const values = Object.values(state.sliders);
  for (const [key, slider] of Object.entries(state.sliders)) { sliders[key] = clamp(slider.value); slider.evidenceIds.forEach((id) => evidence.add(id)); }
  const uncertainty = average(values.map((v) => v.uncertainty));
  return Object.freeze({
    playerId: state.playerId, sport: state.sport, asOf: state.asOf,
    sliders: Object.freeze(sliders), uncertainty,
    dimensions: Object.freeze({
      BASE: average(values.map((v) => v.components.BASE)), FORM: average(values.map((v) => v.components.RECENT_FORM)),
      MATCHUP: average(values.map((v) => v.components.MATCHUP)), FATIGUE: average(values.map((v) => v.components.FATIGUE)),
      PRESSURE: average(values.map((v) => v.components.PRESSURE)), ROLE: average(values.map((v) => v.components.ROLE)), VARIANCE: uncertainty,
    }),
    evidenceIds: Object.freeze([...evidence].sort()),
  });
}

export function buildPlayerMatchup(attacker: PlayerSimulationProfile, defender: PlayerSimulationProfile): PlayerSimulationMatchup {
  if (attacker.sport !== defender.sport) throw new Error('Player matchup requires the same sport');
  const rules = resolveSportMatchup(attacker, defender);
  const attributeAdjustments: Record<string, number> = {};
  for (const rule of rules) attributeAdjustments[rule.attackerAttribute] = (attributeAdjustments[rule.attackerAttribute] ?? 0) + rule.adjustment;
  const combinedUncertainty = Math.min(100, (attacker.uncertainty + defender.uncertainty) / 2);
  const attackerVariance = clamp(attacker.uncertainty / 30, 0, 1);
  const defenderVariance = clamp(defender.uncertainty / 30, 0, 1);
  return Object.freeze({ attacker, defender, attributeAdjustments: Object.freeze(attributeAdjustments), combinedUncertainty,
    upsideScenarioWeight: Math.min(1, 0.10 + attackerVariance * 0.20 + defenderVariance * 0.10),
    downsideScenarioWeight: Math.min(1, 0.10 + defenderVariance * 0.20 + attackerVariance * 0.10) });
}

export interface PlayerScenario { label: 'BASELINE' | 'ATTACKER_HOT' | 'DEFENDER_ON_FIRE' | 'BOTH_ELITE' | 'BOTH_REGRESS'; attackerMultiplier: number; defenderMultiplier: number; }
export const DEFAULT_PLAYER_SCENARIOS: readonly PlayerScenario[] = Object.freeze([
  Object.freeze({ label: 'BASELINE', attackerMultiplier: 1, defenderMultiplier: 1 }),
  Object.freeze({ label: 'ATTACKER_HOT', attackerMultiplier: 1.08, defenderMultiplier: 0.98 }),
  Object.freeze({ label: 'DEFENDER_ON_FIRE', attackerMultiplier: 0.94, defenderMultiplier: 1.08 }),
  Object.freeze({ label: 'BOTH_ELITE', attackerMultiplier: 1.07, defenderMultiplier: 1.07 }),
  Object.freeze({ label: 'BOTH_REGRESS', attackerMultiplier: 0.95, defenderMultiplier: 0.95 }),
]);

export function applyScenario(matchup: PlayerSimulationMatchup, scenario: PlayerScenario): PlayerSimulationMatchup {
  const adjustments: Record<string, number> = {};
  for (const [key, value] of Object.entries(matchup.attributeAdjustments)) adjustments[key] = Math.max(-20, Math.min(20, value * (scenario.attackerMultiplier / scenario.defenderMultiplier)));
  return Object.freeze({ ...matchup, attributeAdjustments: Object.freeze(adjustments) });
}

export function sportMatchupAdjustment(attacker: PlayerSimulationProfile, defender: PlayerSimulationProfile): number {
  return aggregateMatchupAdjustment(resolveSportMatchup(attacker, defender));
}
