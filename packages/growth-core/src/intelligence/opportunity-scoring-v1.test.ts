import { describe, expect, it } from 'vitest';
import { opportunityScoringWeightsV1, scoreOpportunityV1 } from './opportunity-scoring-v1.js';

const base = {
  id: 'distribution-opportunity:test',
  surfaceId: 'social:tiktok',
  topic: 'UGC wallet format',
  observedAt: '2026-08-28T00:00:00.000Z',
} as const;

const zero = () => ({
  ...base,
  velocity: 0,
  engagementQuality: 0,
  recency: 0,
  repeatability: 0,
  nicheRelevance: 0,
  creativeNovelty: 0,
  monetizationPotential: 0,
  productionDifficulty: 0,
});

describe('Opportunity Scoring v1', () => {
  it('uses all eight dimensions and returns a deterministic score', () => {
    const result = scoreOpportunityV1({
      ...base,
      velocity: 90,
      engagementQuality: 80,
      recency: 95,
      repeatability: 85,
      nicheRelevance: 90,
      creativeNovelty: 70,
      monetizationPotential: 88,
      productionDifficulty: 92,
    });

    expect(result.score).toBe(86.88);
    expect(result.breakdown.total).toBe(result.score);
    expect(result.decision).toBe('prioritize');
  });

  it.each([
    ['velocity', 0.18],
    ['engagementQuality', 0.14],
    ['recency', 0.12],
    ['repeatability', 0.12],
    ['nicheRelevance', 0.14],
    ['creativeNovelty', 0.08],
    ['monetizationPotential', 0.14],
    ['productionDifficulty', 0.08],
  ] as const)('changes only %s when that dimension changes', (dimension, weight) => {
    const input = zero();
    const baseline = scoreOpportunityV1(input);
    const changed = scoreOpportunityV1({ ...input, [dimension]: 100 });

    expect(baseline.score).toBe(0);
    expect(changed.score).toBe(Math.round(weight * 100 * 100) / 100);
    expect(changed.breakdown[dimension]).toBe(100);
  });

  it('exposes weights that sum to 1', () => {
    const weights = opportunityScoringWeightsV1();
    expect(Object.values(weights).reduce((sum, weight) => sum + weight, 0)).toBe(1);
  });

  it('clamps invalid inputs to the 0-100 range', () => {
    const result = scoreOpportunityV1({
      ...base,
      velocity: 150,
      engagementQuality: -10,
      recency: 50,
      repeatability: 50,
      nicheRelevance: 50,
      creativeNovelty: 50,
      monetizationPotential: 50,
      productionDifficulty: 50,
    });

    expect(result.breakdown.velocity).toBe(100);
    expect(result.breakdown.engagementQuality).toBe(0);
  });

  it('treats production difficulty as a positive ease-of-production score', () => {
    const easy = scoreOpportunityV1({ ...base, velocity: 70, engagementQuality: 70, recency: 70, repeatability: 70, nicheRelevance: 70, creativeNovelty: 70, monetizationPotential: 70, productionDifficulty: 100 });
    const hard = scoreOpportunityV1({ ...base, velocity: 70, engagementQuality: 70, recency: 70, repeatability: 70, nicheRelevance: 70, creativeNovelty: 70, monetizationPotential: 70, productionDifficulty: 0 });

    expect(easy.score).toBeGreaterThan(hard.score);
  });
});
