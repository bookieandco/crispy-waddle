import { describe, expect, it } from 'vitest';
import { applyCommentLearning } from './social-comment-adaptive-scoring.js';

describe('adaptive comment scoring', () => {
  it('boosts a target/strategy combination with strong historical results', () => {
    const result = applyCommentLearning({ targetId: 'target:1' as never, audienceId: 'audience:1' as never, strategy: 'playful_challenge', baseScore: 0.7 }, [{ commentId: 'comment:1' as never, accountId: 'account:1' as never, targetId: 'target:1' as never, strategy: 'playful_challenge', tone: 'mascot', likes: 100, replies: 20, profileVisits: 50, qualifiedLeads: 10, conversions: 2, recordedAt: '2026-08-31T00:00:00Z', signalScore: 0.9, engagementRate: 0.12, conversationRate: 0.04, leadRate: 0.2, conversionRate: 0.2, recommendations: [], provenance: [] }]);
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.adjustment).toBeGreaterThan(0);
  });

  it('penalizes weak historical results', () => {
    const result = applyCommentLearning({ targetId: 'target:2' as never, audienceId: 'audience:1' as never, strategy: 'conversation_hook', baseScore: 0.7 }, [{ commentId: 'comment:2' as never, accountId: 'account:1' as never, targetId: 'target:2' as never, strategy: 'conversation_hook', tone: 'baseline', likes: 1, replies: 0, impressions: 1000, recordedAt: '2026-08-31T00:00:00Z', signalScore: 0.05, engagementRate: 0.001, conversationRate: 0, leadRate: 0, conversionRate: 0, recommendations: [], provenance: [] }]);
    expect(result.score).toBeLessThan(0.7);
    expect(result.adjustment).toBeLessThan(0);
  });
});
