import type { Sport } from './contracts.js';
import type { ResolvedPlayerState } from './player-attributes.js';

export type PlayerSimulationDimension = 'BASE' | 'FORM' | 'MATCHUP' | 'FATIGUE' | 'PRESSURE' | 'ROLE' | 'VARIANCE';

export interface PlayerSimulationProfile {
  playerId: string;
  sport: Sport;
  asOf: string;
  sliders: Readonly<Record<string, number>>;
  uncertainty: number;
  dimensions: Readonly<Record<PlayerSimulationDimension, number>>;
  evidenceIds: readonly string[];
}

export interface PlayerSimulationMatchup {
  attacker: PlayerSimulationProfile;
  defender: PlayerSimulationProfile;
  attributeAdjustments: Readonly<Record<string, number>>;
  combinedUncertainty: number;
  upsideScenarioWeight: number;
  downsideScenarioWeight: number;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function average(values: readonly number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function toSimulationProfile(state: ResolvedPlayerState): PlayerSimulationProfile {
  const sliders: Record<string, number> = {};
  const evidence = new Set<string>();
  const values = Object.values(state.sliders);
  for (const [key, slider] of Object.entries(state.sliders)) {
    sliders[key] = clamp(slider.value);
    slider.evidenceIds.forEach((id) => evidence.add(id));
  }

  const uncertainty = average(values.map((value) => value.uncertainty));
  const base = average(values.map((value) => value.components.BASE));
  const form = average(values.map((value) => value.components.RECENT_FORM));
  const matchup = average(values.map((value) => value.components.MATCHUP));
  const fatigue = average(values.map((value) => value.components.FATIGUE));
  const pressure = average(values.map((value) => value.components.PRESSURE));
  const role = average(values.map((value) => value.components.ROLE));

  return Object.freeze({
    playerId: state.playerId,
    sport: state.sport,
    asOf: state.asOf,
    sliders: Object.freeze(sliders),
    uncertainty,
    dimensions: Object.freeze({ BASE: base, FORM: form, MATCHUP: matchup, FATIGUE: fatigue, PRESSURE: pressure, ROLE: role, VARIANCE: uncertainty }),
    evidenceIds: Object.freeze([...evidence].sort()),
  });
}

export function buildPlayerMatchup(attacker: PlayerSimulationProfile, defender: PlayerSimulationProfile): PlayerSimulationMatchup {
  if (attacker.sport !== defender.sport) throw new Error('Player matchup requires the same sport');
  const attributeAdjustments: Record<string, number> = {};
  const keys = new Set([...Object.keys(attacker.sliders), ...Object.keys(defender.sliders)]);
  for (const key of [...keys].sort()) {
    const attack = attacker.sliders[key] ?? 50;
    const defense = defender.sliders[key] ?? 50;
    attributeAdjustments[key] = Math.max(-20, Math.min(20, (attack - defense) * 0.25));
  }

  // Upside/downside are scenario weights, not predictions. Uncertainty keeps exceptional
  // player nights alive instead of collapsing every simulation toward the mean.
  const combinedUncertainty = Math.min(100, (attacker.uncertainty + defender.uncertainty) / 2);
  const attackerVariance = clamp(attacker.uncertainty / 30, 0, 1);
  const defenderVariance = clamp(defender.uncertainty / 30, 0, 1);

  return Object.freeze({
    attacker,
    defender,
    attributeAdjustments: Object.freeze(attributeAdjustments),
    combinedUncertainty,
    upsideScenarioWeight: Math.min(1, 0.10 + attackerVariance * 0.20 + defenderVariance * 0.10),
    downsideScenarioWeight: Math.min(1, 0.10 + defenderVariance * 0.20 + attackerVariance * 0.10),
  });
}

export interface PlayerScenario {
  label: 'BASELINE' | 'ATTACKER_HOT' | 'DEFENDER_ON_FIRE' | 'BOTH_ELITE' | 'BOTH_REGRESS';
  attackerMultiplier: number;
  defenderMultiplier: number;
}

export const DEFAULT_PLAYER_SCENARIOS: readonly PlayerScenario[] = Object.freeze([
  Object.freeze({ label: 'BASELINE', attackerMultiplier: 1, defenderMultiplier: 1 }),
  Object.freeze({ label: 'ATTACKER_HOT', attackerMultiplier: 1.08, defenderMultiplier: 0.98 }),
  Object.freeze({ label: 'DEFENDER_ON_FIRE', attackerMultiplier: 0.94, defenderMultiplier: 1.08 }),
  Object.freeze({ label: 'BOTH_ELITE', attackerMultiplier: 1.07, defenderMultiplier: 1.07 }),
  Object.freeze({ label: 'BOTH_REGRESS', attackerMultiplier: 0.95, defenderMultiplier: 0.95 }),
]);

export function applyScenario(matchup: PlayerSimulationMatchup, scenario: PlayerScenario): PlayerSimulationMatchup {
  const adjustments: Record<string, number> = {};
  for (const [key, value] of Object.entries(matchup.attributeAdjustments)) {
    const adjusted = value * (scenario.attackerMultiplier / scenario.defenderMultiplier);
    adjustments[key] = Math.max(-20, Math.min(20, adjusted));
  }
  return Object.freeze({
    ...matchup,
    attributeAdjustments: Object.freeze(adjustments),
  });
}
