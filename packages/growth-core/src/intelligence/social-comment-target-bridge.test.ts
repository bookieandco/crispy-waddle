import { describe, expect, it } from 'vitest';
import { buildTargetAwareCommentPlan } from './social-comment-target-bridge.js';

describe('target-aware comment bridge', () => {
  const target = { id: 'target-opportunity:1' as never, targetId: 'post:1' as never, audienceId: 'audience:1' as never, score: 0.9, reasons: [], objective: 'attention' as const, requiresHumanReview: true as const };
  const opportunity = { id: 'comment:1' as never, postId: 'post:1' as never, accountId: 'account:pupsonstuff' as never, relevance: 0.9, audienceFit: 0.9, freshness: 0.9, risk: 0.1, context: 'dog post' };
  const persona = { accountId: 'account:pupsonstuff' as never, platform: 'instagram', brand: 'PupsonStuff', tone: ['playful'] as const, vocabulary: ['dog'], humorLevel: 0.9, flirtationLevel: 0.2, maxDailyComments: 10, requireApproval: true };

  it('turns a target opportunity into a strategy-bearing comment plan', () => {
    const plan = buildTargetAwareCommentPlan({ id: 'request:1' as never, target, opportunity, persona, voice: { accountId: persona.accountId, platform: persona.platform } as never, generator: { generate: async () => 'draft' } });
    expect(plan.strategy.strategy).toBe('playful_challenge');
    expect(plan.objective).toBe('attention');
    expect(plan.targetId).toBe('post:1');
  });

  it('rejects a target/post mismatch', () => {
    expect(() => buildTargetAwareCommentPlan({ id: 'request:2' as never, target, opportunity: { ...opportunity, postId: 'post:wrong' as never }, persona, voice: { accountId: persona.accountId, platform: persona.platform } as never, generator: { generate: async () => 'draft' } })).toThrow('TARGET_COMMENT_CONTEXT_MISMATCH');
  });
});
