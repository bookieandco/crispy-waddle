import { describe, expect, it } from 'vitest';
import { buildSocialGenerationContext } from './social-generation-routing.js';

describe('social generation routing', () => {
  const adaptation = { adaptationId: 'adaptation:1' as never, voiceProfileId: 'voice:1' as never, accountId: 'account:pupsonstuff' as never, tone: 'mascot' as const, traits: ['playful', 'mischievous'], preferredPhrases: ['good boy'], forbiddenPatterns: ['mean-spirited'], styleWeights: { intensity: 0.8, playfulness: 0.95, directness: 0.7 }, provenance: ['voice:source'], requiresHumanReview: true as const };

  it('routes a post through the account voice', () => {
    const result = buildSocialGenerationContext({ id: 'request:1' as never, mode: 'content', accountId: 'account:pupsonstuff' as never, adaptation, objective: 'publish' });
    expect(result.mode).toBe('content');
    expect(result.voiceProfileId).toBe('voice:1');
    expect(result.safetyRequirements).toContain('content_must_match_account_brand');
  });

  it('routes comments through the same voice with conversation guardrails', () => {
    const result = buildSocialGenerationContext({ id: 'request:2' as never, mode: 'comment', accountId: 'account:pupsonstuff' as never, targetId: 'post:42' as never, adaptation, objective: 'attention' });
    expect(result.mode).toBe('comment');
    expect(result.targetId).toBe('post:42');
    expect(result.safetyRequirements).toContain('comment_must_add_value_or_invite_conversation');
  });

  it('rejects cross-account routing', () => {
    expect(() => buildSocialGenerationContext({ id: 'request:3' as never, mode: 'content', accountId: 'account:other' as never, adaptation, objective: 'test' })).toThrow('GENERATION_ACCOUNT_MISMATCH');
  });
});
