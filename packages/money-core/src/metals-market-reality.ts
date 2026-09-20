import type { CanonicalInstrument } from './market-instrument-contracts.js';

export const METALS_MARKET_REALITY_SCHEMA_VERSION = 'MONEY-METALS-01' as const;

export type PreciousMetalCode = 'XAU' | 'XAG' | 'XPT' | 'XPD';
export type MetalMarketType = 'SPOT' | 'FUTURE';
export type MetalUnit = 'TROY_OUNCE' | 'GRAM' | 'KILOGRAM';
export type MetalSettlement = 'PHYSICAL' | 'CASH';

export type MetalContractTerms = Readonly<{
  expiry: string;
  contractSize: string;
  settlement: MetalSettlement;
}>;

export type MetalInstrumentDefinition = Readonly<{
  definitionId: string;
  instrumentId: string;
  metal: PreciousMetalCode;
  marketType: MetalMarketType;
  venue: string;
  quoteCurrency: string;
  settlementCurrency: string;
  unit: MetalUnit;
  purity: number;
  minimumPriceIncrement: string;
  contract?: MetalContractTerms;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>;

export type MetalQuote = Readonly<{
  quoteId: string;
  instrumentId: string;
  venue: string;
  metal: PreciousMetalCode;
  unit: MetalUnit;
  currency: string;
  bidPrice: string;
  askPrice: string;
  observedAt: string;
  availableAt: string;
  receivedAt: string;
  provider: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>;

export type MetalMarketSnapshot = Readonly<{
  schemaVersion: typeof METALS_MARKET_REALITY_SCHEMA_VERSION;
  snapshotId: string;
  instrumentId: string;
  metal: PreciousMetalCode;
  marketType: MetalMarketType;
  venue: string;
  unit: MetalUnit;
  purity: number;
  quoteCurrency: string;
  settlementCurrency: string;
  informationCutoff: string;
  derivedAt: string;
  quote: MetalQuote;
  midPrice: string;
  spreadBps: number;
  contract?: MetalContractTerms;
  methodologyVersion: string;
  sourceManifest: readonly string[];
  evidenceRefs: readonly string[];
  snapshotHash: string;
  researchAuthority: 'INTELLIGENCE_ONLY';
  executionAuthority: 'NONE';
  financialAuthority: 'NONE';
}>;

export type BuildMetalMarketSnapshotInput = Readonly<{
  instrument: CanonicalInstrument;
  definition: MetalInstrumentDefinition;
  quotes: readonly MetalQuote[];
  informationCutoff: string;
  derivedAt: string;
  methodologyVersion: string;
  sourceManifest: readonly string[];
  snapshotHash: string;
}>;

type Decimal = Readonly<{ coefficient: bigint; scale: number }>;

function nonEmpty(value: string, code: string): void {
  if (!value.trim()) throw new Error(code);
}

function timestamp(value: string, code: string): number {
  nonEmpty(value, code);
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(code);
  return parsed;
}

function decimal(value: string, code: string): Decimal {
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) throw new Error(code);
  const [whole = '0', fraction = ''] = value.split('.');
  const coefficient = BigInt(`${whole}${fraction}`);
  if (coefficient <= 0n) throw new Error(code);
  return Object.freeze({ coefficient, scale: fraction.length });
}

function pow10(scale: number): bigint {
  return 10n ** BigInt(scale);
}

function scaled(value: Decimal, scale: number): bigint {
  return value.coefficient * pow10(scale - value.scale);
}

function formatScaled(value: bigint, scale: number): string {
  const raw = value.toString();
  if (scale === 0) return raw;
  const padded = raw.padStart(scale + 1, '0');
  return `${padded.slice(0, -scale)}.${padded.slice(-scale)}`;
}

function midpoint(bidText: string, askText: string): string {
  const bid = decimal(bidText, 'MONEY_METALS_BID_INVALID');
  const ask = decimal(askText, 'MONEY_METALS_ASK_INVALID');
  const scale = Math.max(bid.scale, ask.scale);
  const b = scaled(bid, scale);
  const a = scaled(ask, scale);
  const sum = a + b;
  const midpointScale = scale + 1;
  return formatScaled(sum * 5n, midpointScale);
}

function spreadBps(bidText: string, askText: string): number {
  const bid = decimal(bidText, 'MONEY_METALS_BID_INVALID');
  const ask = decimal(askText, 'MONEY_METALS_ASK_INVALID');
  const scale = Math.max(bid.scale, ask.scale);
  const b = scaled(bid, scale);
  const a = scaled(ask, scale);
  if (a < b) throw new Error('MONEY_METALS_CROSSED_QUOTE');
  const denominator = a + b;
  if (denominator <= 0n) throw new Error('MONEY_METALS_SPREAD_INVALID');
  const numerator = (a - b) * 20000n * 1_000_000n;
  return Number(numerator / denominator) / 1_000_000;
}

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

export function assertMetalDefinition(
  definition: MetalInstrumentDefinition,
  instrument: CanonicalInstrument,
): void {
  nonEmpty(definition.definitionId, 'MONEY_METALS_DEFINITION_ID_REQUIRED');
  nonEmpty(definition.instrumentId, 'MONEY_METALS_INSTRUMENT_ID_REQUIRED');
  nonEmpty(definition.venue, 'MONEY_METALS_VENUE_REQUIRED');
  nonEmpty(definition.quoteCurrency, 'MONEY_METALS_QUOTE_CURRENCY_REQUIRED');
  nonEmpty(definition.settlementCurrency, 'MONEY_METALS_SETTLEMENT_CURRENCY_REQUIRED');
  decimal(definition.minimumPriceIncrement, 'MONEY_METALS_MIN_INCREMENT_INVALID');
  if (!Number.isFinite(definition.purity) || definition.purity <= 0 || definition.purity > 1) {
    throw new Error('MONEY_METALS_PURITY_INVALID');
  }
  if (definition.evidenceRefs.length === 0) throw new Error('MONEY_METALS_EVIDENCE_REQUIRED');
  nonEmpty(definition.provenanceHash, 'MONEY_METALS_PROVENANCE_REQUIRED');

  if (instrument.assetClass !== definition.metal) throw new Error('MONEY_METALS_ASSET_CLASS_MISMATCH');
  if (instrument.instrumentId !== definition.instrumentId) throw new Error('MONEY_METALS_INSTRUMENT_MISMATCH');
  if (instrument.venue !== definition.venue) throw new Error('MONEY_METALS_INSTRUMENT_VENUE_MISMATCH');
  if (instrument.quoteCurrency !== definition.quoteCurrency) throw new Error('MONEY_METALS_INSTRUMENT_CURRENCY_MISMATCH');
  if (instrument.settlementCurrency !== definition.settlementCurrency) throw new Error('MONEY_METALS_INSTRUMENT_SETTLEMENT_MISMATCH');
  if (!instrument.provenanceHash || instrument.identifiers.length === 0) throw new Error('MONEY_METALS_INSTRUMENT_UNPROVEN');

  if (definition.marketType === 'FUTURE') {
    if (!definition.contract) throw new Error('MONEY_METALS_FUTURE_TERMS_REQUIRED');
    timestamp(definition.contract.expiry, 'MONEY_METALS_FUTURE_EXPIRY_INVALID');
    decimal(definition.contract.contractSize, 'MONEY_METALS_FUTURE_SIZE_INVALID');
  } else if (definition.contract) {
    throw new Error('MONEY_METALS_SPOT_CONTRACT_FORBIDDEN');
  }
}

export function assertMetalQuote(
  quote: MetalQuote,
  definition?: MetalInstrumentDefinition,
): void {
  nonEmpty(quote.quoteId, 'MONEY_METALS_QUOTE_ID_REQUIRED');
  nonEmpty(quote.instrumentId, 'MONEY_METALS_QUOTE_INSTRUMENT_REQUIRED');
  nonEmpty(quote.venue, 'MONEY_METALS_QUOTE_VENUE_REQUIRED');
  nonEmpty(quote.currency, 'MONEY_METALS_QUOTE_CURRENCY_REQUIRED');
  const bid = decimal(quote.bidPrice, 'MONEY_METALS_BID_INVALID');
  const ask = decimal(quote.askPrice, 'MONEY_METALS_ASK_INVALID');
  const scale = Math.max(bid.scale, ask.scale);
  if (scaled(ask, scale) < scaled(bid, scale)) throw new Error('MONEY_METALS_CROSSED_QUOTE');

  const observed = timestamp(quote.observedAt, 'MONEY_METALS_QUOTE_OBSERVED_INVALID');
  const available = timestamp(quote.availableAt, 'MONEY_METALS_QUOTE_AVAILABLE_INVALID');
  const received = timestamp(quote.receivedAt, 'MONEY_METALS_QUOTE_RECEIVED_INVALID');
  if (available < observed) throw new Error('MONEY_METALS_QUOTE_AVAILABLE_BEFORE_OBSERVED');
  if (received < available) throw new Error('MONEY_METALS_QUOTE_RECEIVED_BEFORE_AVAILABLE');
  if (quote.evidenceRefs.length === 0) throw new Error('MONEY_METALS_QUOTE_EVIDENCE_REQUIRED');
  nonEmpty(quote.provider, 'MONEY_METALS_QUOTE_PROVIDER_REQUIRED');
  nonEmpty(quote.provenanceHash, 'MONEY_METALS_QUOTE_PROVENANCE_REQUIRED');

  if (definition) {
    if (quote.instrumentId !== definition.instrumentId) throw new Error('MONEY_METALS_QUOTE_INSTRUMENT_MISMATCH');
    if (quote.venue !== definition.venue) throw new Error('MONEY_METALS_QUOTE_VENUE_MISMATCH');
    if (quote.metal !== definition.metal) throw new Error('MONEY_METALS_QUOTE_METAL_MISMATCH');
    if (quote.unit !== definition.unit) throw new Error('MONEY_METALS_QUOTE_UNIT_MISMATCH');
    if (quote.currency !== definition.quoteCurrency) throw new Error('MONEY_METALS_QUOTE_CURRENCY_MISMATCH');
  }
}

export function buildMetalMarketSnapshot(
  input: BuildMetalMarketSnapshotInput,
): MetalMarketSnapshot {
  assertMetalDefinition(input.definition, input.instrument);
  const cutoff = timestamp(input.informationCutoff, 'MONEY_METALS_CUTOFF_INVALID');
  const derivedAt = timestamp(input.derivedAt, 'MONEY_METALS_DERIVED_AT_INVALID');
  if (derivedAt < cutoff) throw new Error('MONEY_METALS_DERIVED_BEFORE_CUTOFF');
  nonEmpty(input.methodologyVersion, 'MONEY_METALS_METHODOLOGY_REQUIRED');
  nonEmpty(input.snapshotHash, 'MONEY_METALS_SNAPSHOT_HASH_REQUIRED');
  if (input.sourceManifest.length === 0) throw new Error('MONEY_METALS_SOURCE_MANIFEST_REQUIRED');

  for (const quote of input.quotes) assertMetalQuote(quote, input.definition);
  const eligible = input.quotes
    .filter((quote) => Date.parse(quote.availableAt) <= cutoff)
    .sort((a, b) => Date.parse(b.availableAt) - Date.parse(a.availableAt));
  const quote = eligible[0];
  if (!quote) throw new Error('MONEY_METALS_QUOTE_REQUIRED_AT_CUTOFF');

  if (
    input.definition.marketType === 'FUTURE' &&
    input.definition.contract &&
    Date.parse(input.definition.contract.expiry) <= cutoff
  ) {
    throw new Error('MONEY_METALS_FUTURE_EXPIRED_AT_CUTOFF');
  }

  return Object.freeze({
    schemaVersion: METALS_MARKET_REALITY_SCHEMA_VERSION,
    snapshotId: `metals:${input.definition.definitionId}:${input.informationCutoff}`,
    instrumentId: input.definition.instrumentId,
    metal: input.definition.metal,
    marketType: input.definition.marketType,
    venue: input.definition.venue,
    unit: input.definition.unit,
    purity: input.definition.purity,
    quoteCurrency: input.definition.quoteCurrency,
    settlementCurrency: input.definition.settlementCurrency,
    informationCutoff: input.informationCutoff,
    derivedAt: input.derivedAt,
    quote,
    midPrice: midpoint(quote.bidPrice, quote.askPrice),
    spreadBps: spreadBps(quote.bidPrice, quote.askPrice),
    contract: input.definition.contract,
    methodologyVersion: input.methodologyVersion,
    sourceManifest: Object.freeze([...input.sourceManifest]),
    evidenceRefs: unique([...input.definition.evidenceRefs, ...quote.evidenceRefs]),
    snapshotHash: input.snapshotHash,
    researchAuthority: 'INTELLIGENCE_ONLY',
    executionAuthority: 'NONE',
    financialAuthority: 'NONE',
  });
}
