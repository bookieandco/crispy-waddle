import type { GrowthId, ISODateTime } from '../domain/types.js';
import type { DistributionOpportunity } from './distribution-opportunity.js';

export type ExperimentOpportunityState = 'READY' | 'NEEDS_REVIEW' | 'HOLD' | 'REJECTED';
export type ExperimentMonetizationKind = 'affiliate' | 'product' | 'service' | 'lead_gen' | 'sponsorship' | 'subscription' | 'other';

export interface MonetizationCandidate {
  id: GrowthId;
  kind: ExperimentMonetizationKind;
  name: string;
  offerId?: GrowthId;
  expectedRevenuePerConversion: number;
  expectedConversionRate: number;
  productionCost: number;
  evidenceQuality: number;
  approved: boolean;
}

export interface ExperimentOpportunityInput {
  opportunity: DistributionOpportunity;
  monetization?: MonetizationCandidate;
  nicheRelevance?: number;
  repeatability?: number;
  creativeNovelty?: number;
  productionDifficulty?: number;
  recency?: number;
  engagementQuality?: number;
  observedAt?: ISODateTime;
}

export interface ExperimentOpportunity {
  id: GrowthId;
  distributionOpportunityId: GrowthId;
  title: string;
  state: ExperimentOpportunityState;
  score: number;
  expectedValue: number;
  productionDifficulty: number;
  rationale: string[];
  hypothesis: string;
  audienceFit: number;
  nicheRelevance: number;
  repeatability: number;
  creativeNovelty: number;
  monetizationPotential: number;
  recency: number;
  engagementQuality: number;
  recommendedAction: 'test' | 'hold' | 'reject';
  monetizationCandidateId?: GrowthId;
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));

/**
 * Converts a distribution signal into a monetizable experiment candidate.
 * This is a ranking gate, not an execution authorization.
 */
export function assembleExperimentOpportunity(input: ExperimentOpportunityInput): ExperimentOpportunity {
  const o = input.opportunity;
  const audienceFit = clamp(o.audienceFit);
  const nicheRelevance = clamp(input.nicheRelevance ?? audienceFit);
  const repeatability = clamp(input.repeatability ?? 50);
  const creativeNovelty = clamp(input.creativeNovelty ?? 50);
  const recency = clamp(input.recency ?? o.trend);
  const engagementQuality = clamp(input.engagementQuality ?? ((o.intent + o.audienceFit) / 2));
  const productionDifficulty = clamp(input.productionDifficulty ?? (100 - o.costEfficiency));

  const monetizationPotential = input.monetization
    ? clamp(
        (Math.min(input.monetization.expectedConversionRate, 1) * 100 * 0.45) +
        (Math.min(Math.max(input.monetization.expectedRevenuePerConversion, 0) / 1000, 1) * 100 * 0.35) +
        (input.monetization.evidenceQuality * 0.20),
      )
    : 0;

  const score = Math.round(
    clamp(
      o.trend * 0.14 +
      engagementQuality * 0.12 +
      recency * 0.10 +
      repeatability * 0.14 +
      nicheRelevance * 0.16 +
      creativeNovelty * 0.08 +
      monetizationPotential * 0.20 +
      (100 - productionDifficulty) * 0.06,
    ) * 100,
  ) / 100;

  const expectedValue = input.monetization
    ? Math.max(0, input.monetization.expectedRevenuePerConversion * input.monetization.expectedConversionRate - input.monetization.productionCost)
    : 0;

  const rationale = [
    `Trend ${o.trend}/100`,
    `Engagement quality ${engagementQuality}/100`,
    `Repeatability ${repeatability}/100`,
    `Niche relevance ${nicheRelevance}/100`,
    `Creative novelty ${creativeNovelty}/100`,
    `Production difficulty ${productionDifficulty}/100`,
    input.monetization ? `Monetization candidate: ${input.monetization.name}` : 'No monetization candidate attached',
  ];

  const hasMonetizationEvidence = Boolean(input.monetization?.approved && input.monetization.evidenceQuality >= 50);
  const state: ExperimentOpportunityState = score >= 70 && hasMonetizationEvidence
    ? 'READY'
    : score >= 50
      ? 'NEEDS_REVIEW'
      : score >= 30
        ? 'HOLD'
        : 'REJECTED';

  return {
    id: `experiment-opportunity:${o.id}`,
    distributionOpportunityId: o.id,
    title: `Test: ${o.title}`,
    state,
    score,
    expectedValue,
    productionDifficulty,
    rationale,
    hypothesis: input.monetization
      ? `If this ${o.title} format is adapted for the target niche and paired with ${input.monetization.name}, it should generate measurable demand at acceptable production cost.`
      : `If this ${o.title} format is adapted for the target niche, it should generate measurable demand; attach an approved offer before execution.`,
    audienceFit,
    nicheRelevance,
    repeatability,
    creativeNovelty,
    monetizationPotential,
    recency,
    engagementQuality,
    recommendedAction: state === 'READY' ? 'test' : state === 'REJECTED' ? 'reject' : 'hold',
    monetizationCandidateId: input.monetization?.id,
  };
}

export function assembleExperimentOpportunities(inputs: readonly ExperimentOpportunityInput[]): ExperimentOpportunity[] {
  return inputs
    .map(assembleExperimentOpportunity)
    .sort((a, b) => b.score - a.score);
}
