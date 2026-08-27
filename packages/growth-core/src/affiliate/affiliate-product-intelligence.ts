import type { GrowthId } from '../domain/types.js';

export type ProductSource = 'affiliate_network' | 'commerce_marketplace' | 'first_party' | 'community' | 'manual';
export type ProductRecommendation = 'test' | 'watch' | 'reject';

export interface ProductSignal {
  source: ProductSource;
  capturedAt: string;
  revenue30d?: number;
  dailyRevenue?: number;
  payout?: number;
  priceMin?: number;
  priceMax?: number;
  launchAgeDays?: number;
  momentum: number; // 0..100; source-derived trend signal, not a forecast
  evidenceUrls?: readonly string[];
  creativeAssetCount?: number;
}

export interface AffiliateProductCandidate {
  id: GrowthId;
  brandId: GrowthId;
  name: string;
  category: string;
  sourceSignals: readonly ProductSignal[];
  audienceFit: number; // 0..100
  problemClarity: number; // 0..100
  creativeFit: number; // 0..100
  complianceRisk: number; // 0..100, higher is riskier
  unitEconomicsScore: number; // 0..100
}

export interface AffiliateProductAssessment {
  candidateId: GrowthId;
  score: number;
  recommendation: ProductRecommendation;
  reasons: readonly string[];
  requiredChecks: readonly string[];
}

const clamp = (value: number): number => Math.max(0, Math.min(100, value));

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

/**
 * Deterministic pre-test scoring. External network/marketplace data is deliberately
 * kept behind ProductSignal so connectors can be swapped without changing policy.
 */
export function assessAffiliateProduct(candidate: AffiliateProductCandidate): AffiliateProductAssessment {
  const momentum = average(candidate.sourceSignals.map((signal) => clamp(signal.momentum)));
  const payoutSignals = candidate.sourceSignals
    .map((signal) => signal.payout)
    .filter((value): value is number => typeof value === 'number' && value >= 0);
  const payoutScore = payoutSignals.length ? clamp(Math.max(...payoutSignals) / 2) : 0;
  const creativeEvidence = candidate.sourceSignals.some((signal) => (signal.creativeAssetCount ?? 0) > 0) ? 100 : candidate.creativeFit;

  const score = Math.round(
    0.25 * momentum +
    0.20 * candidate.audienceFit +
    0.15 * candidate.problemClarity +
    0.15 * creativeEvidence +
    0.15 * candidate.unitEconomicsScore +
    0.10 * payoutScore -
    0.30 * candidate.complianceRisk,
  );

  const reasons: string[] = [];
  if (momentum >= 70) reasons.push('Strong observed momentum across supplied sources.');
  if (candidate.problemClarity >= 70) reasons.push('Clear customer problem suitable for answer-led creative.');
  if (creativeEvidence >= 70) reasons.push('Existing creative evidence can seed controlled variations.');
  if (candidate.unitEconomicsScore >= 70) reasons.push('Unit economics support a bounded test.');
  if (candidate.complianceRisk >= 40) reasons.push('Compliance review is required before promotion.');

  const requiredChecks = [
    'Verify affiliate terms, payout, attribution window, and permitted traffic sources.',
    'Verify product claims and disclosures before publishing promotional creative.',
    'Confirm destination URL, tracking parameters, and conversion event.',
  ];

  const recommendation: ProductRecommendation =
    candidate.complianceRisk >= 75 || score < 40 ? 'reject' : score >= 65 ? 'test' : 'watch';

  return {
    candidateId: candidate.id,
    score: clamp(score),
    recommendation,
    reasons,
    requiredChecks,
  };
}

export interface ProductTestPlan {
  candidateId: GrowthId;
  variants: readonly string[];
  maxBudget: number;
  stopIf: string;
  successMetric: 'contribution_margin' | 'conversion_rate' | 'contribution_roas';
}

export function buildAffiliateProductTestPlan(
  candidate: AffiliateProductCandidate,
  assessment: AffiliateProductAssessment,
): ProductTestPlan | null {
  if (assessment.recommendation !== 'test') return null;

  const maxBudget = Math.max(25, Math.round(candidate.unitEconomicsScore * 0.5));
  return {
    candidateId: candidate.id,
    variants: [
      'winning-reference-hook',
      'problem-first-hook',
      'proof-first-hook',
      'benefit-first-hook',
    ],
    maxBudget,
    stopIf: 'Stop when the approved test budget is reached, tracking is invalid, or contribution economics fall below the configured floor.',
    successMetric: 'contribution_roas',
  };
}
