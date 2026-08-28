import { describe, expect, it } from 'vitest';
import { scoreOpportunityV1 } from './opportunity-scoring-v1.js';

describe('scoreOpportunityV1', () => {
  it('promotes a fast, relevant, repeatable, monetizable opportunity', () => {
    const result = scoreOpportunityV1({
      id: 'growth:test-opportunity', velocity: 95, engagementQuality: 90, recency: 95,
      repeatability: 90, nicheRelevance: 90, creativeNovelty: 80,
      monetizationPotential: 90, productionDifficulty: 20,
    });
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.recommendation).toBe('scale');
  });

  it('penalizes difficult production and weak monetization', () => {
    const result = scoreOpportunityV1({
      id: 'growth:test-low', velocity: 50, engagementQuality: 40, recency: 40,
      repeatability: 30, nicheRelevance: 40, creativeNovelty: 40,
      monetizationPotential: 10, productionDifficulty: 95,
    });
    expect(result.recommendation).not.toBe('scale');
  });

  it('stops high policy risk', () => {
    const result = scoreOpportunityV1({
      id: 'growth:test-risk', velocity: 100, engagementQuality: 100, recency: 100,
      repeatability: 100, nicheRelevance: 100, creativeNovelty: 100,
      monetizationPotential: 100, productionDifficulty: 0, policyRisk: 90,
    });
    expect(result.recommendation).toBe('stop');
  });
});
