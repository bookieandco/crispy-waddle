import type { PredictionDistribution } from './contracts.js';

export type OddsFormat = 'AMERICAN' | 'DECIMAL' | 'PROBABILITY';
export type MarketDisagreementLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface MarketPrice {
  bookmakerId: string;
  marketId: string;
  outcome: string;
  format: OddsFormat;
  value: number;
  observedAt: string;
  receivedAt: string;
  sourceId: string;
}

export interface NormalizedMarketPrice {
  bookmakerId: string;
  marketId: string;
  outcome: string;
  decimalOdds: number;
  impliedProbability: number;
  observedAt: string;
  receivedAt: string;
  sourceId: string;
}

export interface FairMarketSnapshot {
  marketId: string;
  outcomes: ReadonlyArray<{ outcome: string; fairProbability: number }>;
  overround: number;
  bookmakerIds: readonly string[];
  sourcePriceIds: readonly string[];
}

export interface MarketDisagreement {
  marketId: string;
  outcome: string;
  minProbability: number;
  maxProbability: number;
  maxAbsoluteDelta: number;
  level: MarketDisagreementLevel;
}

export interface ArbitrageOpportunity {
  marketId: string;
  outcomes: readonly string[];
  bestPrices: ReadonlyArray<{ outcome: string; bookmakerId: string; decimalOdds: number }>;
  impliedProbabilitySum: number;
  theoreticalArbitrageMargin: number;
}

function assertProbability(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be within [0,1]`);
}

function assertFinitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be positive`);
}

export function americanToDecimal(odds: number): number {
  if (!Number.isFinite(odds) || odds === 0) throw new Error('American odds must be non-zero');
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

export function decimalToImpliedProbability(decimalOdds: number): number {
  assertFinitePositive(decimalOdds, 'Decimal odds');
  if (decimalOdds < 1) throw new Error('Decimal odds must be at least 1');
  return 1 / decimalOdds;
}

export function normalizeMarketPrice(price: MarketPrice): NormalizedMarketPrice {
  if (!price.bookmakerId || !price.marketId || !price.outcome || !price.sourceId) throw new Error('Market price requires stable lineage identifiers');
  const decimalOdds = price.format === 'AMERICAN' ? americanToDecimal(price.value) : price.format === 'DECIMAL' ? price.value : 1 / price.value;
  assertFinitePositive(decimalOdds, 'Decimal odds');
  const impliedProbability = decimalToImpliedProbability(decimalOdds);
  if (price.format === 'PROBABILITY') assertProbability(price.value, 'Market probability');
  if (price.format !== 'PROBABILITY' && decimalOdds < 1) throw new Error('Invalid decimal odds');
  return Object.freeze({ ...price, decimalOdds, impliedProbability });
}

export function removeVig(prices: readonly NormalizedMarketPrice[]): FairMarketSnapshot {
  if (prices.length < 2) throw new Error('A market requires at least two prices');
  const marketId = prices[0].marketId;
  if (prices.some((price) => price.marketId !== marketId)) throw new Error('All prices must belong to the same market');
  const bestByOutcome = new Map<string, NormalizedMarketPrice>();
  for (const price of prices) {
    const current = bestByOutcome.get(price.outcome);
    if (!current || price.decimalOdds > current.decimalOdds) bestByOutcome.set(price.outcome, price);
  }
  const total = [...bestByOutcome.values()].reduce((sum, price) => sum + price.impliedProbability, 0);
  if (total <= 0) throw new Error('Market has no probability mass');
  const outcomes = [...bestByOutcome.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([outcome, price]) => ({ outcome, fairProbability: price.impliedProbability / total }));
  return Object.freeze({
    marketId,
    outcomes: Object.freeze(outcomes),
    overround: total - 1,
    bookmakerIds: Object.freeze([...new Set(prices.map((price) => price.bookmakerId))].sort()),
    sourcePriceIds: Object.freeze(prices.map((price) => `${price.bookmakerId}:${price.outcome}:${price.sourceId}`).sort()),
  });
}

function level(delta: number): MarketDisagreementLevel {
  if (delta >= 0.35) return 'CRITICAL';
  if (delta >= 0.20) return 'HIGH';
  if (delta >= 0.10) return 'MEDIUM';
  return 'LOW';
}

export function compareMarketPerspectives(perspectives: readonly PredictionDistribution[], marketId: string): readonly MarketDisagreement[] {
  if (perspectives.length < 2) throw new Error('At least two market perspectives are required');
  const outcomes = [...new Set(perspectives.flatMap((distribution) => distribution.outcomes.map((item) => item.outcome)))].sort();
  return Object.freeze(outcomes.map((outcome) => {
    const values = perspectives.map((distribution) => distribution.outcomes.find((item) => item.outcome === outcome)?.probability ?? 0);
    const minProbability = Math.min(...values);
    const maxProbability = Math.max(...values);
    return Object.freeze({ marketId, outcome, minProbability, maxProbability, maxAbsoluteDelta: maxProbability - minProbability, level: level(maxProbability - minProbability) });
  }));
}

export function findArbitrage(prices: readonly NormalizedMarketPrice[]): ArbitrageOpportunity | null {
  if (prices.length < 2) return null;
  const best = new Map<string, NormalizedMarketPrice>();
  for (const price of prices) {
    const current = best.get(price.outcome);
    if (!current || price.decimalOdds > current.decimalOdds) best.set(price.outcome, price);
  }
  if (best.size < 2) return null;
  const impliedProbabilitySum = [...best.values()].reduce((sum, price) => sum + price.impliedProbability, 0);
  if (impliedProbabilitySum >= 1) return null;
  return Object.freeze({
    marketId: prices[0].marketId,
    outcomes: Object.freeze([...best.keys()].sort()),
    bestPrices: Object.freeze([...best.values()].sort((a, b) => a.outcome.localeCompare(b.outcome)).map((price) => Object.freeze({ outcome: price.outcome, bookmakerId: price.bookmakerId, decimalOdds: price.decimalOdds }))),
    impliedProbabilitySum,
    theoreticalArbitrageMargin: 1 - impliedProbabilitySum,
  });
}
