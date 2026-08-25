export type CapitalDomain = 'equities' | 'etf' | 'forex' | 'crypto' | 'sports' | 'prediction_market';
export type OpportunitySide = 'buy' | 'sell' | 'back' | 'lay' | 'hold';

export type Money = { amount: number; currency: string };
export type Evidence = { id: string; source: string; observedAt: string; summary: string };

/** Compatibility contract for position-level ledger events consumed by capital intelligence. */
export type PositionTransaction = {
  id: string;
  positionId?: string;
  domain?: CapitalDomain;
  instrument: string;
  side?: OpportunitySide;
  quantity?: number;
  price?: number;
  notional?: Money;
  fees?: Money;
  currency?: string;
  occurredAt: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type Opportunity = {
  id: string;
  domain: CapitalDomain;
  instrument: string;
  strategy: string;
  side: OpportunitySide;
  observedPrice?: number;
  estimatedFairValue?: number;
  probability?: number;
  impliedProbability?: number;
  expectedValue?: number;
  confidence: number;
  riskScore: number;
  liquidityScore: number;
  horizonSeconds?: number;
  suggestedCapital?: Money;
  maxCapital?: Money;
  entryCondition?: string;
  invalidationCondition?: string;
  expiresAt?: string;
  observedAt: string;
  evidence: Evidence[];
};

export type CapitalBucket = 'required' | 'tax_reserve' | 'operating_reserve' | 'advertising' | 'investment' | 'trading' | 'speculative' | 'unallocated';
export type CapitalPosition = { bucket: CapitalBucket; balance: Money; target?: Money; minimum?: Money; maximum?: Money };
export type TreasuryRecommendation = {
  id: string;
  kind: 'deposit' | 'withdraw' | 'transfer' | 'hold';
  fromBucket?: CapitalBucket;
  toBucket?: CapitalBucket;
  amount: Money;
  rationale: string;
  priority: 'required' | 'high' | 'normal' | 'low';
  createdAt: string;
  expiresAt?: string;
};

export type CapitalNotification = {
  id: string;
  severity: 'info' | 'watch' | 'action' | 'critical';
  title: string;
  body: string;
  opportunityId?: string;
  recommendationId?: string;
  createdAt: string;
  expiresAt?: string;
};

export function validateOpportunity(opportunity: Opportunity): void {
  if (!opportunity.id || !opportunity.instrument || !opportunity.strategy) throw new Error('OPPORTUNITY_IDENTITY_INVALID');
  for (const [name, value] of [['confidence', opportunity.confidence], ['riskScore', opportunity.riskScore], ['liquidityScore', opportunity.liquidityScore]] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`OPPORTUNITY_${name.toUpperCase()}_INVALID`);
  }
  for (const [name, value] of [['probability', opportunity.probability], ['impliedProbability', opportunity.impliedProbability]] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1)) throw new Error(`OPPORTUNITY_${name.toUpperCase()}_INVALID`);
  }
}
