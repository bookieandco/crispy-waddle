import { describe, expect, it } from 'vitest';
import { applyScenario, buildPlayerMatchup, DEFAULT_PLAYER_SCENARIOS, toSimulationProfile } from './player-simulation.js';
import type { ResolvedPlayerState } from './player-attributes.js';

describe('player simulation state', () => {
  const state = (playerId: string, value: number, uncertainty = 5): ResolvedPlayerState => ({
    playerId,
    sport: 'NBA',
    asOf: '2026-09-03T00:00:00Z',
    sliders: {
      finishing: {
        attribute: 'finishing', value, uncertainty,
        components: { BASE: value, RECENT_FORM: 0, MATCHUP: 0, ROLE: 0, FATIGUE: 0, PRESSURE: 0, CURRENT_STATE: 0 },
        evidenceIds: [`${playerId}-evidence`],
      },
    },
  });

  it('preserves evidence and converts resolved sliders into simulation state', () => {
    const profile = toSimulationProfile(state('C', 90));
    expect(profile.sliders.finishing).toBe(90);
    expect(profile.evidenceIds).toEqual(['C-evidence']);
  });

  it('models the opponent independently', () => {
    const matchup = buildPlayerMatchup(toSimulationProfile(state('C', 90)), toSimulationProfile(state('O', 80)));
    expect(matchup.attributeAdjustments.finishing).toBe(2.5);
  });

  it('includes an exceptional defender scenario without making it the baseline', () => {
    const matchup = buildPlayerMatchup(toSimulationProfile(state('C', 90)), toSimulationProfile(state('O', 80)));
    const baseline = applyScenario(matchup, DEFAULT_PLAYER_SCENARIOS[0]);
    const defender = applyScenario(matchup, DEFAULT_PLAYER_SCENARIOS[2]);
    expect(baseline.attributeAdjustments.finishing).toBe(2.5);
    expect(defender.attributeAdjustments.finishing).toBeLessThan(baseline.attributeAdjustments.finishing);
  });
});
