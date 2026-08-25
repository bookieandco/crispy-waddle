export type CapitalDomain = 'equities' | 'etf' | 'forex' | 'crypto' | 'sports' | 'prediction_market';
export type OpportunitySide = 'buy' | 'sell' | 'back' | 'lay' | 'hold';

export type Money = {
  amount: number;
  currency: string;
};

export type Evidence = {
  id: string;
  source: string;
  observedAt: string;
  summary: string;
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

export type CapitalBucket =
  | 'required'
  | 'tax_reserve'
  | 'operating_reserve'
  | 'advertising'
  | 'investment'
  | 'trading'
  | 'speculative'
  | 'unallocated';

export type CapitalPosition = {
  bucket: CapitalBucket;
  balance: Money;
  target?: Money;
  minimum?: Money;
  maximum?: Money;
};

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

export type NotificationSeverity = 'info' | 'watch' | 'action' | 'critical';

export type CapitalNotification = {
  id: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  opportunityId?: string;
  recommendationId?: string;
  createdAt: string;
  expiresAt?: string;
};

export function assertPercentage(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name}_INVALID`);
  }
}

export function assertMoney(money: Money, name = 'MONEY'): void {
  if (!Number.isFinite(money.amount) || money.amount < 0) throw new Error(`${name}_AMOUNT_INVALID`);
  if (!/^[A-Z]{3}$/.test(money.currency)) throw new Error(`${name}_CURRENCY_INVALID`);
}

export function validateOpportunity(opportunity: Opportunity): void {
  if (!opportunity.id || !opportunity.instrument || !opportunity.strategy) {
    throw new Error('OPPORTUNITY_IDENTITY_INVALID');
  }
  assertPercentage(opportunity.confidence, 'OPPORTUNITY_CONFIDENCE');
  if (!Number.isFinite(opportunity.riskScore) || opportunity.riskScore < 0 || opportunity.riskScore > 1) {
    throw new Error('OPPORTUNITY_RISK_INVALID');
  }
  if (!Number.isFinite(opportunity.liquidityScore) || opportunity.liquidityScore < 0 || opportunity.liquidityScore > 1) {
    throw new Error('OPPORTUNITY_LIQUIDITY_INVALID');
  }
  if (opportunity.probability !== undefined) assertPercentage(opportunity.probability, 'OPPORTUNITY_PROBABILITY');
  if (opportunity.impliedProbability !== undefined) assertPercentage(opportunity.impliedProbability, 'OPPORTUNITY_IMPLIED_PROBABILITY');
  if (opportunity.suggestedCapital) assertMoney(opportunity.suggestedCapital, 'OPPORTUNITY_SUGGESTED_CAPITAL');
  if (opportunity.maxCapital) assertMoney(opportunity.maxCapital, 'OPPORTUNITY_MAX_CAPITAL');
}
