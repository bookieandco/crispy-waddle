import { describe, expect, it } from 'vitest';
import { planGrowthExperiment } from './experiment-planner.js';
import type { GrowthOpportunity } from './opportunity-engine.js';

const opportunity: GrowthOpportunity = {
  id: 'opportunity:creative-1', key: 'creative-1', rank: 1, action: 'test', score: 500,
  expectedValue: 400, confidence: 0.8, rationale: 'Promising economics with room to learn.',
};

describe('experiment planner', () => {
  it('turns an opportunity into a bounded experiment plan', () => {
    const plan = planGrowthExperiment(opportunity);
    expect(plan.opportunityId).toBe(opportunity.id);
    expect(plan.creativeVariants).toHaveLength(3);
    expect(plan.budgetGuardrail).toBe(100);
    expect(plan.successMetric).toBe('contribution_roas');
    expect(plan.requiredEvidence).toContain('attribution');
    expect(plan.stopCondition).toContain('contribution ROAS');
  });
});
