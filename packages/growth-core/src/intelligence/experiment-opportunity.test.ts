import { describe, expect, it } from 'vitest';
import { assembleExperimentOpportunity, assembleExperimentOpportunities } from './experiment-opportunity.js';
import type { DistributionOpportunity } from './distribution-opportunity.js';

const distributionOpportunity: DistributionOpportunity = {
  id: 'distribution-opportunity:tiktok-1',
  surfaceId: 'surface:tiktok',
  title: 'Compact wallet UGC format',
  rationale: 'Accelerating format with strong audience fit.',
  score: 82,
  reach: 80,
  audienceFit: 90,
  intent: 75,
  trend: 92,
  competition: 40,
  costEfficiency: 85,
  conversionPotential: 70,
  evidenceSignalIds: ['signal:tiktok-1'],
  recommendedAction: 'test',
};

const monetization = {
  id: 'offer:wallet-affiliate',
  kind: 'affiliate' as const,
  name: 'Wallet affiliate offer',
  expectedRevenuePerConversion: 80,
  expectedConversionRate: 0.04,
  productionCost: 8,
  evidenceQuality: 85,
  approved: true,
};

describe('experiment opportunity assembly', () => {
  it('converts a distribution opportunity into a monetizable experiment candidate', () => {
    const result = assembleExperimentOpportunity({
      opportunity: distributionOpportunity,
      monetization,
      nicheRelevance: 90,
      repeatability: 88,
      creativeNovelty: 75,
      productionDifficulty: 20,
      recency: 95,
      engagementQuality: 86,
    });

    expect(result.id).toBe('experiment-opportunity:distribution-opportunity:tiktok-1');
    expect(result.distributionOpportunityId).toBe(distributionOpportunity.id);
    expect(result.monetizationCandidateId).toBe(monetization.id);
    expect(result.expectedValue).toBeCloseTo(-4.8);
    expect(result.score).toBeGreaterThan(70);
    expect(result.state).toBe('READY');
    expect(result.recommendedAction).toBe('test');
  });

  it('does not mark a high-scoring opportunity ready without approved monetization evidence', () => {
    const result = assembleExperimentOpportunity({
      opportunity: distributionOpportunity,
      nicheRelevance: 95,
      repeatability: 95,
      creativeNovelty: 90,
      productionDifficulty: 10,
      recency: 95,
      engagementQuality: 95,
    });

    expect(result.score).toBeGreaterThan(70);
    expect(result.state).toBe('NEEDS_REVIEW');
    expect(result.recommendedAction).toBe('hold');
  });

  it('ranks assembled opportunities by score', () => {
    const results = assembleExperimentOpportunities([
      { opportunity: distributionOpportunity, monetization },
      { opportunity: { ...distributionOpportunity, id: 'distribution-opportunity:lower', trend: 20, score: 30 } },
    ]);

    expect(results[0].distributionOpportunityId).toBe(distributionOpportunity.id);
    expect(results[1].distributionOpportunityId).toBe('distribution-opportunity:lower');
  });
});
