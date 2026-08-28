import type { GrowthId, ISODateTime } from '../domain/types.js';

export interface OpportunityScoringV1Input {
  id: GrowthId;
  surfaceId: GrowthId;
  topic: string;
  observedAt: ISODateTime;
  velocity: number;
  engagementQuality: number;
  recency: number;
  repeatability: number;
  nicheRelevance: number;
  creativeNovelty: number;
  monetizationPotential: number;
  productionDifficulty: number;
  evidenceSignalIds?: readonly GrowthId[];
}

export interface OpportunityScoreBreakdown {
  velocity: number;
  engagementQuality: number;
  recency: number;
  repeatability: number;
  nicheRelevance: number;
  creativeNovelty: number;
  monetizationPotential: number;
  productionDifficulty: number;
  total: number;
}

export interface OpportunityScoringV1Result {
  opportunityId: GrowthId;
  score: number;
  breakdown: OpportunityScoreBreakdown;
  decision: 'discard' | 'monitor' | 'experiment' | 'prioritize';
}

const clamp = (value: number): number => Math.max(0, Math.min(100, value));

const WEIGHTS = {
  velocity: 0.18,
  engagementQuality: 0.14,
  recency: 0.12,
  repeatability: 0.12,
  nicheRelevance: 0.14,
  creativeNovelty: 0.08,
  monetizationPotential: 0.14,
  productionDifficulty: 0.08,
} as const;

/**
 * Opportunity Scoring v1 is intentionally deterministic.
 * Production difficulty is supplied as a positive desirability score:
 * 100 means cheap/easy to reproduce, 0 means expensive/hard.
 */
export function scoreOpportunityV1(input: OpportunityScoringV1Input): OpportunityScoringV1Result {
  const breakdown = {
    velocity: clamp(input.velocity),
    engagementQuality: clamp(input.engagementQuality),
    recency: clamp(input.recency),
    repeatability: clamp(input.repeatability),
    nicheRelevance: clamp(input.nicheRelevance),
    creativeNovelty: clamp(input.creativeNovelty),
    monetizationPotential: clamp(input.monetizationPotential),
    productionDifficulty: clamp(input.productionDifficulty),
  };

  const total = Math.round(
    (breakdown.velocity * WEIGHTS.velocity +
      breakdown.engagementQuality * WEIGHTS.engagementQuality +
      breakdown.recency * WEIGHTS.recency +
      breakdown.repeatability * WEIGHTS.repeatability +
      breakdown.nicheRelevance * WEIGHTS.nicheRelevance +
      breakdown.creativeNovelty * WEIGHTS.creativeNovelty +
      breakdown.monetizationPotential * WEIGHTS.monetizationPotential +
      breakdown.productionDifficulty * WEIGHTS.productionDifficulty) * 100,
  ) / 100;

  const decision = total >= 80 ? 'prioritize' : total >= 65 ? 'experiment' : total >= 45 ? 'monitor' : 'discard';

  return {
    opportunityId: input.id,
    score: total,
    breakdown: { ...breakdown, total },
    decision,
  };
}

export function opportunityScoringWeightsV1(): typeof WEIGHTS {
  return WEIGHTS;
}
