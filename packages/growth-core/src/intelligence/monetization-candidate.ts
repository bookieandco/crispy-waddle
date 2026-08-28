import type { GrowthId } from '../domain/types.js';

export type MonetizationModel =
  | 'affiliate'
  | 'product'
  | 'service'
  | 'lead_generation'
  | 'sponsorship'
  | 'subscription';

export interface MonetizationCandidate {
  id: GrowthId;
  name: string;
  model: MonetizationModel;
  audienceFit: number;
  demandFit: number;
  commissionOrMarginPct: number;
  estimatedValuePerConversion: number;
  conversionRateEstimatePct: number;
  evidenceQuality: number;
  fulfillmentDifficulty: number;
  complianceRisk: number;
  landingDestination?: string;
  source?: string;
}

export interface MonetizationAssessment {
  candidateId: GrowthId;
  score: number;
  expectedValuePerHundredClicks: number;
  recommendation: 'strong' | 'viable' | 'weak' | 'reject';
  rationale: readonly string[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function assessMonetization(candidate: MonetizationCandidate): MonetizationAssessment {
  const audience = clamp(candidate.audienceFit);
  const demand = clamp(candidate.demandFit);
  const evidence = clamp(candidate.evidenceQuality);
  const fulfillment = clamp(candidate.fulfillmentDifficulty);
  const compliance = clamp(candidate.complianceRisk);
  const conversion = clamp(candidate.conversionRateEstimatePct * 10);
  const margin = clamp(candidate.commissionOrMarginPct);

  const score = Math.round((
    audience * 0.22 +
    demand * 0.18 +
    margin * 0.16 +
    conversion * 0.16 +
    evidence * 0.12 +
    (100 - fulfillment) * 0.08 +
    (100 - compliance) * 0.08
  ) * 100) / 100;

  const expectedValuePerHundredClicks = Math.round(
    candidate.estimatedValuePerConversion * (candidate.conversionRateEstimatePct / 100) * 100 * 100,
  ) / 100;

  let recommendation: MonetizationAssessment['recommendation'];
  if (compliance >= 80 || score < 30) recommendation = 'reject';
  else if (score >= 75) recommendation = 'strong';
  else if (score >= 55) recommendation = 'viable';
  else recommendation = 'weak';

  return {
    candidateId: candidate.id,
    score,
    expectedValuePerHundredClicks,
    recommendation,
    rationale: [
      `audienceFit=${audience.toFixed(1)}`,
      `demandFit=${demand.toFixed(1)}`,
      `marginOrCommission=${margin.toFixed(1)}`,
      `conversionRate=${candidate.conversionRateEstimatePct.toFixed(2)}%`,
      `evidenceQuality=${evidence.toFixed(1)}`,
      `fulfillmentDifficulty=${fulfillment.toFixed(1)}`,
      `complianceRisk=${compliance.toFixed(1)}`,
    ],
  };
}
