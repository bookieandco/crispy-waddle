import type { OpportunityCandidate } from './opportunity-engine';
import type { MiningEconomics } from './mining-economics';

export type MiningOpportunityInput = {
  id: string;
  instrument: string;
  venue?: string;
  economics: MiningEconomics;
  confidence: number;
  observedAt: string;
  expiresAt?: string;
};

/** Converts mining economics into the common opportunity contract. */
export function createMiningOpportunity(input: MiningOpportunityInput): OpportunityCandidate {
  const normalizedRevenue = input.economics.grossRevenuePerDay > 0
    ? input.economics.netProfitPerDay / input.economics.grossRevenuePerDay
    : 0;
  const downside = Math.max(0, -input.economics.netProfitPerDay);

  return {
    id: input.id,
    domain: 'crypto',
    instrument: input.instrument,
    venue: input.venue,
    expectedReturn: Math.max(0, normalizedRevenue),
    probability: input.economics.profitable ? Math.max(0, Math.min(1, input.confidence)) : 0,
    downside,
    liquidityScore: 0.5,
    confidence: Math.max(0, Math.min(1, input.confidence)),
    observedAt: input.observedAt,
    expiresAt: input.expiresAt,
  };
}
