import type { CapitalDomain } from './taxonomy';
import type { OpportunityScore } from './opportunity-engine';
import type { RiskAssessment } from './risk-engine';

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
  riskAllowed: boolean;
  reasons: string[];
};

/** Recommendation-only capital allocation. It cannot move money or execute an order. */
export function recommendAllocation(
  opportunity: OpportunityScore,
  constraints: CapitalConstraints,
  risk?: RiskAssessment,
): AllocationRecommendation {
  const protectedCash = Math.max(0, constraints.survivalFloor)
    + Math.max(0, constraints.taxReserve)
    + Math.max(0, constraints.operatingReserve);
  const deployable = Math.max(0, constraints.availableCash - protectedCash);
  const domainCap = Math.max(0, constraints.maxDomainAllocation[opportunity.domain] ?? deployable);
  const riskCap = Math.max(0, deployable * Math.max(0, Math.min(1, constraints.maxPortfolioRisk)));
  const riskAllowed = risk?.allowed ?? true;
  const recommendedAmount = opportunity.action === 'consider' && riskAllowed
    ? Math.min(deployable, domainCap, riskCap)
    : 0;

  const reasons = [
    `protected cash reserved: ${protectedCash}`,
    `deployable cash: ${deployable}`,
    `domain cap: ${domainCap}`,
    `portfolio risk cap: ${riskCap}`,
  ];
  if (risk && !risk.allowed) reasons.push(...risk.reasons);

  return {
    opportunityId: opportunity.id,
    domain: opportunity.domain,
    instrument: opportunity.instrument,
    recommendedAmount,
    cashAfter: constraints.availableCash - recommendedAmount,
    action: recommendedAmount > 0 ? 'consider' : riskAllowed ? opportunity.action : 'avoid',
    riskAllowed,
    reasons,
  };
}
