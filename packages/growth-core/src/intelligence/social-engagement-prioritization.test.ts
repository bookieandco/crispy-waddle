import { describe, expect, it } from 'vitest';
import { prioritizeSocialEngagement } from './social-engagement-prioritization.js';

describe('social engagement prioritization', () => {
  it('prioritizes active buyer signals over attention alone', () => {
    const opportunity = { id: 'opp:1' as never, postId: 'post:1' as never, accountId: 'acct:1' as never, relevance: 0.8, audienceFit: 0.9, freshness: 0.9, risk: 0.1, context: 'product discussion' };
    const result = prioritizeSocialEngagement(opportunity, { opportunityId: opportunity.id, intent: 0.95, recency: 0.9, fit: 0.9, evidence: ['asked where to buy'] }, undefined);
    expect(result.priorityScore).toBeGreaterThan(0.7);
    expect(result.reasons).toContain('active_buyer_signal');
  });
});
