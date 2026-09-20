import type { CanonicalInstrument } from './market-instrument-contracts.js';

export const PREDICTION_MARKET_REALITY_SCHEMA_VERSION = 'MONEY-PREDICTION-01' as const;

export type PredictionContractKind = 'BINARY' | 'MULTI_OUTCOME';
export type PredictionMarketStatus = 'UPCOMING' | 'OPEN' | 'CLOSED' | 'RESOLVED' | 'CANCELLED' | 'UNKNOWN';
export type PredictionResolutionStatus = 'FINAL' | 'PENDING' | 'AMBIGUOUS' | 'VOID';

export type PredictionOutcomeDefinition = Readonly<{
  outcomeId: string;
  label: string;
  evidenceRefs: readonly string[];
}>;

export type PredictionResolutionTerms = Readonly<{
  authorityId: string;
  ruleVersion: string;
  canonicalRule: string;
  scheduledResolutionAt: string;
  disputeWindowEndsAt?: string;
  voidTreatment: 'REFUND' | 'VENUE_RULES';
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>;

export type PredictionMarketDefinition = Readonly<{
  definitionId: string;
  marketId: string;
  instrumentId: string;
  venue: string;
  title: string;
  contractKind: PredictionContractKind;
  quoteCurrency: string;
  settlementCurrency: string;
  payoutAmount: number;
  opensAt: string;
  closesAt: string;
  outcomes: readonly PredictionOutcomeDefinition[];
  resolution: PredictionResolutionTerms;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>;

export type PredictionOutcomeQuote = Readonly<{
  quoteId: string;
  marketId: string;
  outcomeId: string;
  bidProbability: number;
  askProbability: number;
  bidSize?: number;
  askSize?: number;
  observedAt: string;
  availableAt: string;
  receivedAt: string;
  provider: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>;

export type PredictionOutcomeState = Readonly<{
  outcomeId: string;
  label: string;
  bidProbability: number;
  askProbability: number;
  midpointProbability: number;
  spreadProbability: number;
  bidSize?: number;
  askSize?: number;
  quoteId: string;
  evidenceRefs: readonly string[];
}>;

export type PredictionMarketSnapshot = Readonly<{
  schemaVersion: typeof PREDICTION_MARKET_REALITY_SCHEMA_VERSION;
  snapshotId: string;
  marketId: string;
  instrumentId: string;
  venue: string;
  title: string;
  contractKind: PredictionContractKind;
  status: PredictionMarketStatus;
  quoteCurrency: string;
  settlementCurrency: string;
  payoutAmount: number;
  opensAt: string;
  closesAt: string;
  informationCutoff: string;
  derivedAt: string;
  outcomes: readonly PredictionOutcomeState[];
  midpointProbabilityMass: number;
  completeSetArbitrage: 'NONE' | 'BUY_ALL' | 'SELL_ALL';
  resolution: PredictionResolutionTerms;
  methodologyVersion: string;
  sourceManifest: readonly string[];
  evidenceRefs: readonly string[];
  snapshotHash: string;
  researchAuthority: 'INTELLIGENCE_ONLY';
  executionAuthority: 'NONE';
  financialAuthority: 'NONE';
}>;

export type PredictionMarketResolution = Readonly<{
  resolutionId: string;
  marketId: string;
  instrumentId: string;
  outcomeId?: string;
  status: PredictionResolutionStatus;
  resolvedAt: string;
  availableAt: string;
  authorityId: string;
  ruleVersion: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>;

export type BuildPredictionMarketSnapshotInput = Readonly<{
  instrument: CanonicalInstrument;
  definition: PredictionMarketDefinition;
  status: PredictionMarketStatus;
  quotes: readonly PredictionOutcomeQuote[];
  informationCutoff: string;
  derivedAt: string;
  methodologyVersion: string;
  sourceManifest: readonly string[];
  snapshotHash: string;
}>;

function nonEmpty(value: string, code: string): void {
  if (!value.trim()) throw new Error(code);
}

function timestamp(value: string, code: string): number {
  nonEmpty(value, code);
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(code);
  return parsed;
}

function probability(value: number, code: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(code);
}

function nonNegative(value: number | undefined, code: string): void {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) throw new Error(code);
}

function positive(value: number, code: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(code);
}

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

function round(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

export function assertPredictionMarketDefinition(
  definition: PredictionMarketDefinition,
  instrument: CanonicalInstrument,
): void {
  nonEmpty(definition.definitionId, 'MONEY_PREDICTION_DEFINITION_ID_REQUIRED');
  nonEmpty(definition.marketId, 'MONEY_PREDICTION_MARKET_ID_REQUIRED');
  nonEmpty(definition.instrumentId, 'MONEY_PREDICTION_INSTRUMENT_ID_REQUIRED');
  nonEmpty(definition.venue, 'MONEY_PREDICTION_VENUE_REQUIRED');
  nonEmpty(definition.title, 'MONEY_PREDICTION_TITLE_REQUIRED');
  nonEmpty(definition.quoteCurrency, 'MONEY_PREDICTION_QUOTE_CURRENCY_REQUIRED');
  nonEmpty(definition.settlementCurrency, 'MONEY_PREDICTION_SETTLEMENT_CURRENCY_REQUIRED');
  positive(definition.payoutAmount, 'MONEY_PREDICTION_PAYOUT_INVALID');

  const opens = timestamp(definition.opensAt, 'MONEY_PREDICTION_OPENS_AT_INVALID');
  const closes = timestamp(definition.closesAt, 'MONEY_PREDICTION_CLOSES_AT_INVALID');
  const scheduled = timestamp(
    definition.resolution.scheduledResolutionAt,
    'MONEY_PREDICTION_RESOLUTION_AT_INVALID',
  );
  if (closes <= opens) throw new Error('MONEY_PREDICTION_WINDOW_INVALID');
  if (scheduled < closes) throw new Error('MONEY_PREDICTION_RESOLUTION_BEFORE_CLOSE');

  if (definition.resolution.disputeWindowEndsAt !== undefined) {
    const dispute = timestamp(
      definition.resolution.disputeWindowEndsAt,
      'MONEY_PREDICTION_DISPUTE_AT_INVALID',
    );
    if (dispute < scheduled) throw new Error('MONEY_PREDICTION_DISPUTE_WINDOW_INVALID');
  }

  nonEmpty(definition.resolution.authorityId, 'MONEY_PREDICTION_RESOLUTION_AUTHORITY_REQUIRED');
  nonEmpty(definition.resolution.ruleVersion, 'MONEY_PREDICTION_RESOLUTION_RULE_VERSION_REQUIRED');
  nonEmpty(definition.resolution.canonicalRule, 'MONEY_PREDICTION_RESOLUTION_RULE_REQUIRED');
  nonEmpty(definition.resolution.provenanceHash, 'MONEY_PREDICTION_RESOLUTION_PROVENANCE_REQUIRED');
  if (definition.resolution.evidenceRefs.length === 0) {
    throw new Error('MONEY_PREDICTION_RESOLUTION_EVIDENCE_REQUIRED');
  }

  if (definition.outcomes.length < 2) throw new Error('MONEY_PREDICTION_OUTCOMES_INSUFFICIENT');
  if (definition.contractKind === 'BINARY' && definition.outcomes.length !== 2) {
    throw new Error('MONEY_PREDICTION_BINARY_OUTCOME_COUNT_INVALID');
  }

  const ids = new Set<string>();
  for (const outcome of definition.outcomes) {
    nonEmpty(outcome.outcomeId, 'MONEY_PREDICTION_OUTCOME_ID_REQUIRED');
    nonEmpty(outcome.label, 'MONEY_PREDICTION_OUTCOME_LABEL_REQUIRED');
    if (outcome.evidenceRefs.length === 0) throw new Error('MONEY_PREDICTION_OUTCOME_EVIDENCE_REQUIRED');
    if (ids.has(outcome.outcomeId)) throw new Error('MONEY_PREDICTION_DUPLICATE_OUTCOME');
    ids.add(outcome.outcomeId);
  }

  if (definition.evidenceRefs.length === 0) throw new Error('MONEY_PREDICTION_DEFINITION_EVIDENCE_REQUIRED');
  nonEmpty(definition.provenanceHash, 'MONEY_PREDICTION_DEFINITION_PROVENANCE_REQUIRED');

  if (instrument.assetClass !== 'PREDICTION') throw new Error('MONEY_PREDICTION_ASSET_CLASS_REQUIRED');
  if (instrument.instrumentId !== definition.instrumentId) throw new Error('MONEY_PREDICTION_INSTRUMENT_MISMATCH');
  if (instrument.venue !== definition.venue) throw new Error('MONEY_PREDICTION_INSTRUMENT_VENUE_MISMATCH');
  if (instrument.quoteCurrency !== definition.quoteCurrency) throw new Error('MONEY_PREDICTION_INSTRUMENT_QUOTE_CURRENCY_MISMATCH');
  if (instrument.settlementCurrency !== definition.settlementCurrency) throw new Error('MONEY_PREDICTION_INSTRUMENT_SETTLEMENT_CURRENCY_MISMATCH');
  if (!instrument.identifiers.length || !instrument.provenanceHash) throw new Error('MONEY_PREDICTION_INSTRUMENT_UNPROVEN');
}

export function assertPredictionOutcomeQuote(
  quote: PredictionOutcomeQuote,
  definition?: PredictionMarketDefinition,
): void {
  nonEmpty(quote.quoteId, 'MONEY_PREDICTION_QUOTE_ID_REQUIRED');
  nonEmpty(quote.marketId, 'MONEY_PREDICTION_QUOTE_MARKET_REQUIRED');
  nonEmpty(quote.outcomeId, 'MONEY_PREDICTION_QUOTE_OUTCOME_REQUIRED');
  probability(quote.bidProbability, 'MONEY_PREDICTION_BID_INVALID');
  probability(quote.askProbability, 'MONEY_PREDICTION_ASK_INVALID');
  if (quote.askProbability < quote.bidProbability) throw new Error('MONEY_PREDICTION_CROSSED_QUOTE');
  nonNegative(quote.bidSize, 'MONEY_PREDICTION_BID_SIZE_INVALID');
  nonNegative(quote.askSize, 'MONEY_PREDICTION_ASK_SIZE_INVALID');

  const observed = timestamp(quote.observedAt, 'MONEY_PREDICTION_QUOTE_OBSERVED_INVALID');
  const available = timestamp(quote.availableAt, 'MONEY_PREDICTION_QUOTE_AVAILABLE_INVALID');
  const received = timestamp(quote.receivedAt, 'MONEY_PREDICTION_QUOTE_RECEIVED_INVALID');
  if (available < observed) throw new Error('MONEY_PREDICTION_QUOTE_AVAILABLE_BEFORE_OBSERVED');
  if (received < available) throw new Error('MONEY_PREDICTION_QUOTE_RECEIVED_BEFORE_AVAILABLE');

  nonEmpty(quote.provider, 'MONEY_PREDICTION_QUOTE_PROVIDER_REQUIRED');
  if (!quote.evidenceRefs.length) throw new Error('MONEY_PREDICTION_QUOTE_EVIDENCE_REQUIRED');
  nonEmpty(quote.provenanceHash, 'MONEY_PREDICTION_QUOTE_PROVENANCE_REQUIRED');

  if (definition) {
    if (quote.marketId !== definition.marketId) throw new Error('MONEY_PREDICTION_QUOTE_MARKET_MISMATCH');
    if (!definition.outcomes.some((outcome) => outcome.outcomeId === quote.outcomeId)) {
      throw new Error('MONEY_PREDICTION_QUOTE_UNKNOWN_OUTCOME');
    }
  }
}

function latestQuoteAtCutoff(
  quotes: readonly PredictionOutcomeQuote[],
  outcomeId: string,
  cutoff: number,
): PredictionOutcomeQuote | undefined {
  return [...quotes]
    .filter((quote) => quote.outcomeId === outcomeId && Date.parse(quote.availableAt) <= cutoff)
    .sort((a, b) => Date.parse(b.availableAt) - Date.parse(a.availableAt))[0];
}

export function buildPredictionMarketSnapshot(
  input: BuildPredictionMarketSnapshotInput,
): PredictionMarketSnapshot {
  assertPredictionMarketDefinition(input.definition, input.instrument);
  const cutoff = timestamp(input.informationCutoff, 'MONEY_PREDICTION_CUTOFF_INVALID');
  const derived = timestamp(input.derivedAt, 'MONEY_PREDICTION_DERIVED_AT_INVALID');
  if (derived < cutoff) throw new Error('MONEY_PREDICTION_DERIVED_BEFORE_CUTOFF');
  nonEmpty(input.methodologyVersion, 'MONEY_PREDICTION_METHODOLOGY_REQUIRED');
  nonEmpty(input.snapshotHash, 'MONEY_PREDICTION_SNAPSHOT_HASH_REQUIRED');
  if (!input.sourceManifest.length) throw new Error('MONEY_PREDICTION_SOURCE_MANIFEST_REQUIRED');

  for (const quote of input.quotes) assertPredictionOutcomeQuote(quote, input.definition);

  const states: PredictionOutcomeState[] = input.definition.outcomes.map((outcome) => {
    const quote = latestQuoteAtCutoff(input.quotes, outcome.outcomeId, cutoff);
    if (!quote) throw new Error('MONEY_PREDICTION_OUTCOME_QUOTE_REQUIRED_AT_CUTOFF');
    return Object.freeze({
      outcomeId: outcome.outcomeId,
      label: outcome.label,
      bidProbability: quote.bidProbability,
      askProbability: quote.askProbability,
      midpointProbability: round((quote.bidProbability + quote.askProbability) / 2),
      spreadProbability: round(quote.askProbability - quote.bidProbability),
      bidSize: quote.bidSize,
      askSize: quote.askSize,
      quoteId: quote.quoteId,
      evidenceRefs: Object.freeze([...quote.evidenceRefs]),
    });
  });

  const bidMass = states.reduce((sum, state) => sum + state.bidProbability, 0);
  const askMass = states.reduce((sum, state) => sum + state.askProbability, 0);
  const midpointProbabilityMass = round(states.reduce((sum, state) => sum + state.midpointProbability, 0));

  let completeSetArbitrage: PredictionMarketSnapshot['completeSetArbitrage'] = 'NONE';
  if (askMass < 1 - 1e-9) completeSetArbitrage = 'BUY_ALL';
  else if (bidMass > 1 + 1e-9) completeSetArbitrage = 'SELL_ALL';

  return Object.freeze({
    schemaVersion: PREDICTION_MARKET_REALITY_SCHEMA_VERSION,
    snapshotId: `prediction:${input.definition.marketId}:${input.informationCutoff}`,
    marketId: input.definition.marketId,
    instrumentId: input.definition.instrumentId,
    venue: input.definition.venue,
    title: input.definition.title,
    contractKind: input.definition.contractKind,
    status: input.status,
    quoteCurrency: input.definition.quoteCurrency,
    settlementCurrency: input.definition.settlementCurrency,
    payoutAmount: input.definition.payoutAmount,
    opensAt: input.definition.opensAt,
    closesAt: input.definition.closesAt,
    informationCutoff: input.informationCutoff,
    derivedAt: input.derivedAt,
    outcomes: Object.freeze(states),
    midpointProbabilityMass,
    completeSetArbitrage,
    resolution: input.definition.resolution,
    methodologyVersion: input.methodologyVersion,
    sourceManifest: Object.freeze([...input.sourceManifest]),
    evidenceRefs: unique([
      ...input.definition.evidenceRefs,
      ...input.definition.resolution.evidenceRefs,
      ...input.definition.outcomes.flatMap((outcome) => outcome.evidenceRefs),
      ...states.flatMap((state) => state.evidenceRefs),
    ]),
    snapshotHash: input.snapshotHash,
    researchAuthority: 'INTELLIGENCE_ONLY',
    executionAuthority: 'NONE',
    financialAuthority: 'NONE',
  });
}

export function assertPredictionMarketResolution(input: Readonly<{
  definition: PredictionMarketDefinition;
  instrument: CanonicalInstrument;
  resolution: PredictionMarketResolution;
}>): void {
  assertPredictionMarketDefinition(input.definition, input.instrument);
  const resolution = input.resolution;
  nonEmpty(resolution.resolutionId, 'MONEY_PREDICTION_FINAL_RESOLUTION_ID_REQUIRED');
  if (resolution.marketId !== input.definition.marketId) throw new Error('MONEY_PREDICTION_FINAL_MARKET_MISMATCH');
  if (resolution.instrumentId !== input.definition.instrumentId) throw new Error('MONEY_PREDICTION_FINAL_INSTRUMENT_MISMATCH');
  if (resolution.authorityId !== input.definition.resolution.authorityId) throw new Error('MONEY_PREDICTION_FINAL_AUTHORITY_MISMATCH');
  if (resolution.ruleVersion !== input.definition.resolution.ruleVersion) throw new Error('MONEY_PREDICTION_FINAL_RULE_MISMATCH');

  const resolved = timestamp(resolution.resolvedAt, 'MONEY_PREDICTION_FINAL_RESOLVED_AT_INVALID');
  const available = timestamp(resolution.availableAt, 'MONEY_PREDICTION_FINAL_AVAILABLE_AT_INVALID');
  const close = timestamp(input.definition.closesAt, 'MONEY_PREDICTION_CLOSES_AT_INVALID');
  if (resolved < close) throw new Error('MONEY_PREDICTION_FINAL_BEFORE_CLOSE');
  if (available < resolved) throw new Error('MONEY_PREDICTION_FINAL_AVAILABLE_BEFORE_RESOLVED');

  if (resolution.status === 'FINAL') {
    if (!resolution.outcomeId) throw new Error('MONEY_PREDICTION_FINAL_OUTCOME_REQUIRED');
    if (!input.definition.outcomes.some((outcome) => outcome.outcomeId === resolution.outcomeId)) {
      throw new Error('MONEY_PREDICTION_FINAL_UNKNOWN_OUTCOME');
    }
  } else if (resolution.outcomeId !== undefined) {
    throw new Error('MONEY_PREDICTION_NONFINAL_OUTCOME_FORBIDDEN');
  }

  if (!resolution.evidenceRefs.length) throw new Error('MONEY_PREDICTION_FINAL_EVIDENCE_REQUIRED');
  nonEmpty(resolution.provenanceHash, 'MONEY_PREDICTION_FINAL_PROVENANCE_REQUIRED');
}
