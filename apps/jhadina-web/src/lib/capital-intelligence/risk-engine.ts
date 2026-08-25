import type { CapitalDomain } from './taxonomy';
import type { OpportunityScore } from './opportunity-engine';

export type Exposure = {
  domain: CapitalDomain;
  instrument: string;
  marketValue: number;
  riskWeight?: number;
};

export type RiskLimits = {
  portfolioValue: number;
  maxInstrumentPct: number;
  maxDomainPct: Partial<Record<CapitalDomain, number>>;
  maxRiskWeightedPct: number;
};

export type RiskAssessment = {
  opportunityId: string;
  allowed: boolean;
  instrumentExposurePct: number;
  domainExposurePct: number;
  riskWeightedExposurePct: number;
  reasons: string[];
};

/** Analysis-only risk gate. It never sells, buys, transfers, or executes. */
export function assessOpportunityRisk(
  opportunity: OpportunityScore,
  exposures: Exposure[],
  limits: RiskLimits,
): RiskAssessment {
  const total = Math.max(0, limits.portfolioValue);
  const instrumentValue = exposures
    .filter((e) => e.instrument === opportunity.instrument)
    .reduce((sum, e) => sum + Math.max(0, e.marketValue), 0);
  const domainValue = exposures
    .filter((e) => e.domain === opportunity.domain)
    .reduce((sum, e) => sum + Math.max(0, e.marketValue), 0);
  const riskWeightedValue = exposures.reduce(
    (sum, e) => sum + Math.max(0, e.marketValue) * Math.max(0, e.riskWeight ?? 1),
    0,
  );

  const instrumentExposurePct = total ? instrumentValue / total : 1;
  const domainExposurePct = total ? domainValue / total : 1;
  const riskWeightedExposurePct = total ? riskWeightedValue / total : 1;
  const domainLimit = limits.maxDomainPct[opportunity.domain] ?? limits.maxInstrumentPct;
  const reasons: string[] = [];

  if (instrumentExposurePct >= limits.maxInstrumentPct) reasons.push('instrument concentration limit reached');
  if (domainExposurePct >= domainLimit) reasons.push('domain concentration limit reached');
  if (riskWeightedExposurePct >= limits.maxRiskWeightedPct) reasons.push('portfolio risk-weighted limit reached');

  return {
    opportunityId: opportunity.id,
    allowed: reasons.length === 0,
    instrumentExposurePct,
    domainExposurePct,
    riskWeightedExposurePct,
    reasons,
  };
}
