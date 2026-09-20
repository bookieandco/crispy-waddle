import type { CanonicalInstrument } from './market-instrument-contracts.js';
import type { MacroSnapshotV2 } from './macro-economic-contracts-v2.js';

export const FX_MARKET_REALITY_SCHEMA_VERSION = 'MONEY-FOREX-01' as const;

export type FxCurrencyKind =
  | 'FIAT'
  | 'OFFSHORE'
  | 'RESTRICTED'
  | 'OTHER';

export type FxPairMarketType =
  | 'SPOT_DELIVERABLE'
  | 'NDF';

export type FxQuoteSourceType =
  | 'DIRECT'
  | 'CROSS_DERIVED';

export type FxSessionName =
  | 'SYDNEY'
  | 'TOKYO'
  | 'LONDON'
  | 'NEW_YORK'
  | 'CUSTOM';

export type FxSessionStatus =
  | 'OPEN'
  | 'CLOSED'
  | 'HOLIDAY'
  | 'SUSPENDED'
  | 'UNKNOWN';

export type FxWeekday =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export type FxCurrency = Readonly<{
  currencyId: string;
  code: string;
  name: string;
  kind: FxCurrencyKind;
  jurisdiction: string;
  centralBankId?: string;
  settlementCalendarId: string;
  minorUnits: number;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>;

export type FxPairDefinition = Readonly<{
  pairId: string;
  instrumentId: string;
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  settlementCurrency: string;
  marketType: FxPairMarketType;
  venue: string;
  settlementLagBusinessDays: number;
  pricePrecision: number;
  pipSize: string;
  minimumPriceIncrement: string;
  standardLotBaseUnits: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>;

export type FxQuote = Readonly<{
  quoteId: string;
  pairId: string;
  baseCurrency: string;
  quoteCurrency: string;
  bidPrice: string;
  askPrice: string;
  observedAt: string;
  availableAt: string;
  receivedAt: string;
  provider: string;
  sourceType: FxQuoteSourceType;
  sourceQuoteIds: readonly string[];
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>;

export type FxTradingSession = Readonly<{
  sessionId: string;
  name: FxSessionName;
  timezone: string;
  opensAt: string;
  closesAt: string;
  status: FxSessionStatus;
  observedAt: string;
  availableAt: string;
  receivedAt: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>;

export type FxCarryObservation = Readonly<{
  carryId: string;
  pairId: string;
  baseCurrency: string;
  quoteCurrency: string;
  basePolicyRatePct: number;
  quotePolicyRatePct: number;
  rateDifferentialPct: number;
  longSwapPoints: string;
  shortSwapPoints: string;
  swapPointUnit: 'PIPS' | 'PRICE';
  rolloverAt: string;
  tripleRolloverWeekday: FxWeekday;
  observedAt: string;
  availableAt: string;
  receivedAt: string;
  provider: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>;

export type FxMacroContext = Readonly<{
  contextId: string;
  currencyCode: string;
  jurisdiction: string;
  centralBankId?: string;
  macroSnapshotId: string;
  macroInformationCutoff: string;
  macroArtifactIds: readonly string[];
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>;

export type FxMarketSnapshot = Readonly<{
  schemaVersion: typeof FX_MARKET_REALITY_SCHEMA_VERSION;
  snapshotId: string;
  pairId: string;
  instrumentId: string;
  baseCurrency: string;
  quoteCurrency: string;
  settlementCurrency: string;
  informationCutoff: string;
  derivedAt: string;
  quote: FxQuote;
  spreadPips: number;
  activeSessions: readonly FxTradingSession[];
  carry?: FxCarryObservation;
  baseMacroContext: FxMacroContext;
  quoteMacroContext: FxMacroContext;
  methodologyVersion: string;
  sourceManifest: readonly string[];
  evidenceRefs: readonly string[];
  snapshotHash: string;
  researchAuthority: 'INTELLIGENCE_ONLY';
  executionAuthority: 'NONE';
  financialAuthority: 'NONE';
}>;

export type BuildFxMarketSnapshotInput = Readonly<{
  instrument: CanonicalInstrument;
  pair: FxPairDefinition;
  baseCurrency: FxCurrency;
  quoteCurrency: FxCurrency;
  quotes: readonly FxQuote[];
  sessions: readonly FxTradingSession[];
  carryObservations: readonly FxCarryObservation[];
  macroContexts: readonly FxMacroContext[];
  informationCutoff: string;
  derivedAt: string;
  methodologyVersion: string;
  sourceManifest: readonly string[];
  snapshotHash: string;
}>;

type ParsedDecimal = Readonly<{
  coefficient: bigint;
  scale: number;
}>;

function assertNonEmpty(value: string, code: string): void {
  if (!value.trim()) throw new Error(code);
}

function parseTimestamp(value: string, code: string): number {
  assertNonEmpty(value, code);
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(code);
  return parsed;
}

function assertCurrencyCode(value: string, code: string): void {
  if (!/^[A-Z]{3}$/.test(value)) throw new Error(code);
}

function parsePositiveDecimal(value: string, code: string): ParsedDecimal {
  assertNonEmpty(value, code);
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) {
    throw new Error(code);
  }

  const [whole = '0', fraction = ''] = value.split('.');
  const coefficient = BigInt(`${whole}${fraction}`);
  if (coefficient <= 0n) throw new Error(code);
  return Object.freeze({
    coefficient,
    scale: fraction.length,
  });
}

function pow10(scale: number): bigint {
  return 10n ** BigInt(scale);
}

function roundedDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new Error('MONEY_FX_DECIMAL_DIVISOR_INVALID');
  }
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

function rescaleDecimal(value: ParsedDecimal, targetScale: number): bigint {
  if (!Number.isInteger(targetScale) || targetScale < 0) {
    throw new Error('MONEY_FX_DECIMAL_SCALE_INVALID');
  }
  if (value.scale === targetScale) return value.coefficient;
  if (value.scale < targetScale) {
    return value.coefficient * pow10(targetScale - value.scale);
  }
  return roundedDivide(
    value.coefficient,
    pow10(value.scale - targetScale),
  );
}

function formatScaled(coefficient: bigint, scale: number): string {
  if (coefficient < 0n) {
    throw new Error('MONEY_FX_NEGATIVE_DECIMAL_FORBIDDEN');
  }
  const raw = coefficient.toString();
  if (scale === 0) return raw;
  const padded = raw.padStart(scale + 1, '0');
  const whole = padded.slice(0, -scale);
  const fraction = padded.slice(-scale);
  return `${whole}.${fraction}`;
}

function compareDecimalStrings(left: string, right: string): number {
  const a = parsePositiveDecimal(left, 'MONEY_FX_DECIMAL_INVALID');
  const b = parsePositiveDecimal(right, 'MONEY_FX_DECIMAL_INVALID');
  const scale = Math.max(a.scale, b.scale);
  const leftScaled = rescaleDecimal(a, scale);
  const rightScaled = rescaleDecimal(b, scale);
  return leftScaled < rightScaled ? -1 : leftScaled > rightScaled ? 1 : 0;
}

function multiplyDecimalStrings(
  left: string,
  right: string,
  targetScale: number,
): string {
  const a = parsePositiveDecimal(left, 'MONEY_FX_DECIMAL_INVALID');
  const b = parsePositiveDecimal(right, 'MONEY_FX_DECIMAL_INVALID');
  const product: ParsedDecimal = {
    coefficient: a.coefficient * b.coefficient,
    scale: a.scale + b.scale,
  };
  return formatScaled(rescaleDecimal(product, targetScale), targetScale);
}

function invertDecimalString(value: string, targetScale: number): string {
  const parsed = parsePositiveDecimal(value, 'MONEY_FX_DECIMAL_INVALID');
  const numerator = pow10(parsed.scale + targetScale);
  const coefficient = roundedDivide(numerator, parsed.coefficient);
  if (coefficient <= 0n) {
    throw new Error('MONEY_FX_DECIMAL_INVERSION_INVALID');
  }
  return formatScaled(coefficient, targetScale);
}

function decimalDifferenceAsNumber(left: string, right: string): number {
  const a = parsePositiveDecimal(left, 'MONEY_FX_DECIMAL_INVALID');
  const b = parsePositiveDecimal(right, 'MONEY_FX_DECIMAL_INVALID');
  const scale = Math.max(a.scale, b.scale);
  const difference = rescaleDecimal(a, scale) - rescaleDecimal(b, scale);
  return Number(difference) / 10 ** scale;
}

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

function latestByAvailableAt<T extends Readonly<{ availableAt: string }>>(
  records: readonly T[],
): T | undefined {
  return [...records].sort(
    (a, b) => Date.parse(b.availableAt) - Date.parse(a.availableAt),
  )[0];
}

function latestByMacroCutoff(
  contexts: readonly FxMacroContext[],
): FxMacroContext | undefined {
  return [...contexts].sort(
    (a, b) =>
      Date.parse(b.macroInformationCutoff) -
      Date.parse(a.macroInformationCutoff),
  )[0];
}

function maxTimestamp(values: readonly string[]): string {
  return values.reduce((latest, candidate) =>
    Date.parse(candidate) > Date.parse(latest) ? candidate : latest,
  );
}

export function assertFxCurrency(currency: FxCurrency): void {
  assertNonEmpty(currency.currencyId, 'MONEY_FX_CURRENCY_ID_REQUIRED');
  assertCurrencyCode(currency.code, 'MONEY_FX_CURRENCY_CODE_INVALID');
  assertNonEmpty(currency.name, 'MONEY_FX_CURRENCY_NAME_REQUIRED');
  assertNonEmpty(currency.jurisdiction, 'MONEY_FX_CURRENCY_JURISDICTION_REQUIRED');
  assertNonEmpty(
    currency.settlementCalendarId,
    'MONEY_FX_CURRENCY_CALENDAR_REQUIRED',
  );
  if (
    !Number.isInteger(currency.minorUnits) ||
    currency.minorUnits < 0 ||
    currency.minorUnits > 6
  ) {
    throw new Error('MONEY_FX_CURRENCY_MINOR_UNITS_INVALID');
  }
  if (currency.evidenceRefs.length === 0) {
    throw new Error('MONEY_FX_CURRENCY_EVIDENCE_REQUIRED');
  }
  assertNonEmpty(currency.provenanceHash, 'MONEY_FX_CURRENCY_PROVENANCE_REQUIRED');
}

export function assertFxPair(
  pair: FxPairDefinition,
  instrument: CanonicalInstrument,
  baseCurrency: FxCurrency,
  quoteCurrency: FxCurrency,
): void {
  assertFxCurrency(baseCurrency);
  assertFxCurrency(quoteCurrency);

  assertNonEmpty(pair.pairId, 'MONEY_FX_PAIR_ID_REQUIRED');
  assertNonEmpty(pair.instrumentId, 'MONEY_FX_PAIR_INSTRUMENT_REQUIRED');
  assertNonEmpty(pair.symbol, 'MONEY_FX_PAIR_SYMBOL_REQUIRED');
  assertCurrencyCode(pair.baseCurrency, 'MONEY_FX_PAIR_BASE_INVALID');
  assertCurrencyCode(pair.quoteCurrency, 'MONEY_FX_PAIR_QUOTE_INVALID');
  assertCurrencyCode(pair.settlementCurrency, 'MONEY_FX_PAIR_SETTLEMENT_INVALID');
  assertNonEmpty(pair.venue, 'MONEY_FX_PAIR_VENUE_REQUIRED');

  if (pair.baseCurrency === pair.quoteCurrency) {
    throw new Error('MONEY_FX_PAIR_IDENTICAL_CURRENCIES');
  }
  if (
    pair.baseCurrency !== baseCurrency.code ||
    pair.quoteCurrency !== quoteCurrency.code
  ) {
    throw new Error('MONEY_FX_PAIR_CURRENCY_DEFINITION_MISMATCH');
  }
  if (
    !Number.isInteger(pair.settlementLagBusinessDays) ||
    pair.settlementLagBusinessDays < 0 ||
    pair.settlementLagBusinessDays > 10
  ) {
    throw new Error('MONEY_FX_PAIR_SETTLEMENT_LAG_INVALID');
  }
  if (
    !Number.isInteger(pair.pricePrecision) ||
    pair.pricePrecision < 1 ||
    pair.pricePrecision > 12
  ) {
    throw new Error('MONEY_FX_PAIR_PRICE_PRECISION_INVALID');
  }

  parsePositiveDecimal(pair.pipSize, 'MONEY_FX_PAIR_PIP_SIZE_INVALID');
  parsePositiveDecimal(
    pair.minimumPriceIncrement,
    'MONEY_FX_PAIR_MIN_INCREMENT_INVALID',
  );
  parsePositiveDecimal(
    pair.standardLotBaseUnits,
    'MONEY_FX_PAIR_STANDARD_LOT_INVALID',
  );

  if (pair.evidenceRefs.length === 0) {
    throw new Error('MONEY_FX_PAIR_EVIDENCE_REQUIRED');
  }
  assertNonEmpty(pair.provenanceHash, 'MONEY_FX_PAIR_PROVENANCE_REQUIRED');

  if (instrument.assetClass !== 'FOREX') {
    throw new Error('MONEY_FX_INSTRUMENT_ASSET_CLASS_REQUIRED');
  }
  if (instrument.instrumentId !== pair.instrumentId) {
    throw new Error('MONEY_FX_INSTRUMENT_ID_MISMATCH');
  }
  if (instrument.venue !== pair.venue) {
    throw new Error('MONEY_FX_INSTRUMENT_VENUE_MISMATCH');
  }
  if (instrument.quoteCurrency !== pair.quoteCurrency) {
    throw new Error('MONEY_FX_INSTRUMENT_QUOTE_CURRENCY_MISMATCH');
  }
  if (instrument.settlementCurrency !== pair.settlementCurrency) {
    throw new Error('MONEY_FX_INSTRUMENT_SETTLEMENT_CURRENCY_MISMATCH');
  }
  if (!instrument.provenanceHash) {
    throw new Error('MONEY_FX_INSTRUMENT_UNPROVEN');
  }
}

export function assertFxQuote(
  quote: FxQuote,
  pair?: FxPairDefinition,
): void {
  assertNonEmpty(quote.quoteId, 'MONEY_FX_QUOTE_ID_REQUIRED');
  assertNonEmpty(quote.pairId, 'MONEY_FX_QUOTE_PAIR_REQUIRED');
  assertCurrencyCode(quote.baseCurrency, 'MONEY_FX_QUOTE_BASE_INVALID');
  assertCurrencyCode(quote.quoteCurrency, 'MONEY_FX_QUOTE_QUOTE_INVALID');

  const bid = parsePositiveDecimal(
    quote.bidPrice,
    'MONEY_FX_QUOTE_BID_INVALID',
  );
  const ask = parsePositiveDecimal(
    quote.askPrice,
    'MONEY_FX_QUOTE_ASK_INVALID',
  );
  const scale = Math.max(bid.scale, ask.scale);
  if (rescaleDecimal(ask, scale) < rescaleDecimal(bid, scale)) {
    throw new Error('MONEY_FX_CROSSED_QUOTE');
  }

  const observed = parseTimestamp(
    quote.observedAt,
    'MONEY_FX_QUOTE_OBSERVED_AT_INVALID',
  );
  const available = parseTimestamp(
    quote.availableAt,
    'MONEY_FX_QUOTE_AVAILABLE_AT_INVALID',
  );
  const received = parseTimestamp(
    quote.receivedAt,
    'MONEY_FX_QUOTE_RECEIVED_AT_INVALID',
  );
  if (available < observed) {
    throw new Error('MONEY_FX_QUOTE_AVAILABLE_BEFORE_OBSERVED');
  }
  if (received < available) {
    throw new Error('MONEY_FX_QUOTE_RECEIVED_BEFORE_AVAILABLE');
  }

  assertNonEmpty(quote.provider, 'MONEY_FX_QUOTE_PROVIDER_REQUIRED');
  assertNonEmpty(quote.provenanceHash, 'MONEY_FX_QUOTE_PROVENANCE_REQUIRED');
  if (quote.evidenceRefs.length === 0) {
    throw new Error('MONEY_FX_QUOTE_EVIDENCE_REQUIRED');
  }

  if (quote.sourceType === 'DIRECT' && quote.sourceQuoteIds.length !== 0) {
    throw new Error('MONEY_FX_DIRECT_QUOTE_SOURCE_IDS_FORBIDDEN');
  }
  if (
    quote.sourceType === 'CROSS_DERIVED' &&
    quote.sourceQuoteIds.length < 2
  ) {
    throw new Error('MONEY_FX_CROSS_QUOTE_SOURCE_IDS_REQUIRED');
  }

  if (pair) {
    if (quote.pairId !== pair.pairId) {
      throw new Error('MONEY_FX_QUOTE_PAIR_MISMATCH');
    }
    if (
      quote.baseCurrency !== pair.baseCurrency ||
      quote.quoteCurrency !== pair.quoteCurrency
    ) {
      throw new Error('MONEY_FX_QUOTE_CURRENCY_MISMATCH');
    }
  }
}

export function assertFxTradingSession(session: FxTradingSession): void {
  assertNonEmpty(session.sessionId, 'MONEY_FX_SESSION_ID_REQUIRED');
  assertNonEmpty(session.timezone, 'MONEY_FX_SESSION_TIMEZONE_REQUIRED');

  const opens = parseTimestamp(
    session.opensAt,
    'MONEY_FX_SESSION_OPEN_INVALID',
  );
  const closes = parseTimestamp(
    session.closesAt,
    'MONEY_FX_SESSION_CLOSE_INVALID',
  );
  const observed = parseTimestamp(
    session.observedAt,
    'MONEY_FX_SESSION_OBSERVED_AT_INVALID',
  );
  const available = parseTimestamp(
    session.availableAt,
    'MONEY_FX_SESSION_AVAILABLE_AT_INVALID',
  );
  const received = parseTimestamp(
    session.receivedAt,
    'MONEY_FX_SESSION_RECEIVED_AT_INVALID',
  );

  if (closes <= opens) {
    throw new Error('MONEY_FX_SESSION_RANGE_INVALID');
  }
  if (available < observed) {
    throw new Error('MONEY_FX_SESSION_AVAILABLE_BEFORE_OBSERVED');
  }
  if (received < available) {
    throw new Error('MONEY_FX_SESSION_RECEIVED_BEFORE_AVAILABLE');
  }
  if (session.evidenceRefs.length === 0) {
    throw new Error('MONEY_FX_SESSION_EVIDENCE_REQUIRED');
  }
  assertNonEmpty(
    session.provenanceHash,
    'MONEY_FX_SESSION_PROVENANCE_REQUIRED',
  );
}

export function buildFxCarryObservation(input: Readonly<{
  carryId: string;
  pair: FxPairDefinition;
  basePolicyRatePct: number;
  quotePolicyRatePct: number;
  longSwapPoints: string;
  shortSwapPoints: string;
  swapPointUnit: 'PIPS' | 'PRICE';
  rolloverAt: string;
  tripleRolloverWeekday: FxWeekday;
  observedAt: string;
  availableAt: string;
  receivedAt: string;
  provider: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>): FxCarryObservation {
  if (
    !Number.isFinite(input.basePolicyRatePct) ||
    !Number.isFinite(input.quotePolicyRatePct)
  ) {
    throw new Error('MONEY_FX_CARRY_POLICY_RATE_INVALID');
  }
  parsePositiveDecimal(
    input.longSwapPoints.startsWith('-')
      ? input.longSwapPoints.slice(1)
      : input.longSwapPoints,
    'MONEY_FX_CARRY_LONG_SWAP_INVALID',
  );
  parsePositiveDecimal(
    input.shortSwapPoints.startsWith('-')
      ? input.shortSwapPoints.slice(1)
      : input.shortSwapPoints,
    'MONEY_FX_CARRY_SHORT_SWAP_INVALID',
  );

  const observation: FxCarryObservation = Object.freeze({
    carryId: input.carryId,
    pairId: input.pair.pairId,
    baseCurrency: input.pair.baseCurrency,
    quoteCurrency: input.pair.quoteCurrency,
    basePolicyRatePct: input.basePolicyRatePct,
    quotePolicyRatePct: input.quotePolicyRatePct,
    rateDifferentialPct:
      input.basePolicyRatePct - input.quotePolicyRatePct,
    longSwapPoints: input.longSwapPoints,
    shortSwapPoints: input.shortSwapPoints,
    swapPointUnit: input.swapPointUnit,
    rolloverAt: input.rolloverAt,
    tripleRolloverWeekday: input.tripleRolloverWeekday,
    observedAt: input.observedAt,
    availableAt: input.availableAt,
    receivedAt: input.receivedAt,
    provider: input.provider,
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    provenanceHash: input.provenanceHash,
  });
  assertFxCarryObservation(observation, input.pair);
  return observation;
}

export function assertFxCarryObservation(
  observation: FxCarryObservation,
  pair?: FxPairDefinition,
): void {
  assertNonEmpty(observation.carryId, 'MONEY_FX_CARRY_ID_REQUIRED');
  assertNonEmpty(observation.pairId, 'MONEY_FX_CARRY_PAIR_REQUIRED');
  assertCurrencyCode(
    observation.baseCurrency,
    'MONEY_FX_CARRY_BASE_INVALID',
  );
  assertCurrencyCode(
    observation.quoteCurrency,
    'MONEY_FX_CARRY_QUOTE_INVALID',
  );

  if (
    !Number.isFinite(observation.basePolicyRatePct) ||
    !Number.isFinite(observation.quotePolicyRatePct) ||
    !Number.isFinite(observation.rateDifferentialPct)
  ) {
    throw new Error('MONEY_FX_CARRY_RATE_INVALID');
  }
  if (
    Math.abs(
      observation.rateDifferentialPct -
        (observation.basePolicyRatePct -
          observation.quotePolicyRatePct),
    ) > 1e-9
  ) {
    throw new Error('MONEY_FX_CARRY_DIFFERENTIAL_INCONSISTENT');
  }

  const parseSigned = (value: string, code: string): void => {
    const unsigned = value.startsWith('-') ? value.slice(1) : value;
    parsePositiveDecimal(unsigned, code);
  };
  parseSigned(
    observation.longSwapPoints,
    'MONEY_FX_CARRY_LONG_SWAP_INVALID',
  );
  parseSigned(
    observation.shortSwapPoints,
    'MONEY_FX_CARRY_SHORT_SWAP_INVALID',
  );

  parseTimestamp(
    observation.rolloverAt,
    'MONEY_FX_CARRY_ROLLOVER_INVALID',
  );
  const observed = parseTimestamp(
    observation.observedAt,
    'MONEY_FX_CARRY_OBSERVED_AT_INVALID',
  );
  const available = parseTimestamp(
    observation.availableAt,
    'MONEY_FX_CARRY_AVAILABLE_AT_INVALID',
  );
  const received = parseTimestamp(
    observation.receivedAt,
    'MONEY_FX_CARRY_RECEIVED_AT_INVALID',
  );
  if (available < observed) {
    throw new Error('MONEY_FX_CARRY_AVAILABLE_BEFORE_OBSERVED');
  }
  if (received < available) {
    throw new Error('MONEY_FX_CARRY_RECEIVED_BEFORE_AVAILABLE');
  }

  assertNonEmpty(observation.provider, 'MONEY_FX_CARRY_PROVIDER_REQUIRED');
  if (observation.evidenceRefs.length === 0) {
    throw new Error('MONEY_FX_CARRY_EVIDENCE_REQUIRED');
  }
  assertNonEmpty(
    observation.provenanceHash,
    'MONEY_FX_CARRY_PROVENANCE_REQUIRED',
  );

  if (pair) {
    if (observation.pairId !== pair.pairId) {
      throw new Error('MONEY_FX_CARRY_PAIR_MISMATCH');
    }
    if (
      observation.baseCurrency !== pair.baseCurrency ||
      observation.quoteCurrency !== pair.quoteCurrency
    ) {
      throw new Error('MONEY_FX_CARRY_CURRENCY_MISMATCH');
    }
  }
}

export function buildFxMacroContext(
  currency: FxCurrency,
  snapshot: MacroSnapshotV2,
  fxInformationCutoff: string,
  evidenceRefs: readonly string[],
  provenanceHash: string,
): FxMacroContext {
  assertFxCurrency(currency);
  const macroCutoff = parseTimestamp(
    snapshot.informationCutoff,
    'MONEY_FX_MACRO_CUTOFF_INVALID',
  );
  const fxCutoff = parseTimestamp(
    fxInformationCutoff,
    'MONEY_FX_MACRO_FX_CUTOFF_INVALID',
  );
  if (macroCutoff > fxCutoff) {
    throw new Error('MONEY_FX_MACRO_FUTURE_LEAK');
  }
  if (snapshot.artifactIds.length === 0) {
    throw new Error('MONEY_FX_MACRO_ARTIFACTS_REQUIRED');
  }
  if (!snapshot.provenanceHash || !snapshot.inputSnapshotHash) {
    throw new Error('MONEY_FX_MACRO_SNAPSHOT_UNPROVEN');
  }
  if (evidenceRefs.length === 0) {
    throw new Error('MONEY_FX_MACRO_CONTEXT_EVIDENCE_REQUIRED');
  }
  assertNonEmpty(
    provenanceHash,
    'MONEY_FX_MACRO_CONTEXT_PROVENANCE_REQUIRED',
  );

  return Object.freeze({
    contextId: `${currency.code}:${snapshot.snapshotId}`,
    currencyCode: currency.code,
    jurisdiction: currency.jurisdiction,
    centralBankId: currency.centralBankId,
    macroSnapshotId: snapshot.snapshotId,
    macroInformationCutoff: snapshot.informationCutoff,
    macroArtifactIds: Object.freeze([...snapshot.artifactIds]),
    evidenceRefs: Object.freeze([...evidenceRefs]),
    provenanceHash,
  });
}

export function assertFxMacroContext(
  context: FxMacroContext,
  currency: FxCurrency,
  fxInformationCutoff: string,
): void {
  assertNonEmpty(context.contextId, 'MONEY_FX_MACRO_CONTEXT_ID_REQUIRED');
  if (context.currencyCode !== currency.code) {
    throw new Error('MONEY_FX_MACRO_CURRENCY_MISMATCH');
  }
  if (context.jurisdiction !== currency.jurisdiction) {
    throw new Error('MONEY_FX_MACRO_JURISDICTION_MISMATCH');
  }
  if (
    currency.centralBankId !== undefined &&
    context.centralBankId !== currency.centralBankId
  ) {
    throw new Error('MONEY_FX_MACRO_CENTRAL_BANK_MISMATCH');
  }
  if (
    Date.parse(context.macroInformationCutoff) >
    Date.parse(fxInformationCutoff)
  ) {
    throw new Error('MONEY_FX_MACRO_FUTURE_LEAK');
  }
  if (context.macroArtifactIds.length === 0) {
    throw new Error('MONEY_FX_MACRO_ARTIFACTS_REQUIRED');
  }
  if (context.evidenceRefs.length === 0) {
    throw new Error('MONEY_FX_MACRO_CONTEXT_EVIDENCE_REQUIRED');
  }
  assertNonEmpty(
    context.provenanceHash,
    'MONEY_FX_MACRO_CONTEXT_PROVENANCE_REQUIRED',
  );
}

type OrientedQuote = Readonly<{
  bid: string;
  ask: string;
}>;

function orientQuote(
  pair: FxPairDefinition,
  quote: FxQuote,
  fromCurrency: string,
  toCurrency: string,
  precision: number,
): OrientedQuote {
  assertFxQuote(quote, pair);

  if (
    pair.baseCurrency === fromCurrency &&
    pair.quoteCurrency === toCurrency
  ) {
    return Object.freeze({
      bid: formatScaled(
        rescaleDecimal(
          parsePositiveDecimal(
            quote.bidPrice,
            'MONEY_FX_QUOTE_BID_INVALID',
          ),
          precision,
        ),
        precision,
      ),
      ask: formatScaled(
        rescaleDecimal(
          parsePositiveDecimal(
            quote.askPrice,
            'MONEY_FX_QUOTE_ASK_INVALID',
          ),
          precision,
        ),
        precision,
      ),
    });
  }

  if (
    pair.baseCurrency === toCurrency &&
    pair.quoteCurrency === fromCurrency
  ) {
    return Object.freeze({
      bid: invertDecimalString(quote.askPrice, precision),
      ask: invertDecimalString(quote.bidPrice, precision),
    });
  }

  throw new Error('MONEY_FX_CROSS_ORIENTATION_UNSUPPORTED');
}

export function buildFxCrossQuote(input: Readonly<{
  targetPair: FxPairDefinition;
  bridgeCurrency: string;
  leftPair: FxPairDefinition;
  leftQuote: FxQuote;
  rightPair: FxPairDefinition;
  rightQuote: FxQuote;
  informationCutoff: string;
  derivedAt: string;
  provenanceHash: string;
}>): FxQuote {
  assertCurrencyCode(
    input.bridgeCurrency,
    'MONEY_FX_CROSS_BRIDGE_CURRENCY_INVALID',
  );
  if (
    input.bridgeCurrency === input.targetPair.baseCurrency ||
    input.bridgeCurrency === input.targetPair.quoteCurrency
  ) {
    throw new Error('MONEY_FX_CROSS_BRIDGE_NOT_DISTINCT');
  }
  if (input.leftQuote.quoteId === input.rightQuote.quoteId) {
    throw new Error('MONEY_FX_CROSS_DISTINCT_QUOTES_REQUIRED');
  }

  assertFxQuote(input.leftQuote, input.leftPair);
  assertFxQuote(input.rightQuote, input.rightPair);

  const cutoff = parseTimestamp(
    input.informationCutoff,
    'MONEY_FX_CROSS_CUTOFF_INVALID',
  );
  const derivedAt = parseTimestamp(
    input.derivedAt,
    'MONEY_FX_CROSS_DERIVED_AT_INVALID',
  );
  if (derivedAt > cutoff) {
    throw new Error('MONEY_FX_CROSS_DERIVED_AFTER_CUTOFF');
  }
  if (
    Date.parse(input.leftQuote.availableAt) > cutoff ||
    Date.parse(input.rightQuote.availableAt) > cutoff
  ) {
    throw new Error('MONEY_FX_CROSS_SOURCE_FUTURE_LEAK');
  }
  if (
    Date.parse(input.leftQuote.receivedAt) > derivedAt ||
    Date.parse(input.rightQuote.receivedAt) > derivedAt
  ) {
    throw new Error('MONEY_FX_CROSS_DERIVED_BEFORE_SOURCE_RECEIPT');
  }

  const left = orientQuote(
    input.leftPair,
    input.leftQuote,
    input.targetPair.baseCurrency,
    input.bridgeCurrency,
    input.targetPair.pricePrecision + 4,
  );
  const right = orientQuote(
    input.rightPair,
    input.rightQuote,
    input.bridgeCurrency,
    input.targetPair.quoteCurrency,
    input.targetPair.pricePrecision + 4,
  );

  const bidPrice = multiplyDecimalStrings(
    left.bid,
    right.bid,
    input.targetPair.pricePrecision,
  );
  const askPrice = multiplyDecimalStrings(
    left.ask,
    right.ask,
    input.targetPair.pricePrecision,
  );

  if (compareDecimalStrings(askPrice, bidPrice) < 0) {
    throw new Error('MONEY_FX_CROSS_QUOTE_CROSSED');
  }

  const quote: FxQuote = Object.freeze({
    quoteId: `cross:${input.targetPair.pairId}:${input.leftQuote.quoteId}:${input.rightQuote.quoteId}`,
    pairId: input.targetPair.pairId,
    baseCurrency: input.targetPair.baseCurrency,
    quoteCurrency: input.targetPair.quoteCurrency,
    bidPrice,
    askPrice,
    observedAt: maxTimestamp([
      input.leftQuote.observedAt,
      input.rightQuote.observedAt,
    ]),
    availableAt: input.derivedAt,
    receivedAt: input.derivedAt,
    provider: 'MONEY_CORE_CROSS_RATE',
    sourceType: 'CROSS_DERIVED',
    sourceQuoteIds: Object.freeze([
      input.leftQuote.quoteId,
      input.rightQuote.quoteId,
    ]),
    evidenceRefs: unique([
      ...input.leftQuote.evidenceRefs,
      ...input.rightQuote.evidenceRefs,
    ]),
    provenanceHash: input.provenanceHash,
  });

  assertFxQuote(quote, input.targetPair);
  return quote;
}

export function fxSpreadPips(
  quote: FxQuote,
  pair: FxPairDefinition,
): number {
  assertFxQuote(quote, pair);
  const spread = decimalDifferenceAsNumber(
    quote.askPrice,
    quote.bidPrice,
  );
  const pip = Number(pair.pipSize);
  if (!Number.isFinite(pip) || pip <= 0) {
    throw new Error('MONEY_FX_PAIR_PIP_SIZE_INVALID');
  }
  const result = spread / pip;
  if (!Number.isFinite(result) || result < 0) {
    throw new Error('MONEY_FX_SPREAD_PIPS_INVALID');
  }
  return result;
}

function sessionActiveAt(
  session: FxTradingSession,
  cutoff: string,
): boolean {
  const point = Date.parse(cutoff);
  return (
    session.status === 'OPEN' &&
    Date.parse(session.availableAt) <= point &&
    Date.parse(session.opensAt) <= point &&
    point < Date.parse(session.closesAt)
  );
}

export function buildFxMarketSnapshot(
  input: BuildFxMarketSnapshotInput,
): FxMarketSnapshot {
  assertFxPair(
    input.pair,
    input.instrument,
    input.baseCurrency,
    input.quoteCurrency,
  );

  const cutoff = parseTimestamp(
    input.informationCutoff,
    'MONEY_FX_SNAPSHOT_CUTOFF_INVALID',
  );
  const derivedAt = parseTimestamp(
    input.derivedAt,
    'MONEY_FX_SNAPSHOT_DERIVED_AT_INVALID',
  );
  if (derivedAt < cutoff) {
    throw new Error('MONEY_FX_SNAPSHOT_DERIVED_BEFORE_CUTOFF');
  }

  assertNonEmpty(
    input.methodologyVersion,
    'MONEY_FX_SNAPSHOT_METHODOLOGY_REQUIRED',
  );
  assertNonEmpty(
    input.snapshotHash,
    'MONEY_FX_SNAPSHOT_HASH_REQUIRED',
  );
  if (input.sourceManifest.length === 0) {
    throw new Error('MONEY_FX_SOURCE_MANIFEST_REQUIRED');
  }

  const quotes = input.quotes.filter(
    (quote) => quote.pairId === input.pair.pairId,
  );
  for (const quote of quotes) {
    assertFxQuote(quote, input.pair);
  }
  const quote = latestByAvailableAt(
    quotes.filter(
      (candidate) =>
        Date.parse(candidate.availableAt) <= cutoff,
    ),
  );
  if (!quote) {
    throw new Error('MONEY_FX_SNAPSHOT_QUOTE_REQUIRED');
  }

  for (const session of input.sessions) {
    assertFxTradingSession(session);
  }
  const activeSessions = Object.freeze(
    input.sessions
      .filter((session) =>
        sessionActiveAt(session, input.informationCutoff),
      )
      .sort(
        (a, b) =>
          Date.parse(a.opensAt) - Date.parse(b.opensAt),
      ),
  );

  const carryCandidates = input.carryObservations.filter(
    (carry) => carry.pairId === input.pair.pairId,
  );
  for (const carry of carryCandidates) {
    assertFxCarryObservation(carry, input.pair);
  }
  const carry = latestByAvailableAt(
    carryCandidates.filter(
      (candidate) =>
        Date.parse(candidate.availableAt) <= cutoff,
    ),
  );

  const baseContexts = input.macroContexts.filter(
    (context) => context.currencyCode === input.baseCurrency.code,
  );
  for (const context of baseContexts) {
    assertFxMacroContext(
      context,
      input.baseCurrency,
      input.informationCutoff,
    );
  }
  const baseMacroContext = latestByMacroCutoff(baseContexts);
  if (!baseMacroContext) {
    throw new Error('MONEY_FX_BASE_MACRO_CONTEXT_REQUIRED');
  }

  const quoteContexts = input.macroContexts.filter(
    (context) => context.currencyCode === input.quoteCurrency.code,
  );
  for (const context of quoteContexts) {
    assertFxMacroContext(
      context,
      input.quoteCurrency,
      input.informationCutoff,
    );
  }
  const quoteMacroContext = latestByMacroCutoff(quoteContexts);
  if (!quoteMacroContext) {
    throw new Error('MONEY_FX_QUOTE_MACRO_CONTEXT_REQUIRED');
  }

  const evidenceRefs = unique([
    ...input.pair.evidenceRefs,
    ...input.baseCurrency.evidenceRefs,
    ...input.quoteCurrency.evidenceRefs,
    ...quote.evidenceRefs,
    ...activeSessions.flatMap((session) => session.evidenceRefs),
    ...(carry ? carry.evidenceRefs : []),
    ...baseMacroContext.evidenceRefs,
    ...quoteMacroContext.evidenceRefs,
  ]);

  return Object.freeze({
    schemaVersion: FX_MARKET_REALITY_SCHEMA_VERSION,
    snapshotId: `${input.pair.pairId}:${input.informationCutoff}:${input.snapshotHash}`,
    pairId: input.pair.pairId,
    instrumentId: input.pair.instrumentId,
    baseCurrency: input.pair.baseCurrency,
    quoteCurrency: input.pair.quoteCurrency,
    settlementCurrency: input.pair.settlementCurrency,
    informationCutoff: input.informationCutoff,
    derivedAt: input.derivedAt,
    quote,
    spreadPips: fxSpreadPips(quote, input.pair),
    activeSessions,
    carry,
    baseMacroContext,
    quoteMacroContext,
    methodologyVersion: input.methodologyVersion,
    sourceManifest: Object.freeze([...input.sourceManifest]),
    evidenceRefs,
    snapshotHash: input.snapshotHash,
    researchAuthority: 'INTELLIGENCE_ONLY',
    executionAuthority: 'NONE',
    financialAuthority: 'NONE',
  });
}
