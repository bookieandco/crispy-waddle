import type { GrowthId } from '../domain/types.js';
import { scoreCommentOpportunity, type CommentOpportunity } from './social-comment-personas.js';
import type { CommentEngagementScore } from './social-engagement-attribution.js';

export interface BuyerSignal {
  readonly opportunityId: GrowthId;
  readonly intent: number;
  readonly recency: number;
  readonly fit: number;
  readonly evidence: readonly string[];
}

export interface PrioritizedEngagement {
  readonly opportunityId: GrowthId;
  readonly opportunityScore: number;
  readonly buyerIntentScore: number;
  readonly engagementValue: number;
  readonly priorityScore: number;
  readonly reasons: readonly string[];
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function prioritizeSocialEngagement(opportunity: CommentOpportunity, buyer: BuyerSignal | undefined, historical: CommentEngagementScore | undefined): PrioritizedEngagement {
  const opportunityScore = scoreCommentOpportunity(opportunity);
  const buyerIntentScore = buyer ? clamp(buyer.intent * 0.5 + buyer.recency * 0.2 + buyer.fit * 0.3) : 0;
  const engagementValue = historical ? clamp(historical.intentScore * 0.45 + historical.conversionScore * 0.55) : 0;
  const priorityScore = clamp(opportunityScore * 0.35 + buyerIntentScore * 0.45 + engagementValue * 0.2);
  const reasons = [
    ...(opportunity.audienceFit >= 0.7 ? ['strong_audience_fit'] : []),
    ...(buyerIntentScore >= 0.6 ? ['active_buyer_signal'] : []),
    ...(engagementValue >= 0.5 ? ['historically_commercial_engagement'] : []),
    ...(opportunity.freshness >= 0.8 ? ['fresh_conversation'] : []),
  ];
  return { opportunityId: opportunity.id, opportunityScore, buyerIntentScore, engagementValue, priorityScore, reasons };
}
