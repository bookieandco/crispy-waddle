import type { AllocationRecommendation, CapitalConstraints } from './allocation-engine';
import { recommendAllocation } from './allocation-engine';
import type { Exposure, RiskAssessment, RiskLimits } from './risk-engine';
import { assessOpportunityRisk } from './risk-engine';
import type { OpportunityScore } from './opportunity-engine';

export type GatedCapitalDecision = {
  risk: RiskAssessment;
  allocation: AllocationRecommendation;
  eligibleForConsiderAlert: boolean;
};

/**
 * Single composition boundary: an opportunity cannot reach a CONSIDER
 * allocation/alert unless it passes the portfolio exposure gate.
 */
export function gateCapitalDecision(
  opportunity: OpportunityScore,
  exposures: Exposure[],
  riskLimits: RiskLimits,
  constraints: CapitalConstraints,
): GatedCapitalDecision {
  const risk = assessOpportunityRisk(opportunity, exposures, riskLimits);
  const allocation = recommendAllocation(opportunity, constraints, risk);
  return {
    risk,
    allocation,
    eligibleForConsiderAlert: risk.allowed && allocation.action === 'consider' && allocation.recommendedAmount > 0,
  };
}
