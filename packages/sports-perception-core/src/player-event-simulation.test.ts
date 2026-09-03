import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPlayerMatchup, toSimulationProfile } from './player-simulation.js';
import { resolvePlayerEventContest } from './player-event-simulation.js';
import type { ResolvedPlayerState } from './player-attributes.js';

describe('player event contest', () => {
  const state = (playerId: string, value: number): ResolvedPlayerState => ({
    playerId,
    sport: 'NBA',
    asOf: '2026-09-03T00:00:00Z',
    sliders: {
      finishing: {
        attribute: 'finishing', value, uncertainty: 5,
        components: { BASE: value, RECENT_FORM: 0, MATCHUP: 0, ROLE: 0, FATIGUE: 0, PRESSURE: 0, CURRENT_STATE: 0 },
        evidenceIds: [`${playerId}-evidence`],
      },
    },
  });

  it('moves event probability in the matchup direction', () => {
    const matchup = buildPlayerMatchup(toSimulationProfile(state('C', 95)), toSimulationProfile(state('O', 70)));
    const resolved = resolvePlayerEventContest({ eventId: 'game-1:possession-1', outcome: 'made', attribute: 'finishing', baseProbability: 0.5, matchup });
    assert.ok(resolved.resolvedProbability > resolved.baseProbability);
    assert.deepEqual(resolved.evidenceIds, ['C-evidence', 'O-evidence']);
  });

  it('keeps probabilities bounded', () => {
    const matchup = buildPlayerMatchup(toSimulationProfile(state('C', 100)), toSimulationProfile(state('O', 0)));
    const resolved = resolvePlayerEventContest({ eventId: 'game-1:possession-2', outcome: 'made', attribute: 'finishing', baseProbability: 0.999, matchup, scenarioAdjustment: 5 });
    assert.ok(resolved.resolvedProbability >= 0 && resolved.resolvedProbability <= 1);
  });
});
