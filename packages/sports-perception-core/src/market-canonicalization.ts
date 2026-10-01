import type { MarketPrice, NormalizedMarketPrice } from './market-intelligence.js';

export type CanonicalMarketType =
  | 'MONEYLINE'
  | 'SPREAD'
  | 'TOTAL'
  | 'TEAM_TOTAL'
  | 'PLAYER_PROP'
  | 'GAME_PROP'
  | 'OTHER';

export type MarketAvailability = 'AVAILABLE' | 'STALE' | 'UNAVAILABLE';

export interface CanonicalMarketLeg {
  legId: string;
  sport: string;
  eventId: string;
  marketId: string;
  marketType: CanonicalMarketType;
  selection: string;
  playerId?: string;
  teamId?: string;
  line?: number;
  bookmakerId: string;
  sourceId: string;
  observedAt: string;
  receivedAt: string;
  decimalOdds: number;
  impliedProbability: number;
  fairProbability?: number;
  marketAvailability: MarketAvailability;
  sourcePrice: MarketPrice;
  normalizedPrice: NormalizedMarketPrice;
}

export interface MarketCanonicalizationPolicy {
  asOf: string;
  maxAgeMs: number;
  requireReceivedByCutoff?: boolean;
}

function iso(value: string, label: string): number {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error(`${label} must be a valid ISO timestamp`);
  return time;
}

function probability(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be within [0,1]`);
}

export function canonicalizeMarketLeg(
  price: MarketPrice,
  normalized: NormalizedMarketPrice,
  marketType: CanonicalMarketType,
  policy: MarketCanonicalizationPolicy,
  identity: Pick<CanonicalMarketLeg, 'legId' | 'sport' | 'eventId' | 'marketId' | 'selection'> & Partial<Pick<CanonicalMarketLeg, 'playerId' | 'teamId' | 'line'>>,
): CanonicalMarketLeg {
  if (!identity.legId || !identity.sport || !identity.eventId || !identity.marketId || !identity.selection) {
    throw new Error('Canonical market leg requires stable identity fields');
  }
  const observed = iso(normalized.observedAt, 'observedAt');
  const received = iso(normalized.receivedAt, 'receivedAt');
  const cutoff = iso(policy.asOf, 'asOf');
  if (received < observed) throw new Error('receivedAt cannot precede observedAt');
  if (policy.requireReceivedByCutoff !== false && received > cutoff) {
    throw new Error('Market price was received after the canonicalization cutoff');
  }
  if (!Number.isFinite(policy.maxAgeMs) || policy.maxAgeMs < 0) throw new Error('maxAgeMs must be finite and non-negative');
  if (cutoff - observed > policy.maxAgeMs) {
    return Object.freeze({
      ...identity,
      marketType,
      bookmakerId: normalized.bookmakerId,
      sourceId: normalized.sourceId,
      observedAt: normalized.observedAt,
      receivedAt: normalized.receivedAt,
      decimalOdds: normalized.decimalOdds,
      impliedProbability: normalized.impliedProbability,
      fairProbability: undefined,
      marketAvailability: 'STALE',
      sourcePrice: price,
      normalizedPrice: normalized,
    });
  }
  probability(normalized.impliedProbability, 'impliedProbability');
  if (normalized.decimalOdds <= 1 || !Number.isFinite(normalized.decimalOdds)) throw new Error('decimalOdds must be finite and greater than 1');
  return Object.freeze({
    ...identity,
    marketType,
    bookmakerId: normalized.bookmakerId,
    sourceId: normalized.sourceId,
    observedAt: normalized.observedAt,
    receivedAt: normalized.receivedAt,
    decimalOdds: normalized.decimalOdds,
    impliedProbability: normalized.impliedProbability,
    marketAvailability: 'AVAILABLE',
    sourcePrice: price,
    normalizedPrice: normalized,
  });
}

export function isMarketLegEligible(leg: CanonicalMarketLeg): boolean {
  return leg.marketAvailability === 'AVAILABLE';
}
