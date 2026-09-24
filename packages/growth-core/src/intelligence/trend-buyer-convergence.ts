import type { GrowthId } from '../domain/types.js';
import type { TrendAssessment } from './trend-emergence.js';

export interface BuyerIntentObservation {
  readonly audienceId: GrowthId;
  readonly intentScore: number;
  readonly evidence: readonly string[];
}

export interface TrendBuyerConvergence {
  readonly id: GrowthId;
  readonly trendId: GrowthId;
  readonly buyerIntentScore: number;
  readonly trendScore: number;
  readonly convergenceScore: number;
  readonly audienceIds: readonly GrowthId[];
  readonly rationale: readonly string[];
  readonly requiresHumanReview: boolean;
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function scoreTrendBuyerConvergence(assessment: TrendAssessment, buyers: readonly BuyerIntentObservation[]): TrendBuyerConvergence {
  const buyerIntentScore = buyers.length ? buyers.reduce((sum, buyer) => sum + clamp(buyer.intentScore), 0) / buyers.length : 0;
  const trendScore = clamp((clamp(assessment.velocity / 5) * 0.45) + (clamp(assessment.acceleration / 2) * 0.35) + (assessment.sourceDiversity * 0.20));
  const convergenceScore = clamp((trendScore * 0.55) + (buyerIntentScore * 0.45)) * clamp(assessment.confidence);
  return {
    id: `convergence:${assessment.clusterId}` as GrowthId,
    trendId: assessment.clusterId,
    buyerIntentScore,
    trendScore,
    convergenceScore,
    audienceIds: buyers.map((buyer) => buyer.audienceId),
    rationale: [
      `trend_score:${trendScore.toFixed(3)}`,
      `buyer_intent:${buyerIntentScore.toFixed(3)}`,
      `confidence:${assessment.confidence.toFixed(3)}`,
    ],
    requiresHumanReview: true,
  };
}
