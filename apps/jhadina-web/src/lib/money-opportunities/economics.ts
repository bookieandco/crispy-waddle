import type { SamOpportunity } from './sam-types';

export interface DealEconomicsInput {
  awardValue: number;
  partnerSharePercent?: number;
  directCostPercent?: number;
  overheadPercent?: number;
  contingencyPercent?: number;
  acquisitionCost?: number;
}

export interface DealEconomics {
  awardValue: number;
  partnerCost: number;
  directCost: number;
  overhead: number;
  contingency: number;
  acquisitionCost: number;
  estimatedGrossProfit: number;
  estimatedMarginPercent: number;
  primeRevenue: number;
  viable: boolean;
  reasons: string[];
}

export interface OpportunityEconomics extends DealEconomics {
  opportunityId: string;
}

const pct = (value: number | undefined) => Math.max(0, Math.min(100, value ?? 0));

export function calculateDealEconomics(input: DealEconomicsInput): DealEconomics {
  const awardValue = Math.max(0, input.awardValue);
  const partnerCost = awardValue * pct(input.partnerSharePercent) / 100;
  const directCost = awardValue * pct(input.directCostPercent) / 100;
  const overhead = awardValue * pct(input.overheadPercent) / 100;
  const contingency = awardValue * pct(input.contingencyPercent) / 100;
  const acquisitionCost = Math.max(0, input.acquisitionCost ?? 0);
  const estimatedGrossProfit = awardValue - partnerCost - directCost - overhead - contingency - acquisitionCost;
  const estimatedMarginPercent = awardValue === 0 ? 0 : estimatedGrossProfit / awardValue * 100;
  const reasons: string[] = [];

  if (awardValue <= 0) reasons.push('No reliable award value was supplied.');
  if (estimatedMarginPercent < 10) reasons.push('Estimated margin is below the 10% minimum planning threshold.');
  if (partnerCost >= awardValue) reasons.push('Partner allocation consumes the entire award value.');
  if (acquisitionCost > awardValue * 0.1) reasons.push('Acquisition cost is high relative to award value.');

  return {
    awardValue,
    partnerCost,
    directCost,
    overhead,
    contingency,
    acquisitionCost,
    estimatedGrossProfit,
    estimatedMarginPercent,
    primeRevenue: awardValue - partnerCost,
    viable: awardValue > 0 && estimatedGrossProfit > 0 && estimatedMarginPercent >= 10,
    reasons,
  };
}

/**
 * Uses only opportunity data; unknown costs remain explicit assumptions.
 * This is a planning model, not a guarantee of profitability.
 */
export function estimateOpportunityEconomics(
  opportunity: SamOpportunity,
  assumptions: Omit<DealEconomicsInput, 'awardValue'> = {},
): OpportunityEconomics {
  const economics = calculateDealEconomics({
    ...assumptions,
    awardValue: opportunity.estimatedValue ?? 0,
  });

  return {
    opportunityId: opportunity.noticeId,
    ...economics,
  };
}
