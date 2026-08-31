import { describe, expect, it } from 'vitest';
import { buildAccountLearningProfile, buildTransferablePatterns } from './social-account-learning.js';

describe('account learning', () => {
  const signal = (accountId: string, score: number) => ({ commentId: ('comment:' + accountId) as never, accountId: accountId as never, targetId: 'target:1' as never, strategy: 'playful_challenge' as const, tone: 'mascot', likes: 100, replies: 20, signalScore: score, engagementRate: 0.1, conversationRate: 0.02, leadRate: 0.05, conversionRate: 0.01, recommendations: [], provenance: ['tone:mascot'] });

  it('keeps account learning isolated', () => {
    const profile = buildAccountLearningProfile('account:pupsonstuff' as never, [signal('account:pupsonstuff', 0.9), signal('account:other', 0.99)]);
    expect(profile.strategyScores.playful_challenge).toBe(0.9);
    expect(Object.values(profile.strategyScores)).not.toContain(0.99);
  });

  it('exports only strong patterns and requires revalidation', () => {
    const patterns = buildTransferablePatterns([signal('account:pupsonstuff', 0.9), signal('account:pupsonstuff', 0.4)], 'account:pupsonstuff' as never);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].mustRevalidateOnTargetAccount).toBe(true);
  });
});
