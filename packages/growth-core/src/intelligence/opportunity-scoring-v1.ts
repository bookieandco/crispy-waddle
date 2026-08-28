import type { GrowthId } from '../domain/types.js';

export interface OpportunityScoringV1Input {
  id: GrowthId;
  velocity: number;
  engagementQuality: number;
  recency: number;
  repeatability: number;
  nicheRelevance: number;
  creativeNovelty: number;
  monetizationPotential: number;
  productionDifficulty: number;
  policyRisk?: number;
}

export interface OpportunityScoringV1Result {
  id: GrowthId;
  score: number;
  recommendation: 'scale' | 'test' | 'hold' | 'reduce' | 'stop';
  dimensions: Omit<OpportunityScoringV1Input, 'id'>;
  rationale: readonly string[];
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function scoreOpportunityV1(input: OpportunityScoringV1Input): OpportunityScoringV1Result {
  const d = {
    velocity: clamp(input.velocity),
    engagementQuality: clamp(input.engagementQuality),
    recency: clamp(input.recency),
    repeatability: clamp(input.repeatability),
    nicheRelevance: clamp(input.nicheRelevance),
    creativeNovelty: clamp(input.creativeNovelty),
    monetizationPotential: clamp(input.monetizationPotential),
    productionDifficulty: clamp(input.productionDifficulty),
    policyRisk: clamp(input.policyRisk ?? 0),
  };

  const score = Math.round(
    (d.velocity * 0.20 +
      d.engagementQuality * 0.14 +
      d.recency * 0.10 +
      d.repeatability * 0.14 +
      d.nicheRelevance * 0.14 +
      d.creativeNovelty * 0.08 +
      d.monetizationPotential * 0.15 +
      (100 - d.productionDifficulty) * 0.05 -
      d.policyRisk * 0.20) * 100,
  ) / 100;

  let recommendation: OpportunityScoringV1Result['recommendation'];
  if (d.policyRisk >= 80 || score < 25) recommendation = 'stop';
  else if (score >= 75 && d.velocity >= 60 && d.monetizationPotential >= 60) recommendation = 'scale';
  else if (score >= 50) recommendation = 'test';
  else if (score < 35) recommendation = 'reduce';
  else recommendation = 'hold';

  const rationale = [
    `velocity=${d.velocity.toFixed(1)}`,
    `engagementQuality=${d.engagementQuality.toFixed(1)}`,
    `recency=${d.recency.toFixed(1)}`,
    `repeatability=${d.repeatability.toFixed(1)}`,
    `nicheRelevance=${d.nicheRelevance.toFixed(1)}`,
    `creativeNovelty=${d.creativeNovelty.toFixed(1)}`,
    `monetizationPotential=${d.monetizationPotential.toFixed(1)}`,
    `productionDifficulty=${d.productionDifficulty.toFixed(1)}`,
  ];
  if (d.policyRisk > 0) rationale.push(`policyRisk=${d.policyRisk.toFixed(1)}`);

  return { id: input.id, score, recommendation, dimensions: d, rationale };
}
