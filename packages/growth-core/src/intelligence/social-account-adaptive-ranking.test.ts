import { describe, expect, it } from 'vitest';
import { rankCommentCandidates } from './social-account-adaptive-ranking.js';

describe('account adaptive ranking', () => {
  const signal = (targetId: string, score: number) => ({ commentId: ('comment:' + targetId) as never, accountId: 'account:pupsonstuff' as never, targetId: targetId as never, strategy: 'playful_challenge' as const, tone: 'mascot', likes: 100, replies: 20, signalScore: score, engagementRate: 0.1, conversationRate: 0.02, leadRate: 0.05, conversionRate: 0.01, recommendations: [], provenance: ['tone:mascot'] });
  it('ranks candidates using the selected account history', () => {
    const result = rankCommentCandidates('account:pupsonstuff' as never, [
      { accountId: 'account:pupsonstuff' as never, targetId: 'target:strong' as never, audienceId: 'audience:1' as never, strategy: 'playful_challenge', baseScore: 0.7 },
      { accountId: 'account:pupsonstuff' as never, targetId: 'target:weak' as never, audienceId: 'audience:1' as never, strategy: 'playful_challenge', baseScore: 0.7 },
      { accountId: 'account:other' as never, targetId: 'target:other' as never, audienceId: 'audience:1' as never, strategy: 'playful_challenge', baseScore: 1 },
    ], [signal('target:strong', 0.95), signal('target:weak', 0.1)]);
    expect(result).toHaveLength(2);
    expect(result[0].targetId).toBe('target:strong');
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
  });
});
