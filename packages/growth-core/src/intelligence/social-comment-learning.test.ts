import { describe, expect, it } from 'vitest';
import { learnFromCommentOutcome } from './social-comment-learning.js';

describe('comment learning', () => {
  it('turns downstream engagement into reusable signals', () => {
    const result = learnFromCommentOutcome({ commentId: 'comment:1' as never, accountId: 'account:1' as never, targetId: 'target:1' as never, strategy: 'soft_qualification', tone: 'mascot', impressions: 1000, likes: 100, replies: 40, profileVisits: 100, clicks: 50, qualifiedLeads: 10, conversions: 2, recordedAt: '2026-08-31T00:00:00Z' });
    expect(result.engagementRate).toBeCloseTo(0.14);
    expect(result.conversationRate).toBeCloseTo(0.04);
    expect(result.leadRate).toBeCloseTo(0.1);
    expect(result.conversionRate).toBeCloseTo(0.2);
    expect(result.recommendations).toContain('promote_pattern_to_creative_learning');
  });

  it('deprioritizes weak strategies', () => {
    const result = learnFromCommentOutcome({ commentId: 'comment:2' as never, accountId: 'account:1' as never, targetId: 'target:2' as never, strategy: 'conversation_hook', tone: 'baseline', impressions: 1000, likes: 10, replies: 0, recordedAt: '2026-08-31T00:00:00Z' });
    expect(result.signalScore).toBeLessThan(0.15);
    expect(result.recommendations).toContain('deprioritize_strategy_for_similar_targets');
  });
});
