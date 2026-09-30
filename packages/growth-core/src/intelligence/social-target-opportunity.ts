import type { GrowthId } from '../domain/types.js';
import type { TrendBuyerConvergence } from './trend-buyer-convergence.js';

export interface SocialTargetObservation {
  readonly targetId: GrowthId;
  readonly audienceId: GrowthId;
  readonly relevanceScore: number;
  readonly engagementPotential: number;
  readonly buyerIntentScore: number;
  readonly recentActivityScore: number;
  readonly alreadyContacted: boolean;
}

export interface SocialTargetOpportunity {
  readonly id: GrowthId;
  readonly targetId: GrowthId;
  readonly audienceId: GrowthId;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly objective: 'conversation' | 'attention' | 'qualified_lead';
  readonly requiresHumanReview: true;
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function scoreSocialTargetOpportunity(convergence: TrendBuyerConvergence, target: SocialTargetObservation): SocialTargetOpportunity | null {
  if (target.alreadyContacted) return null;
  const score = clamp(
    (clamp(convergence.convergenceScore) * 0.30) +
    (clamp(target.relevanceScore) * 0.25) +
    (clamp(target.engagementPotential) * 0.20) +
    (clamp(target.buyerIntentScore) * 0.20) +
    (clamp(target.recentActivityScore) * 0.05),
  );
  const objective = target.buyerIntentScore >= 0.75 ? 'qualified_lead' : target.engagementPotential >= 0.7 ? 'attention' : 'conversation';
  return {
    id: `target-opportunity:${target.targetId}:${convergence.trendId}` as GrowthId,
    targetId: target.targetId,
    audienceId: target.audienceId,
    score,
    reasons: [
      `trend_buyer_convergence:${convergence.convergenceScore.toFixed(3)}`,
      `relevance:${target.relevanceScore.toFixed(3)}`,
      `engagement_potential:${target.engagementPotential.toFixed(3)}`,
      `buyer_intent:${target.buyerIntentScore.toFixed(3)}`,
      `recent_activity:${target.recentActivityScore.toFixed(3)}`,
    ],
    objective,
    requiresHumanReview: true,
  };
}
