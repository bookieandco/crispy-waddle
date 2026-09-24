import { describe, expect, it } from 'vitest';
import { scoreSocialTargetOpportunity } from './social-target-opportunity.js';

describe('social target opportunity', () => {
  const convergence = { id: 'convergence:1' as never, trendId: 'cluster:1' as never, buyerIntentScore: 0.85, trendScore: 0.9, convergenceScore: 0.88, audienceIds: ['audience:1' as never], rationale: [], requiresHumanReview: true };

  it('prioritizes active, relevant buyers', () => {
    const result = scoreSocialTargetOpportunity(convergence, { targetId: 'target:1' as never, audienceId: 'audience:1' as never, relevanceScore: 0.95, engagementPotential: 0.8, buyerIntentScore: 0.9, recentActivityScore: 0.9, alreadyContacted: false });
    expect(result?.objective).toBe('qualified_lead');
    expect(result?.score).toBeGreaterThan(0.8);
  });

  it('does not repeatedly target an already-contacted account', () => {
    expect(scoreSocialTargetOpportunity(convergence, { targetId: 'target:2' as never, audienceId: 'audience:1' as never, relevanceScore: 1, engagementPotential: 1, buyerIntentScore: 1, recentActivityScore: 1, alreadyContacted: true })).toBeNull();
  });
});
