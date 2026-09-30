import { describe, expect, it } from 'vitest';
import { evaluateCommentQuality } from './social-comment-quality-gate.js';

describe('comment quality gate', () => {
  const draft = { opportunityId: 'comment:1' as never, accountId: 'account:1' as never, text: 'Useful comment', score: 0.9, requiresApproval: true, safetyFlags: [] };
  const strategy = { id: 'strategy:1' as never, targetOpportunityId: 'target:1' as never, strategy: 'conversation_hook' as const, objective: 'conversation' as const, intentSignalsToUse: ['relevance'], avoid: ['spam'], requiresHumanReview: true as const };

  it('approves a high-quality low-risk draft', () => {
    const result = evaluateCommentQuality({ draft, strategy, contextMatchScore: 0.95, originalityScore: 0.9, valueScore: 0.9, spamRisk: 0.05, policyRisk: 0.05 });
    expect(result.approved).toBe(true);
    expect(result.flags).toHaveLength(0);
  });

  it('blocks risky or low-value drafts', () => {
    const result = evaluateCommentQuality({ draft, strategy: { ...strategy, strategy: 'soft_qualification', objective: 'qualified_lead' }, contextMatchScore: 0.8, originalityScore: 0.8, valueScore: 0.5, spamRisk: 0.5, policyRisk: 0.2 });
    expect(result.approved).toBe(false);
    expect(result.flags).toContain('elevated_policy_or_spam_risk');
    expect(result.flags).toContain('qualification_without_value');
  });
});
