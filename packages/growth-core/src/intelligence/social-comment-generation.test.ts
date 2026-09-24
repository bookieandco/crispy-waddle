import { describe, expect, it } from 'vitest';
import { generateGovernedComment } from './social-comment-generation.js';

describe('governed social comment generation', () => {
  const persona = { accountId: 'acct:1' as never, platform: 'instagram', brand: 'pupsonstuff', tone: ['playful'] as const, vocabulary: ['paws'], humorLevel: 0.8, flirtationLevel: 0.2, maxDailyComments: 10, requireApproval: true };
  const opportunity = { id: 'opp:1' as never, postId: 'post:1' as never, accountId: 'acct:1' as never, relevance: 1, audienceFit: 1, freshness: 1, risk: 0, context: 'dog post' };
  const voice = { accountId: 'acct:1' as never, platform: 'instagram', baseVoiceId: 'voice:1' as never, persona: { accountId: 'acct:1' as never, platform: 'instagram', baseVoiceId: 'voice:1' as never, traits: {}, vocabulary: ['paws'], tone: 'playful' as const, characterDescription: 'dog' }, relevantMemories: [], instructions: [] };
  const generator = { generate: async () => 'That dog understood the assignment 🐾' };

  it('generates a draft through the governed persona', async () => {
    const draft = await generateGovernedComment({ opportunity, persona, voice, generator });
    expect(draft.text).toContain('assignment');
    expect(draft.requiresApproval).toBe(true);
  });

  it('rejects cross-account context', async () => {
    await expect(generateGovernedComment({ opportunity: { ...opportunity, accountId: 'acct:2' as never }, persona, voice, generator })).rejects.toThrow('identity_mismatch');
  });
});
