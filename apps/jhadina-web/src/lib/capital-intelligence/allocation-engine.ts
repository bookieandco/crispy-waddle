import type { CapitalDomain } from './taxonomy';
import type { OpportunityScore } from './opportunity-engine';

export type CapitalConstraints = {
  availableCash: number;
  survivalFloor: number;
  taxReserve: number;
  operatingReserve: number;
  maxPortfolioRisk: number;
  maxDomainAllocation: Partial<Record<CapitalDomain, number>>;
};

export type AllocationRecommendation = {
  opportunityId: string;
  domain: CapitalDomain;
  instrument: string;
  recommendedAmount: number;
  cashAfter: number;
  action: 'consider' | 'monitor' | 'avoid';
  reasons: string[];
};

/**
 * Recommendation-only capital allocation. It cannot move money or execute an
 * order. Safety reserves are hard constraints, not optimization targets.
 */
export function recommendAllocation(
  opportunity: OpportunityScore,
  constraints: CapitalConstraints,
): AllocationRecommendation {
  const protectedCash = Math.max(0, constraints.survivalFloor) + Math.max(0, constraints.taxReserve) + Math.max(0, constraints.operatingReserve);
  const deployable = Math.max(0, constraints.availableCash - protectedCash);
  const domainCap = Math.max(0, constraints.maxDomainAllocation[opportunity.domain] ?? deployable);
  const riskCap = Math.max(0, deployable * Math.max(0, Math.min(1, constraints.maxPortfolioRisk)));
  const recommendedAmount = opportunity.action === 'consider'
    ? Math.min(deployable, domainCap, riskCap)
    : 0;

  const reasons = [
    `protected cash reserved: ${protectedCash}`,
    `deployable cash: ${deployable}`,
    `domain cap: ${domainCap}`,
    `portfolio risk cap: ${riskCap}`,
  ];

  return {
    opportunityId: opportunity.id,
    domain: opportunity.domain,
    instrument: opportunity.instrument,
    recommendedAmount,
    cashAfter: constraints.availableCash - recommendedAmount,
    action: opportunity.action,
    reasons,
  };
}
