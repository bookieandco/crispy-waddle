import type { GrowthId } from '../domain/types.js';

export type CommentTone = 'playful' | 'witty' | 'supportive' | 'bold' | 'professional';

export interface SocialAccountPersona {
  readonly accountId: GrowthId;
  readonly platform: string;
  readonly brand: string;
  readonly tone: readonly CommentTone[];
  readonly vocabulary: readonly string[];
  readonly humorLevel: number;
  readonly flirtationLevel: number;
  readonly maxDailyComments: number;
  readonly requireApproval: boolean;
}

export interface CommentOpportunity {
  readonly id: GrowthId;
  readonly postId: GrowthId;
  readonly accountId: GrowthId;
  readonly relevance: number;
  readonly audienceFit: number;
  readonly freshness: number;
  readonly risk: number;
  readonly context: string;
}

export interface CommentDraft {
  readonly opportunityId: GrowthId;
  readonly accountId: GrowthId;
  readonly text: string;
  readonly score: number;
  readonly requiresApproval: boolean;
  readonly safetyFlags: readonly string[];
}

export function scoreCommentOpportunity(opportunity: CommentOpportunity): number {
  const relevance = Math.max(0, Math.min(1, opportunity.relevance));
  const audienceFit = Math.max(0, Math.min(1, opportunity.audienceFit));
  const freshness = Math.max(0, Math.min(1, opportunity.freshness));
  const risk = Math.max(0, Math.min(1, opportunity.risk));
  return Math.max(0, Math.min(1, relevance * 0.4 + audienceFit * 0.35 + freshness * 0.15 + (1 - risk) * 0.1));
}

export function createCommentDraft(
  persona: SocialAccountPersona,
  opportunity: CommentOpportunity,
  text: string,
): CommentDraft {
  const safetyFlags: string[] = [];
  if (persona.flirtationLevel > 0.7) safetyFlags.push('high_flirtation_review');
  if (opportunity.risk > 0.4) safetyFlags.push('context_risk_review');
  if (text.length > 280) safetyFlags.push('length_review');

  return {
    opportunityId: opportunity.id,
    accountId: persona.accountId,
    text: text.trim(),
    score: scoreCommentOpportunity(opportunity),
    requiresApproval: persona.requireApproval || safetyFlags.length > 0,
    safetyFlags,
  };
}
