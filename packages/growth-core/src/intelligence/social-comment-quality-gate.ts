import type { GrowthId } from '../domain/types.js';
import type { CommentDraft } from './social-comment-personas.js';
import type { CommentStrategyPlan } from './social-comment-strategy.js';

export interface CommentQualityInput {
  readonly draft: CommentDraft;
  readonly strategy: CommentStrategyPlan;
  readonly contextMatchScore: number;
  readonly originalityScore: number;
  readonly valueScore: number;
  readonly spamRisk: number;
  readonly policyRisk: number;
}

export interface CommentQualityDecision {
  readonly id: GrowthId;
  readonly draftId: GrowthId;
  readonly approved: boolean;
  readonly score: number;
  readonly flags: readonly string[];
  readonly reasons: readonly string[];
  readonly requiresHumanReview: true;
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function evaluateCommentQuality(input: CommentQualityInput): CommentQualityDecision {
  const flags: string[] = [...input.draft.safetyFlags];
  const reasons: string[] = [];
  const context = clamp(input.contextMatchScore);
  const originality = clamp(input.originalityScore);
  const value = clamp(input.valueScore);
  const risk = Math.max(clamp(input.spamRisk), clamp(input.policyRisk));
  const score = clamp(context * 0.3 + originality * 0.25 + value * 0.25 + (1 - risk) * 0.2);

  if (context < 0.7) flags.push('context_mismatch');
  if (originality < 0.7) flags.push('low_originality');
  if (value < 0.6) flags.push('low_value');
  if (risk > 0.3) flags.push('elevated_policy_or_spam_risk');
  if (input.strategy.strategy === 'soft_qualification' && value < 0.7) flags.push('qualification_without_value');

  if (flags.length === 0 && score >= 0.75) reasons.push('meets quality thresholds');
  else reasons.push('requires review or regeneration');

  return {
    id: `comment-quality:${input.draft.opportunityId}` as GrowthId,
    draftId: input.draft.opportunityId,
    approved: flags.length === 0 && score >= 0.75,
    score,
    flags,
    reasons,
    requiresHumanReview: true,
  };
}
