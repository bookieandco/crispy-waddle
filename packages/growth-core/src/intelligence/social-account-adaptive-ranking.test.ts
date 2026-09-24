import { describe, expect, it } from 'vitest';
import { rankCommentCandidates } from './social-account-adaptive-ranking.js';

describe('account adaptive ranking', () => {
  const signal = (targetId: string, score: number) => ({ commentId: ('comment:' + targetId) as never, accountId: 'account:pupsonstuff' as never, targetId: targetId as never, strategy: 'playful_challenge' as const, tone: 'mascot', likes: 100, replies: 20, signalScore: score, engagementRate: 0.1, conversationRate: 0.02, leadRate: 0.05, conversionRate: 0.01, recommendations: [], provenance: ['tone:mascot'] });
  const promotion = (targetAccountId: string, strategy: string, confidence: number, status: 'promoted' | 'revoked' = 'promoted') => ({
    id: 'promoted:1' as never,
    hypothesisId: 'hypothesis:1' as never,
    sourcePatternId: 'pattern:source' as never,
    sourceAccountId: 'account:source' as never,
    targetAccountId: targetAccountId as never,
    targetAudienceId: 'audience:1' as never,
    targetVoiceId: 'voice:target' as never,
    strategy,
    confidence,
    status,
    source: 'validated_experiment' as const,
    experimentId: 'experiment:1' as never,
    promotedAt: '2026-09-01T00:00:00Z',
    ...(status === 'revoked' ? { revokedAt: '2026-09-01T01:00:00Z', revocationReason: 'regression' } : {}),
  });

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

  it('uses a durable validated promotion as a target-account strategy prior', () => {
    const candidates = [
      { accountId: 'account:pupsonstuff' as never, targetId: 'target:new' as never, audienceId: 'audience:1' as never, strategy: 'playful_challenge' as const, baseScore: 0.6 },
      { accountId: 'account:pupsonstuff' as never, targetId: 'target:new-2' as never, audienceId: 'audience:1' as never, strategy: 'direct_question' as never, baseScore: 0.6 },
    ];
    const withoutPromotion = rankCommentCandidates('account:pupsonstuff' as never, candidates, []);
    const withPromotion = rankCommentCandidates('account:pupsonstuff' as never, candidates, [], [promotion('account:pupsonstuff', 'playful_challenge', 0.95)]);
    const promotedCandidate = withPromotion.find(candidate => candidate.strategy === 'playful_challenge');
    const baselineCandidate = withoutPromotion.find(candidate => candidate.strategy === 'playful_challenge');
    expect(promotedCandidate?.accountStrategyScore).toBe(0.95);
    expect(promotedCandidate?.score).toBeGreaterThan(baselineCandidate?.score ?? 0);
  });

  it('does not let another account promotion affect the selected account', () => {
    const result = rankCommentCandidates(
      'account:pupsonstuff' as never,
      [{ accountId: 'account:pupsonstuff' as never, targetId: 'target:new' as never, audienceId: 'audience:1' as never, strategy: 'playful_challenge', baseScore: 0.6 }],
      [],
      [promotion('account:other', 'playful_challenge', 0.99)],
    );
    expect(result[0].accountStrategyScore).toBe(0.5);
  });

  it('does not let a revoked promotion affect the selected account', () => {
    const baseline = rankCommentCandidates(
      'account:pupsonstuff' as never,
      [{ accountId: 'account:pupsonstuff' as never, targetId: 'target:new', audienceId: 'audience:1' as never, strategy: 'playful_challenge', baseScore: 0.6 }],
      [],
    );
    const revoked = rankCommentCandidates(
      'account:pupsonstuff' as never,
      [{ accountId: 'account:pupsonstuff' as never, targetId: 'target:new', audienceId: 'audience:1' as never, strategy: 'playful_challenge', baseScore: 0.6 }],
      [],
      [promotion('account:pupsonstuff', 'playful_challenge', 0.99, 'revoked')],
    );
    expect(revoked[0].score).toBe(baseline[0].score);
    expect(revoked[0].accountStrategyScore).toBe(0.5);
  });
});
