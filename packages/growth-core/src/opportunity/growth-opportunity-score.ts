import type { GrowthId } from '../domain/types.js';

export type GrowthRecommendation = 'scale' | 'hold' | 'test' | 'reduce' | 'stop';

export interface GrowthOpportunityInput {
  id: GrowthId;
  contributionMargin: number;
  ltvPerCustomer: number;
  sampleSize: number;
  confidence: number;
  trend: number;
  policyRisk?: number;
}

export interface GrowthOpportunityScore {
  id: GrowthId;
  score: number;
  recommendation: GrowthRecommendation;
  reasons: string[];
}

export function scoreGrowthOpportunity(input: GrowthOpportunityInput): GrowthOpportunityScore {
  const risk = Math.max(0, Math.min(1, input.policyRisk ?? 0));
  const economics = input.contributionMargin > 0 ? 1 : -1;
  const ltv = input.ltvPerCustomer > 0 ? 1 : -1;
  const evidence = Math.max(0, Math.min(1, input.sampleSize / 100));
  const confidence = Math.max(0, Math.min(1, input.confidence));
  const trend = Math.max(-1, Math.min(1, input.trend));

  const raw = (economics * 0.35) + (ltv * 0.25) + (evidence * 0.15) + (confidence * 0.15) + (trend * 0.10) - (risk * 0.25);
  const score = Math.max(-1, Math.min(1, raw));

  let recommendation: GrowthRecommendation;
  if (risk >= 0.8 || (economics < 0 && ltv < 0)) recommendation = 'stop';
  else if (score >= 0.65 && evidence >= 0.5 && confidence >= 0.7) recommendation = 'scale';
  else if (score <= -0.35) recommendation = 'reduce';
  else if (evidence < 0.5 || confidence < 0.5) recommendation = 'test';
  else recommendation = 'hold';

  const reasons = [
    economics > 0 ? 'positive contribution margin' : 'negative contribution margin',
    ltv > 0 ? 'positive customer LTV' : 'negative customer LTV',
    `evidence=${evidence.toFixed(2)}`,
    `confidence=${confidence.toFixed(2)}`,
    `trend=${trend.toFixed(2)}`,
  ];
  if (risk > 0) reasons.push(`policyRisk=${risk.toFixed(2)}`);

  return { id: input.id, score, recommendation, reasons };
}
