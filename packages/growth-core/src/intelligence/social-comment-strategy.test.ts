import { describe, expect, it } from 'vitest';
import { chooseCommentStrategy } from './social-comment-strategy.js';

describe('comment strategy', () => {
  const target = { id: 'target-opportunity:1' as never, targetId: 'target:1' as never, audienceId: 'audience:1' as never, score: 0.9, reasons: [], objective: 'attention' as const, requiresHumanReview: true as const };
  const opportunity = { id: 'comment:1' as never, postId: 'post:1' as never, accountId: 'account:1' as never, relevance: 0.9, audienceFit: 0.9, freshness: 0.9, risk: 0.1, context: 'relevant post' };

  it('selects playful challenge for attention opportunities', () => expect(chooseCommentStrategy(target, opportunity).strategy).toBe('playful_challenge'));
  it('selects soft qualification for high buyer intent', () => expect(chooseCommentStrategy({ ...target, objective: 'qualified_lead' }, opportunity).strategy).toBe('soft_qualification'));
  it('falls back to value add when context risk is elevated', () => expect(chooseCommentStrategy(target, { ...opportunity, risk: 0.8 }).strategy).toBe('value_add'));
});
