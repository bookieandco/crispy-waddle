import type { SamOpportunity } from './sam-types';

export interface SamDealEconomicsInput {
  opportunity: SamOpportunity;
  primeSharePct: number;
  partnerSharePct: number;
  directCostPct: number;
  acquisitionCost?: number;
  contingencyPct?: number;
}

export interface SamDealEconomics {
  grossValue: number | null;
  primeRevenue: number | null;
  partnerRevenue: number | null;
  directCost: number | null;
  acquisitionCost: number;
  contingency: number | null;
  estimatedGrossMargin: number | null;
  marginPct: number | null;
  assumptions: string[];
  requiresHumanPricingReview: boolean;
}

const pct = (value: number) => Math.max(0, Math.min(100, value));

/** Advisory economics only. Never treats an estimated notice value as a quote. */
export function modelSamDealEconomics(input: SamDealEconomicsInput): SamDealEconomics {
  const grossValue = input.opportunity.estimatedValue ?? null;
  const primeSharePct = pct(input.primeSharePct);
  const partnerSharePct = pct(input.partnerSharePct);
  const directCostPct = pct(input.directCostPct);
  const contingencyPct = pct(input.contingencyPct ?? 5);
  const acquisitionCost = Math.max(0, input.acquisitionCost ?? 0);

  if (grossValue == null) {
    return {
      grossValue: null, primeRevenue: null, partnerRevenue: null, directCost: null,
      acquisitionCost, contingency: null, estimatedGrossMargin: null, marginPct: null,
      assumptions: ['No estimated notice value; economics require a human planning value.'],
      requiresHumanPricingReview: true,
    };
  }

  const primeRevenue = grossValue * (primeSharePct / 100);
  const partnerRevenue = grossValue * (partnerSharePct / 100);
  const directCost = primeRevenue * (directCostPct / 100);
  const contingency = primeRevenue * (contingencyPct / 100);
  const estimatedGrossMargin = primeRevenue - partnerRevenue - directCost - contingency - acquisitionCost;
  const marginPct = primeRevenue === 0 ? null : (estimatedGrossMargin / primeRevenue) * 100;

  return {
    grossValue, primeRevenue, partnerRevenue, directCost, acquisitionCost, contingency,
    estimatedGrossMargin, marginPct,
    assumptions: [
      'Estimated notice value is not a government offer or guaranteed contract value.',
      'Partner share, direct cost, contingency, and acquisition cost are planning assumptions.',
      'Final pricing, teaming terms, scope, and procurement rules require human review.',
    ],
    requiresHumanPricingReview: true,
  };
}
