import { describe, expect, it } from 'vitest';
import { createCommentDraft, scoreCommentOpportunity } from './social-comment-personas.js';

describe('social comment personas', () => {
  it('scores relevant, fresh, low-risk opportunities higher', () => {
    expect(scoreCommentOpportunity({ id: '1' as never, postId: 'p1' as never, accountId: 'a1' as never, relevance: 1, audienceFit: 1, freshness: 1, risk: 0, context: 'relevant post' })).toBeGreaterThan(0.9);
  });

  it('requires review for high-flirtation or risky contexts', () => {
    const draft = createCommentDraft({ accountId: 'a1' as never, platform: 'instagram', brand: 'PupsonStuff', tone: ['playful', 'witty'], vocabulary: ['paws', 'good boy'], humorLevel: 0.8, flirtationLevel: 0.8, maxDailyComments: 10, requireApproval: false }, { id: '1' as never, postId: 'p1' as never, accountId: 'a1' as never, relevance: 0.9, audienceFit: 0.9, freshness: 0.9, risk: 0, context: 'public brand post' }, 'That post has some serious paw-tential.');
    expect(draft.requiresApproval).toBe(true);
    expect(draft.safetyFlags).toContain('high_flirtation_review');
  });
});
