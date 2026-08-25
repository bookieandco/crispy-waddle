export const CAPITAL_DOMAINS = ['equities','etf','options','bonds','forex','crypto','prediction-market','sports-betting'] as const;
export type CapitalDomain = typeof CAPITAL_DOMAINS[number];

export type AssetRef = {
  domain: CapitalDomain;
  instrument: string;
  venue?: string;
  quoteCurrency?: string;
};

export type CapitalEventKind = 'acquisition' | 'disposition' | 'fee' | 'deposit' | 'withdrawal' | 'payout' | 'loss' | 'transfer' | 'unknown';

export type CanonicalCapitalEvent = {
  sourceTransactionId: string;
  accountId: string;
  asset?: AssetRef;
  kind: CapitalEventKind;
  quantity?: number;
  notional?: { amount: number; currency: string };
  occurredAt: string;
  confidence: number;
  classificationReason: string;
};

export function isCapitalDomain(value: string): value is CapitalDomain {
  return (CAPITAL_DOMAINS as readonly string[]).includes(value);
}
