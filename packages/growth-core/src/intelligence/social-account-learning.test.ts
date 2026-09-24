import { describe, expect, it } from 'vitest';
import { buildAccountLearningProfile, buildTransferablePatterns } from './social-account-learning.js';

describe('account learning', () => {
  const signal = (accountId: string, score: number) => ({ commentId: ('comment:' + accountId) as never, accountId: accountId as never, targetId: 'target:1' as never, strategy: 'playful_challenge' as const, tone: 'mascot', likes: 100, replies: 20, signalScore: score, engagementRate: 0.1, conversationRate: 0.02, leadRate: 0.05, conversionRate: 0.01, recommendations: [], provenance: ['tone:mascot'] });

  const promotion = (targetAccountId: string, strategy = 'playful_challenge', confidence = 0.9) => ({
    id: 'promoted:1' as never,
    hypothesisId: 'hypothesis:1' as never,
    sourcePatternId: 'pattern:source' as never,
    sourceAccountId: 'account:source' as never,
    targetAccountId: targetAccountId as never,
    targetAudienceId: 'audience:target' as never,
    targetVoiceId: 'voice:target' as never,
    strategy,
    confidence,
    status: 'promoted' as const,
    source: 'validated_experiment' as const,
    experimentId: 'experiment:1' as never,
    promotedAt: '2026-09-01T00:00:00Z',
  });

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

  it('lets only durable validated promotions influence the target account strategy prior', () => {
    const profile = buildAccountLearningProfile(
      'account:target' as never,
      [signal('account:target', 0.4), signal('account:other', 0.99)],
      [promotion('account:source', 'playful_challenge', 0.95), promotion('account:target', 'playful_challenge', 0.8)],
    );
    expect(profile.strategyScores.playful_challenge).toBe(0.8);
    expect(Object.values(profile.strategyScores)).not.toContain(0.95);
  });

  it('does not import source voice into target learning', () => {
    const profile = buildAccountLearningProfile(
      'account:target' as never,
      [signal('account:target', 0.4)],
      [promotion('account:target', 'playful_challenge', 0.9)],
    );
    expect(profile.toneScores['playful_challenge:mascot']).toBe(0.4);
    expect(Object.keys(profile.toneScores)).toHaveLength(1);
  });

  it('ignores non-promoted or non-validated records', () => {
    const base = promotion('account:target', 'playful_challenge', 0.9);
    const profile = buildAccountLearningProfile('account:target' as never, [signal('account:target', 0.4)], [
      { ...base, status: 'promoted' as const, source: 'validated_experiment' as const },
    ]);
    expect(profile.strategyScores.playful_challenge).toBe(0.9);
  });
});
