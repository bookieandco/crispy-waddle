import type { Opportunity, OpportunityScoreDimensions, OpportunityScore } from './types.js';

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export interface OpportunityScoringWeights {
  demand: number;
  buyerValue: number;
  distributionPotential: number;
  aiLeverage: number;
  recurringRevenue: number;
  competition: number;
  startupCost: number;
  operationalComplexity: number;
  regulatoryRisk: number;
  evidenceConfidence: number;
  personalFit: number;
}

export const DEFAULT_OPPORTUNITY_WEIGHTS: OpportunityScoringWeights = {
  demand: 0.18,
  buyerValue: 0.14,
  distributionPotential: 0.10,
  aiLeverage: 0.10,
  recurringRevenue: 0.08,
  competition: 0.08,
  startupCost: 0.06,
  operationalComplexity: 0.06,
  regulatoryRisk: 0.05,
  evidenceConfidence: 0.08,
  personalFit: 0.07,
};

function weightedPositive(d: OpportunityScoreDimensions, w: OpportunityScoringWeights): number {
  return d.demand * w.demand + d.buyerValue * w.buyerValue + d.distributionPotential * w.distributionPotential +
    d.aiLeverage * w.aiLeverage + d.recurringRevenue * w.recurringRevenue + d.evidenceConfidence * w.evidenceConfidence + d.personalFit * w.personalFit;
}

function weightedNegative(d: OpportunityScoreDimensions, w: OpportunityScoringWeights): number {
  return d.competition * w.competition + d.startupCost * w.startupCost + d.operationalComplexity * w.operationalComplexity + d.regulatoryRisk * w.regulatoryRisk;
}

export function scoreOpportunity(
  opportunity: Opportunity,
  dimensions: OpportunityScoreDimensions,
  weights: OpportunityScoringWeights = DEFAULT_OPPORTUNITY_WEIGHTS,
  now = new Date().toISOString(),
): OpportunityScore {
  const total = clamp(weightedPositive(dimensions, weights) - weightedNegative(dimensions, weights) + 50);
  const recommendation = total >= 78 && dimensions.evidenceConfidence >= 60
    ? 'pursue'
    : total >= 60 && dimensions.evidenceConfidence >= 45
      ? 'test'
      : total >= 45
        ? 'monitor'
        : 'reject';

  const rationale = [
    `Score ${total}/100`,
    `Demand ${dimensions.demand}/100; buyer value ${dimensions.buyerValue}/100`,
    `Evidence confidence ${dimensions.evidenceConfidence}/100; personal fit ${dimensions.personalFit}/100`,
    `Cost ${dimensions.startupCost}/100; complexity ${dimensions.operationalComplexity}/100; regulatory risk ${dimensions.regulatoryRisk}/100`,
    `Recommendation: ${recommendation.toUpperCase()}`,
  ];

  return { total, dimensions, recommendation, rationale, scoredAt: now };
}

export function toOpportunityScoreDimensions(input: Partial<OpportunityScoreDimensions>): OpportunityScoreDimensions {
  return {
    demand: clamp(input.demand ?? 0),
    buyerValue: clamp(input.buyerValue ?? 0),
    distributionPotential: clamp(input.distributionPotential ?? 0),
    aiLeverage: clamp(input.aiLeverage ?? 0),
    recurringRevenue: clamp(input.recurringRevenue ?? 0),
    competition: clamp(input.competition ?? 0),
    startupCost: clamp(input.startupCost ?? 0),
    operationalComplexity: clamp(input.operationalComplexity ?? 0),
    regulatoryRisk: clamp(input.regulatoryRisk ?? 0),
    evidenceConfidence: clamp(input.evidenceConfidence ?? 0),
    personalFit: clamp(input.personalFit ?? 0),
  };
}
