import type { CapitalDomain } from './taxonomy';

export type OpportunityCandidate = {
  id: string;
  domain: CapitalDomain;
  instrument: string;
  venue?: string;
  expectedReturn: number;
  probability: number;
  downside: number;
  liquidityScore: number;
  confidence: number;
  observedAt: string;
  expiresAt?: string;
};

export type OpportunityScore = OpportunityCandidate & {
  expectedValue: number;
  riskAdjustedScore: number;
  action: 'monitor' | 'consider' | 'avoid';
  reasons: string[];
};

/** Recommendation-only. Never places orders, transfers funds, or bets. */
export function scoreOpportunity(candidate: OpportunityCandidate): OpportunityScore {
  const expectedValue = candidate.expectedReturn * candidate.probability - candidate.downside * (1 - candidate.probability);
  const riskAdjustedScore = expectedValue * candidate.confidence * Math.max(0, Math.min(1, candidate.liquidityScore));
  const reasons: string[] = [];
  if (candidate.confidence < 0.6) reasons.push('low model/data confidence');
  if (candidate.liquidityScore < 0.5) reasons.push('limited liquidity');
  if (candidate.downside > Math.abs(candidate.expectedReturn)) reasons.push('downside exceeds nominal upside');
  if (expectedValue > 0 && candidate.confidence >= 0.6 && candidate.liquidityScore >= 0.5) reasons.push('positive risk-adjusted expected value');

  const action = riskAdjustedScore >= 0.05 ? 'consider' : riskAdjustedScore > 0 ? 'monitor' : 'avoid';
  return { ...candidate, expectedValue, riskAdjustedScore, action, reasons };
}

export function rankOpportunities(candidates: OpportunityCandidate[]): OpportunityScore[] {
  return candidates.map(scoreOpportunity).sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore);
}
