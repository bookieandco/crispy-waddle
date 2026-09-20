import type {
  CanonicalInstrument,
  MarketSession,
} from './market-instrument-contracts.js';
import type {
  FundamentalState,
  IssuerInstrumentRelationship,
} from './issuer-reality-contracts.js';
import { relationshipWasEffectiveAt } from './issuer-reality-contracts.js';

export const STOCK_MARKET_REALITY_SCHEMA_VERSION = 'MONEY-STOCK-01' as const;

export type PriceAdjustmentStatus =
  | 'UNADJUSTED'
  | 'SOURCE_ADJUSTED'
  | 'CANONICALLY_ADJUSTED'
  | 'UNKNOWN';

export type CorporateActionType =
  | 'CASH_DIVIDEND'
  | 'STOCK_DIVIDEND'
  | 'SPLIT'
  | 'REVERSE_SPLIT'
  | 'MERGER'
  | 'ACQUISITION'
  | 'SPINOFF'
  | 'SYMBOL_CHANGE'
  | 'DELISTING'
  | 'TENDER'
  | 'RIGHTS'
  | 'OTHER';

export type CorporateActionStatus =
  | 'ANNOUNCED'
  | 'CONFIRMED'
  | 'EFFECTIVE'
  | 'CANCELLED'
  | 'CORRECTED'
  | 'UNKNOWN';

export type BenchmarkRelationship =
  | 'MARKET'
  | 'SECTOR'
  | 'INDUSTRY'
  | 'MEMBER'
  | 'CUSTOM';

export type StockQuote = Readonly<{
  quoteId: string;
  instrumentId: string;
  venue: string;
  currency: string;
  bidPrice: string;
  askPrice: string;
  bidSize?: string;
  askSize?: string;
  observedAt: string;
  availableAt: string;
  receivedAt: string;
  provider: string;
  evidenceRef: string;
  provenanceHash: string;
}>;

export type StockBar = Readonly<{
  barId: string;
  instrumentId: string;
  venue: string;
  currency: string;
  interval: string;
  startsAt: string;
  endsAt: string;
  observedAt: string;
  availableAt: string;
  receivedAt: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  tradeCount?: number;
  adjustmentStatus: PriceAdjustmentStatus;
  provider: string;
  evidenceRef: string;
  provenanceHash: string;
}>;

export type StockOrderBookLevel = Readonly<{
  price: string;
  size: string;
  orderCount?: number;
}>;

export type StockOrderBookSnapshot = Readonly<{
  bookId: string;
  instrumentId: string;
  venue: string;
  currency: string;
  bids: readonly StockOrderBookLevel[];
  asks: readonly StockOrderBookLevel[];
  observedAt: string;
  availableAt: string;
  receivedAt: string;
  provider: string;
  evidenceRef: string;
  provenanceHash: string;
}>;

export type StockCorporateAction = Readonly<{
  actionId: string;
  instrumentId: string;
  actionType: CorporateActionType;
  status: CorporateActionStatus;
  announcedAt: string;
  availableAt: string;
  receivedAt: string;
  effectiveAt?: string;
  exDate?: string;
  recordDate?: string;
  payDate?: string;
  ratioNumerator?: string;
  ratioDenominator?: string;
  cashAmount?: string;
  currency?: string;
  resultingInstrumentId?: string;
  provider: string;
  evidenceRef: string;
  provenanceHash: string;
}>;

export type StockBenchmarkReference = Readonly<{
  referenceId: string;
  instrumentId: string;
  benchmarkId: string;
  relationship: BenchmarkRelationship;
  effectiveAt: string;
  expiresAt?: string;
  availableAt: string;
  receivedAt: string;
  weight?: number;
  evidenceRef: string;
  provenanceHash: string;
}>;

export type StockBenchmarkObservation = Readonly<{
  observationId: string;
  benchmarkId: string;
  currency: string;
  value: string;
  observedAt: string;
  availableAt: string;
  receivedAt: string;
  provider: string;
  evidenceRef: string;
  provenanceHash: string;
}>;

export type StockBenchmarkState = Readonly<{
  reference: StockBenchmarkReference;
  observation?: StockBenchmarkObservation;
}>;

export type StockMarketSnapshot = Readonly<{
  schemaVersion: typeof STOCK_MARKET_REALITY_SCHEMA_VERSION;
  snapshotId: string;
  instrumentId: string;
  venue: string;
  quoteCurrency: string;
  informationCutoff: string;
  derivedAt: string;
  session: MarketSession;
  quote?: StockQuote;
  bars: readonly StockBar[];
  orderBook?: StockOrderBookSnapshot;
  knownCorporateActions: readonly StockCorporateAction[];
  benchmarks: readonly StockBenchmarkState[];
  methodologyVersion: string;
  sourceManifest: readonly string[];
  snapshotHash: string;
  marketEvidenceRefs: readonly string[];
  executionAuthority: 'NONE';
}>;

export type StockIssuerMarketStateStatus =
  | 'FUSED_POINT_IN_TIME'
  | 'FUNDAMENTALS_PRIOR_CUTOFF';

export type StockIssuerMarketState = Readonly<{
  stateId: string;
  instrumentId: string;
  issuerId: string;
  informationCutoff: string;
  marketSnapshotId: string;
  fundamentalStateId: string;
  issuerInstrumentRelationshipId: string;
  fundamentalLagMs: number;
  status: StockIssuerMarketStateStatus;
  methodologyVersion: string;
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

export type BuildStockMarketSnapshotInput = Readonly<{
  instrument: CanonicalInstrument;
  session: MarketSession;
  quotes: readonly StockQuote[];
  bars: readonly StockBar[];
  orderBooks: readonly StockOrderBookSnapshot[];
  corporateActions: readonly StockCorporateAction[];
  benchmarkReferences: readonly StockBenchmarkReference[];
  benchmarkObservations: readonly StockBenchmarkObservation[];
  informationCutoff: string;
  derivedAt: string;
  methodologyVersion: string;
  sourceManifest: readonly string[];
  snapshotHash: string;
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

function parseDecimal(
  value: string,
  code: string,
  options: Readonly<{ allowZero: boolean }> = { allowZero: false },
): number {
  assertNonEmpty(value, code);
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) throw new Error(code);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  if (options.allowZero ? parsed < 0 : parsed <= 0) throw new Error(code);
  return parsed;
}

function assertObservationTimes(
  observedAt: string,
  availableAt: string,
  receivedAt: string,
  prefix: string,
): void {
  const observed = parseTimestamp(observedAt, `${prefix}_OBSERVED_AT_INVALID`);
  const available = parseTimestamp(availableAt, `${prefix}_AVAILABLE_AT_INVALID`);
  const received = parseTimestamp(receivedAt, `${prefix}_RECEIVED_AT_INVALID`);
  if (available < observed) throw new Error(`${prefix}_AVAILABLE_BEFORE_OBSERVED`);
  if (received < available) throw new Error(`${prefix}_RECEIVED_BEFORE_AVAILABLE`);
}

function availableAtCutoff(availableAt: string, cutoff: string): boolean {
  return Date.parse(availableAt) <= Date.parse(cutoff);
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

export function assertStockInstrument(instrument: CanonicalInstrument): void {
  assertNonEmpty(instrument.instrumentId, 'MONEY_STOCK_INSTRUMENT_ID_REQUIRED');
  if (instrument.assetClass !== 'STOCK') {
    throw new Error('MONEY_STOCK_ASSET_CLASS_REQUIRED');
  }
  assertNonEmpty(instrument.instrumentType, 'MONEY_STOCK_INSTRUMENT_TYPE_REQUIRED');
  assertNonEmpty(instrument.venue, 'MONEY_STOCK_VENUE_REQUIRED');
  assertNonEmpty(instrument.quoteCurrency, 'MONEY_STOCK_QUOTE_CURRENCY_REQUIRED');
  assertNonEmpty(
    instrument.settlementCurrency,
    'MONEY_STOCK_SETTLEMENT_CURRENCY_REQUIRED',
  );
  assertNonEmpty(instrument.provenanceHash, 'MONEY_STOCK_INSTRUMENT_UNPROVEN');
  if (instrument.identifiers.length === 0) {
    throw new Error('MONEY_STOCK_IDENTIFIER_REQUIRED');
  }
}

export function assertStockQuote(quote: StockQuote): void {
  assertNonEmpty(quote.quoteId, 'MONEY_STOCK_QUOTE_ID_REQUIRED');
  assertNonEmpty(quote.instrumentId, 'MONEY_STOCK_QUOTE_INSTRUMENT_REQUIRED');
  assertNonEmpty(quote.venue, 'MONEY_STOCK_QUOTE_VENUE_REQUIRED');
  assertNonEmpty(quote.currency, 'MONEY_STOCK_QUOTE_CURRENCY_REQUIRED');
  const bid = parseDecimal(quote.bidPrice, 'MONEY_STOCK_BID_INVALID');
  const ask = parseDecimal(quote.askPrice, 'MONEY_STOCK_ASK_INVALID');
  if (ask < bid) throw new Error('MONEY_STOCK_CROSSED_QUOTE');
  if (quote.bidSize !== undefined) {
    parseDecimal(quote.bidSize, 'MONEY_STOCK_BID_SIZE_INVALID', { allowZero: true });
  }
  if (quote.askSize !== undefined) {
    parseDecimal(quote.askSize, 'MONEY_STOCK_ASK_SIZE_INVALID', { allowZero: true });
  }
  assertObservationTimes(
    quote.observedAt,
    quote.availableAt,
    quote.receivedAt,
    'MONEY_STOCK_QUOTE',
  );
  assertNonEmpty(quote.provider, 'MONEY_STOCK_QUOTE_PROVIDER_REQUIRED');
  assertNonEmpty(quote.evidenceRef, 'MONEY_STOCK_QUOTE_EVIDENCE_REQUIRED');
  assertNonEmpty(quote.provenanceHash, 'MONEY_STOCK_QUOTE_PROVENANCE_REQUIRED');
}

export function assertStockBar(bar: StockBar): void {
  assertNonEmpty(bar.barId, 'MONEY_STOCK_BAR_ID_REQUIRED');
  assertNonEmpty(bar.instrumentId, 'MONEY_STOCK_BAR_INSTRUMENT_REQUIRED');
  assertNonEmpty(bar.venue, 'MONEY_STOCK_BAR_VENUE_REQUIRED');
  assertNonEmpty(bar.currency, 'MONEY_STOCK_BAR_CURRENCY_REQUIRED');
  assertNonEmpty(bar.interval, 'MONEY_STOCK_BAR_INTERVAL_REQUIRED');

  const starts = parseTimestamp(bar.startsAt, 'MONEY_STOCK_BAR_START_INVALID');
  const ends = parseTimestamp(bar.endsAt, 'MONEY_STOCK_BAR_END_INVALID');
  if (ends <= starts) throw new Error('MONEY_STOCK_BAR_INTERVAL_INVALID');

  assertObservationTimes(
    bar.observedAt,
    bar.availableAt,
    bar.receivedAt,
    'MONEY_STOCK_BAR',
  );
  if (Date.parse(bar.observedAt) < ends) {
    throw new Error('MONEY_STOCK_BAR_OBSERVED_BEFORE_END');
  }

  const open = parseDecimal(bar.open, 'MONEY_STOCK_BAR_OPEN_INVALID');
  const high = parseDecimal(bar.high, 'MONEY_STOCK_BAR_HIGH_INVALID');
  const low = parseDecimal(bar.low, 'MONEY_STOCK_BAR_LOW_INVALID');
  const close = parseDecimal(bar.close, 'MONEY_STOCK_BAR_CLOSE_INVALID');
  parseDecimal(bar.volume, 'MONEY_STOCK_BAR_VOLUME_INVALID', { allowZero: true });

  if (high < Math.max(open, close, low)) {
    throw new Error('MONEY_STOCK_BAR_HIGH_INCONSISTENT');
  }
  if (low > Math.min(open, close, high)) {
    throw new Error('MONEY_STOCK_BAR_LOW_INCONSISTENT');
  }
  if (
    bar.tradeCount !== undefined &&
    (!Number.isInteger(bar.tradeCount) || bar.tradeCount < 0)
  ) {
    throw new Error('MONEY_STOCK_BAR_TRADE_COUNT_INVALID');
  }

  assertNonEmpty(bar.provider, 'MONEY_STOCK_BAR_PROVIDER_REQUIRED');
  assertNonEmpty(bar.evidenceRef, 'MONEY_STOCK_BAR_EVIDENCE_REQUIRED');
  assertNonEmpty(bar.provenanceHash, 'MONEY_STOCK_BAR_PROVENANCE_REQUIRED');
}

function assertBookLevel(level: StockOrderBookLevel, side: 'BID' | 'ASK'): number {
  const price = parseDecimal(level.price, `MONEY_STOCK_${side}_LEVEL_PRICE_INVALID`);
  parseDecimal(level.size, `MONEY_STOCK_${side}_LEVEL_SIZE_INVALID`, {
    allowZero: true,
  });
  if (
    level.orderCount !== undefined &&
    (!Number.isInteger(level.orderCount) || level.orderCount < 0)
  ) {
    throw new Error(`MONEY_STOCK_${side}_LEVEL_ORDER_COUNT_INVALID`);
  }
  return price;
}

export function assertStockOrderBook(book: StockOrderBookSnapshot): void {
  assertNonEmpty(book.bookId, 'MONEY_STOCK_BOOK_ID_REQUIRED');
  assertNonEmpty(book.instrumentId, 'MONEY_STOCK_BOOK_INSTRUMENT_REQUIRED');
  assertNonEmpty(book.venue, 'MONEY_STOCK_BOOK_VENUE_REQUIRED');
  assertNonEmpty(book.currency, 'MONEY_STOCK_BOOK_CURRENCY_REQUIRED');
  if (book.bids.length === 0 || book.asks.length === 0) {
    throw new Error('MONEY_STOCK_BOOK_TWO_SIDED_REQUIRED');
  }

  let previousBid = Number.POSITIVE_INFINITY;
  for (const level of book.bids) {
    const price = assertBookLevel(level, 'BID');
    if (price > previousBid) throw new Error('MONEY_STOCK_BIDS_NOT_DESCENDING');
    previousBid = price;
  }

  let previousAsk = Number.NEGATIVE_INFINITY;
  for (const level of book.asks) {
    const price = assertBookLevel(level, 'ASK');
    if (price < previousAsk) throw new Error('MONEY_STOCK_ASKS_NOT_ASCENDING');
    previousAsk = price;
  }

  const bestBid = Number(book.bids[0]!.price);
  const bestAsk = Number(book.asks[0]!.price);
  if (bestBid > bestAsk) throw new Error('MONEY_STOCK_CROSSED_BOOK');

  assertObservationTimes(
    book.observedAt,
    book.availableAt,
    book.receivedAt,
    'MONEY_STOCK_BOOK',
  );
  assertNonEmpty(book.provider, 'MONEY_STOCK_BOOK_PROVIDER_REQUIRED');
  assertNonEmpty(book.evidenceRef, 'MONEY_STOCK_BOOK_EVIDENCE_REQUIRED');
  assertNonEmpty(book.provenanceHash, 'MONEY_STOCK_BOOK_PROVENANCE_REQUIRED');
}

export function assertStockCorporateAction(action: StockCorporateAction): void {
  assertNonEmpty(action.actionId, 'MONEY_STOCK_ACTION_ID_REQUIRED');
  assertNonEmpty(action.instrumentId, 'MONEY_STOCK_ACTION_INSTRUMENT_REQUIRED');
  const announced = parseTimestamp(
    action.announcedAt,
    'MONEY_STOCK_ACTION_ANNOUNCED_AT_INVALID',
  );
  const available = parseTimestamp(
    action.availableAt,
    'MONEY_STOCK_ACTION_AVAILABLE_AT_INVALID',
  );
  const received = parseTimestamp(
    action.receivedAt,
    'MONEY_STOCK_ACTION_RECEIVED_AT_INVALID',
  );
  if (available < announced) {
    throw new Error('MONEY_STOCK_ACTION_AVAILABLE_BEFORE_ANNOUNCED');
  }
  if (received < available) {
    throw new Error('MONEY_STOCK_ACTION_RECEIVED_BEFORE_AVAILABLE');
  }

  for (const timestamp of [
    action.effectiveAt,
    action.exDate,
    action.recordDate,
    action.payDate,
  ]) {
    if (timestamp !== undefined) {
      parseTimestamp(timestamp, 'MONEY_STOCK_ACTION_DATE_INVALID');
    }
  }

  const hasRatio =
    action.ratioNumerator !== undefined || action.ratioDenominator !== undefined;
  if (hasRatio) {
    if (
      action.ratioNumerator === undefined ||
      action.ratioDenominator === undefined
    ) {
      throw new Error('MONEY_STOCK_ACTION_RATIO_INCOMPLETE');
    }
    parseDecimal(action.ratioNumerator, 'MONEY_STOCK_ACTION_RATIO_INVALID');
    parseDecimal(action.ratioDenominator, 'MONEY_STOCK_ACTION_RATIO_INVALID');
  }

  if (action.cashAmount !== undefined) {
    parseDecimal(action.cashAmount, 'MONEY_STOCK_ACTION_CASH_INVALID', {
      allowZero: true,
    });
    if (!action.currency?.trim()) {
      throw new Error('MONEY_STOCK_ACTION_CURRENCY_REQUIRED');
    }
  }

  assertNonEmpty(action.provider, 'MONEY_STOCK_ACTION_PROVIDER_REQUIRED');
  assertNonEmpty(action.evidenceRef, 'MONEY_STOCK_ACTION_EVIDENCE_REQUIRED');
  assertNonEmpty(action.provenanceHash, 'MONEY_STOCK_ACTION_PROVENANCE_REQUIRED');
}

export function assertStockBenchmarkReference(
  reference: StockBenchmarkReference,
): void {
  assertNonEmpty(reference.referenceId, 'MONEY_STOCK_BENCHMARK_REF_ID_REQUIRED');
  assertNonEmpty(reference.instrumentId, 'MONEY_STOCK_BENCHMARK_INSTRUMENT_REQUIRED');
  assertNonEmpty(reference.benchmarkId, 'MONEY_STOCK_BENCHMARK_ID_REQUIRED');

  const effective = parseTimestamp(
    reference.effectiveAt,
    'MONEY_STOCK_BENCHMARK_EFFECTIVE_AT_INVALID',
  );
  const available = parseTimestamp(
    reference.availableAt,
    'MONEY_STOCK_BENCHMARK_AVAILABLE_AT_INVALID',
  );
  const received = parseTimestamp(
    reference.receivedAt,
    'MONEY_STOCK_BENCHMARK_RECEIVED_AT_INVALID',
  );
  if (received < available) {
    throw new Error('MONEY_STOCK_BENCHMARK_RECEIVED_BEFORE_AVAILABLE');
  }

  if (reference.expiresAt !== undefined) {
    const expires = parseTimestamp(
      reference.expiresAt,
      'MONEY_STOCK_BENCHMARK_EXPIRES_AT_INVALID',
    );
    if (expires <= effective) {
      throw new Error('MONEY_STOCK_BENCHMARK_RANGE_INVALID');
    }
  }

  if (
    reference.weight !== undefined &&
    (!Number.isFinite(reference.weight) ||
      reference.weight < 0 ||
      reference.weight > 1)
  ) {
    throw new Error('MONEY_STOCK_BENCHMARK_WEIGHT_INVALID');
  }

  assertNonEmpty(reference.evidenceRef, 'MONEY_STOCK_BENCHMARK_EVIDENCE_REQUIRED');
  assertNonEmpty(
    reference.provenanceHash,
    'MONEY_STOCK_BENCHMARK_PROVENANCE_REQUIRED',
  );
}

export function assertStockBenchmarkObservation(
  observation: StockBenchmarkObservation,
): void {
  assertNonEmpty(
    observation.observationId,
    'MONEY_STOCK_BENCHMARK_OBSERVATION_ID_REQUIRED',
  );
  assertNonEmpty(observation.benchmarkId, 'MONEY_STOCK_BENCHMARK_ID_REQUIRED');
  assertNonEmpty(observation.currency, 'MONEY_STOCK_BENCHMARK_CURRENCY_REQUIRED');
  parseDecimal(observation.value, 'MONEY_STOCK_BENCHMARK_VALUE_INVALID');
  assertObservationTimes(
    observation.observedAt,
    observation.availableAt,
    observation.receivedAt,
    'MONEY_STOCK_BENCHMARK_OBSERVATION',
  );
  assertNonEmpty(
    observation.provider,
    'MONEY_STOCK_BENCHMARK_PROVIDER_REQUIRED',
  );
  assertNonEmpty(
    observation.evidenceRef,
    'MONEY_STOCK_BENCHMARK_EVIDENCE_REQUIRED',
  );
  assertNonEmpty(
    observation.provenanceHash,
    'MONEY_STOCK_BENCHMARK_PROVENANCE_REQUIRED',
  );
}

function assertRecordMatchesInstrument(
  instrument: CanonicalInstrument,
  record: Readonly<{ instrumentId: string; venue?: string; currency?: string }>,
  code: string,
): void {
  if (record.instrumentId !== instrument.instrumentId) {
    throw new Error(`${code}_INSTRUMENT_MISMATCH`);
  }
  if (record.venue !== undefined && record.venue !== instrument.venue) {
    throw new Error(`${code}_VENUE_MISMATCH`);
  }
  if (
    record.currency !== undefined &&
    record.currency !== instrument.quoteCurrency
  ) {
    throw new Error(`${code}_CURRENCY_MISMATCH`);
  }
}

function latestByAvailableAt<T extends Readonly<{ availableAt: string }>>(
  records: readonly T[],
): T | undefined {
  return [...records].sort(
    (a, b) => Date.parse(b.availableAt) - Date.parse(a.availableAt),
  )[0];
}

function benchmarkActiveAt(
  reference: StockBenchmarkReference,
  cutoff: string,
): boolean {
  const point = Date.parse(cutoff);
  const start = Date.parse(reference.effectiveAt);
  const end = reference.expiresAt
    ? Date.parse(reference.expiresAt)
    : Number.POSITIVE_INFINITY;
  return point >= start && point < end && availableAtCutoff(reference.availableAt, cutoff);
}

export function buildStockMarketSnapshot(
  input: BuildStockMarketSnapshotInput,
): StockMarketSnapshot {
  assertStockInstrument(input.instrument);
  const cutoff = parseTimestamp(
    input.informationCutoff,
    'MONEY_STOCK_CUTOFF_INVALID',
  );
  const derivedAt = parseTimestamp(
    input.derivedAt,
    'MONEY_STOCK_DERIVED_AT_INVALID',
  );
  if (derivedAt < cutoff) {
    throw new Error('MONEY_STOCK_DERIVED_BEFORE_CUTOFF');
  }

  assertNonEmpty(input.methodologyVersion, 'MONEY_STOCK_METHODOLOGY_REQUIRED');
  assertNonEmpty(input.snapshotHash, 'MONEY_STOCK_SNAPSHOT_HASH_REQUIRED');
  if (input.sourceManifest.length === 0) {
    throw new Error('MONEY_STOCK_SOURCE_MANIFEST_REQUIRED');
  }

  if (input.session.venue !== input.instrument.venue) {
    throw new Error('MONEY_STOCK_SESSION_VENUE_MISMATCH');
  }
  if (
    Date.parse(input.session.observedAt) > cutoff ||
    Date.parse(input.session.effectiveAt) > cutoff
  ) {
    throw new Error('MONEY_STOCK_SESSION_FUTURE_LEAK');
  }
  if (input.session.evidenceRefs.length === 0) {
    throw new Error('MONEY_STOCK_SESSION_EVIDENCE_REQUIRED');
  }

  const quotes = input.quotes.filter(
    (quote) => quote.instrumentId === input.instrument.instrumentId,
  );
  for (const quote of quotes) {
    assertStockQuote(quote);
    assertRecordMatchesInstrument(input.instrument, quote, 'MONEY_STOCK_QUOTE');
  }
  const availableQuotes = quotes.filter((quote) =>
    availableAtCutoff(quote.availableAt, input.informationCutoff),
  );
  const quote = latestByAvailableAt(availableQuotes);

  const bars = input.bars.filter(
    (bar) => bar.instrumentId === input.instrument.instrumentId,
  );
  for (const bar of bars) {
    assertStockBar(bar);
    assertRecordMatchesInstrument(input.instrument, bar, 'MONEY_STOCK_BAR');
  }
  const availableBars = Object.freeze(
    bars
      .filter(
        (bar) =>
          availableAtCutoff(bar.availableAt, input.informationCutoff) &&
          Date.parse(bar.endsAt) <= cutoff,
      )
      .sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt)),
  );

  const books = input.orderBooks.filter(
    (book) => book.instrumentId === input.instrument.instrumentId,
  );
  for (const book of books) {
    assertStockOrderBook(book);
    assertRecordMatchesInstrument(input.instrument, book, 'MONEY_STOCK_BOOK');
  }
  const orderBook = latestByAvailableAt(
    books.filter((book) =>
      availableAtCutoff(book.availableAt, input.informationCutoff),
    ),
  );

  const corporateActions = input.corporateActions.filter(
    (action) => action.instrumentId === input.instrument.instrumentId,
  );
  for (const action of corporateActions) assertStockCorporateAction(action);
  const knownCorporateActions = Object.freeze(
    corporateActions
      .filter((action) =>
        availableAtCutoff(action.availableAt, input.informationCutoff),
      )
      .sort((a, b) => Date.parse(a.availableAt) - Date.parse(b.availableAt)),
  );

  const benchmarkReferences = input.benchmarkReferences.filter(
    (reference) => reference.instrumentId === input.instrument.instrumentId,
  );
  for (const reference of benchmarkReferences) {
    assertStockBenchmarkReference(reference);
  }

  const benchmarkObservations = input.benchmarkObservations;
  for (const observation of benchmarkObservations) {
    assertStockBenchmarkObservation(observation);
  }

  const benchmarks = Object.freeze(
    benchmarkReferences
      .filter((reference) =>
        benchmarkActiveAt(reference, input.informationCutoff),
      )
      .map((reference) => {
        const observation = latestByAvailableAt(
          benchmarkObservations.filter(
            (candidate) =>
              candidate.benchmarkId === reference.benchmarkId &&
              candidate.currency === input.instrument.quoteCurrency &&
              availableAtCutoff(
                candidate.availableAt,
                input.informationCutoff,
              ),
          ),
        );
        return Object.freeze({ reference, observation });
      }),
  );

  const marketEvidenceRefs = uniqueStrings([
    ...input.session.evidenceRefs,
    ...(quote ? [quote.evidenceRef] : []),
    ...availableBars.map((bar) => bar.evidenceRef),
    ...(orderBook ? [orderBook.evidenceRef] : []),
    ...knownCorporateActions.map((action) => action.evidenceRef),
    ...benchmarks.flatMap((state) => [
      state.reference.evidenceRef,
      ...(state.observation ? [state.observation.evidenceRef] : []),
    ]),
  ]);

  return Object.freeze({
    schemaVersion: STOCK_MARKET_REALITY_SCHEMA_VERSION,
    snapshotId: `${input.instrument.instrumentId}:${input.informationCutoff}:${input.snapshotHash}`,
    instrumentId: input.instrument.instrumentId,
    venue: input.instrument.venue,
    quoteCurrency: input.instrument.quoteCurrency,
    informationCutoff: input.informationCutoff,
    derivedAt: input.derivedAt,
    session: input.session,
    quote,
    bars: availableBars,
    orderBook,
    knownCorporateActions,
    benchmarks,
    methodologyVersion: input.methodologyVersion,
    sourceManifest: Object.freeze([...input.sourceManifest]),
    snapshotHash: input.snapshotHash,
    marketEvidenceRefs,
    executionAuthority: 'NONE',
  });
}

export function buildStockIssuerMarketState(
  instrument: CanonicalInstrument,
  marketSnapshot: StockMarketSnapshot,
  issuerRelationship: IssuerInstrumentRelationship,
  fundamentalState: FundamentalState,
  methodologyVersion: string,
  provenanceHash: string,
): StockIssuerMarketState {
  assertStockInstrument(instrument);
  assertNonEmpty(methodologyVersion, 'MONEY_STOCK_FUSION_METHODOLOGY_REQUIRED');
  assertNonEmpty(provenanceHash, 'MONEY_STOCK_FUSION_PROVENANCE_REQUIRED');

  if (marketSnapshot.schemaVersion !== STOCK_MARKET_REALITY_SCHEMA_VERSION) {
    throw new Error('MONEY_STOCK_SNAPSHOT_SCHEMA_UNSUPPORTED');
  }
  if (
    marketSnapshot.instrumentId !== instrument.instrumentId ||
    issuerRelationship.instrumentId !== instrument.instrumentId
  ) {
    throw new Error('MONEY_STOCK_FUSION_INSTRUMENT_MISMATCH');
  }
  if (fundamentalState.issuerId !== issuerRelationship.issuerId) {
    throw new Error('MONEY_STOCK_FUSION_ISSUER_MISMATCH');
  }
  if (
    !relationshipWasEffectiveAt(
      issuerRelationship,
      marketSnapshot.informationCutoff,
    )
  ) {
    throw new Error('MONEY_STOCK_FUSION_RELATIONSHIP_NOT_EFFECTIVE');
  }

  const marketCutoff = parseTimestamp(
    marketSnapshot.informationCutoff,
    'MONEY_STOCK_FUSION_CUTOFF_INVALID',
  );
  const fundamentalCutoff = parseTimestamp(
    fundamentalState.informationCutoff,
    'MONEY_STOCK_FUNDAMENTAL_CUTOFF_INVALID',
  );
  if (fundamentalCutoff > marketCutoff) {
    throw new Error('MONEY_STOCK_FUNDAMENTAL_FUTURE_LEAK');
  }
  if (!fundamentalState.inputSnapshotHash || !fundamentalState.provenanceHash) {
    throw new Error('MONEY_STOCK_FUNDAMENTAL_PROVENANCE_REQUIRED');
  }
  if (marketSnapshot.executionAuthority !== 'NONE') {
    throw new Error('MONEY_STOCK_MARKET_EXECUTION_AUTHORITY_FORBIDDEN');
  }

  const lag = marketCutoff - fundamentalCutoff;
  return Object.freeze({
    stateId: `${instrument.instrumentId}:${issuerRelationship.issuerId}:${marketSnapshot.snapshotId}:${fundamentalState.stateId}`,
    instrumentId: instrument.instrumentId,
    issuerId: issuerRelationship.issuerId,
    informationCutoff: marketSnapshot.informationCutoff,
    marketSnapshotId: marketSnapshot.snapshotId,
    fundamentalStateId: fundamentalState.stateId,
    issuerInstrumentRelationshipId: issuerRelationship.relationshipId,
    fundamentalLagMs: lag,
    status:
      lag === 0 ? 'FUSED_POINT_IN_TIME' : 'FUNDAMENTALS_PRIOR_CUTOFF',
    methodologyVersion,
    provenanceHash,
    financialAuthority: 'NONE',
  });
}
