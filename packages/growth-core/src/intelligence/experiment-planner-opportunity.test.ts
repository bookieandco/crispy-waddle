import { describe, expect, it } from 'vitest';
import type { ExperimentOpportunity } from './experiment-opportunity.js';
import { planExperimentOpportunity } from './experiment-planner.js';

const opportunity: ExperimentOpportunity = {
  id: 'experiment-opportunity:distribution-opportunity:tiktok-1',
  distributionOpportunityId: 'distribution-opportunity:tiktok-1',
  surfaceId: 'surface:tiktok',
  title: 'Test: Compact wallet UGC format',
  state: 'READY',
  score: 82,
  expectedValue: 8,
  productionDifficulty: 20,
  rationale: ['Trend 92/100'],
  hypothesis: 'If the compact wallet UGC format is adapted for the target niche and paired with the approved wallet affiliate offer, it should generate measurable demand at acceptable production cost.',
  audienceFit: 90,
  nicheRelevance: 90,
  repeatability: 88,
  creativeNovelty: 75,
  monetizationPotential: 70,
  recency: 95,
  engagementQuality: 86,
  recommendedAction: 'test',
  monetizationCandidateId: 'offer:wallet-affiliate',
  offerId: 'offer:wallet-affiliate',
};

describe('experiment opportunity planner bridge', () => {
  it('turns a qualified opportunity into a bounded experiment packet', () => {
    const plan = planExperimentOpportunity(opportunity);

    expect(plan.id).toBe('experiment-plan:experiment-opportunity:distribution-opportunity:tiktok-1');
    expect(plan.opportunityId).toBe(opportunity.id);
    expect(plan.offerId).toBe('offer:wallet-affiliate');
    expect(plan.channel).toBe('tiktok');
    expect(plan.creativeVariants).toHaveLength(5);
    expect(plan.successMetric).toBe('contribution_roas');
    expect(plan.budgetGuardrail).toBe(25);
    expect(plan.requiredEvidence).toContain('attribution');
  });

  it('preserves the human/control boundary for non-ready opportunities', () => {
    const plan = planExperimentOpportunity({ ...opportunity, state: 'NEEDS_REVIEW' });

    expect(plan.stopCondition).toContain('Do not execute until this opportunity reaches READY');
  });
});
