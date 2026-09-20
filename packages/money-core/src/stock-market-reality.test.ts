import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  CanonicalInstrument,
  MarketSession,
} from './market-instrument-contracts.js';
import type {
  FundamentalState,
  IssuerInstrumentRelationship,
} from './issuer-reality-contracts.js';
import {
  buildStockIssuerMarketState,
  buildStockMarketSnapshot,
  assertStockOrderBook,
  assertStockQuote,
  type BuildStockMarketSnapshotInput,
  type StockBar,
  type StockBenchmarkObservation,
  type StockBenchmarkReference,
  type StockCorporateAction,
  type StockOrderBookSnapshot,
  type StockQuote,
} from './stock-market-reality.js';

const instrument: CanonicalInstrument = {
  instrumentId: 'stock:acme:xnas',
  assetClass: 'STOCK',
  instrumentType: 'COMMON_EQUITY',
  venue: 'XNAS',
  identifiers: ['ticker:ACME', 'figi:BBG000TEST'],
  quoteCurrency: 'USD',
  settlementCurrency: 'USD',
  status: 'ACTIVE',
  provenanceHash: 'instrument-hash',
};

const session: MarketSession = {
  sessionId: 'xnas:2026-09-19:regular',
  marketId: 'xnas',
  venue: 'XNAS',
  timezone: 'America/New_York',
  opensAt: '2026-09-19T13:30:00Z',
  closesAt: '2026-09-19T20:00:00Z',
  status: 'OPEN',
  observedAt: '2026-09-19T19:59:00Z',
  effectiveAt: '2026-09-19T19:59:00Z',
  evidenceRefs: ['session:e1'],
};

function quote(
  quoteId: string,
  availableAt: string,
  bidPrice = '99.90',
  askPrice = '100.10',
): StockQuote {
  return {
    quoteId,
    instrumentId: instrument.instrumentId,
    venue: 'XNAS',
    currency: 'USD',
    bidPrice,
    askPrice,
    bidSize: '100',
    askSize: '120',
    observedAt: availableAt,
    availableAt,
    receivedAt: availableAt,
    provider: 'market-feed',
    evidenceRef: `${quoteId}:evidence`,
    provenanceHash: `${quoteId}:hash`,
  };
}

const bar: StockBar = {
  barId: 'bar:1m:1',
  instrumentId: instrument.instrumentId,
  venue: 'XNAS',
  currency: 'USD',
  interval: '1m',
  startsAt: '2026-09-19T19:58:00Z',
  endsAt: '2026-09-19T19:59:00Z',
  observedAt: '2026-09-19T19:59:00Z',
  availableAt: '2026-09-19T19:59:01Z',
  receivedAt: '2026-09-19T19:59:02Z',
  open: '99.80',
  high: '100.20',
  low: '99.70',
  close: '100.00',
  volume: '10000',
  tradeCount: 420,
  adjustmentStatus: 'UNADJUSTED',
  provider: 'market-feed',
  evidenceRef: 'bar:e1',
  provenanceHash: 'bar:hash',
};

const book: StockOrderBookSnapshot = {
  bookId: 'book:1',
  instrumentId: instrument.instrumentId,
  venue: 'XNAS',
  currency: 'USD',
  bids: [
    { price: '99.90', size: '100' },
    { price: '99.80', size: '200' },
  ],
  asks: [
    { price: '100.10', size: '150' },
    { price: '100.20', size: '250' },
  ],
  observedAt: '2026-09-19T19:59:10Z',
  availableAt: '2026-09-19T19:59:10Z',
  receivedAt: '2026-09-19T19:59:11Z',
  provider: 'market-depth',
  evidenceRef: 'book:e1',
  provenanceHash: 'book:hash',
};

const split: StockCorporateAction = {
  actionId: 'action:split:1',
  instrumentId: instrument.instrumentId,
  actionType: 'SPLIT',
  status: 'CONFIRMED',
  announcedAt: '2026-09-18T13:00:00Z',
  availableAt: '2026-09-18T13:00:01Z',
  receivedAt: '2026-09-18T13:00:02Z',
  effectiveAt: '2026-09-25T13:30:00Z',
  ratioNumerator: '2',
  ratioDenominator: '1',
  provider: 'corp-actions',
  evidenceRef: 'action:e1',
  provenanceHash: 'action:hash',
};

const benchmarkReference: StockBenchmarkReference = {
  referenceId: 'benchmark-ref:market',
  instrumentId: instrument.instrumentId,
  benchmarkId: 'index:SP500',
  relationship: 'MARKET',
  effectiveAt: '2020-01-01T00:00:00Z',
  availableAt: '2020-01-01T00:00:00Z',
  receivedAt: '2020-01-01T00:00:01Z',
  evidenceRef: 'benchmark-ref:e1',
  provenanceHash: 'benchmark-ref:hash',
};

const benchmarkObservation: StockBenchmarkObservation = {
  observationId: 'benchmark:sp500:1',
  benchmarkId: 'index:SP500',
  currency: 'USD',
  value: '7000.00',
  observedAt: '2026-09-19T19:59:30Z',
  availableAt: '2026-09-19T19:59:30Z',
  receivedAt: '2026-09-19T19:59:31Z',
  provider: 'index-feed',
  evidenceRef: 'benchmark:e1',
  provenanceHash: 'benchmark:hash',
};

function snapshotInput(): BuildStockMarketSnapshotInput {
  return {
    instrument,
    session,
    quotes: [
      quote('quote:current', '2026-09-19T19:59:20Z'),
      quote('quote:future', '2026-09-19T20:01:00Z', '100.50', '100.70'),
    ],
    bars: [bar],
    orderBooks: [book],
    corporateActions: [split],
    benchmarkReferences: [benchmarkReference],
    benchmarkObservations: [benchmarkObservation],
    informationCutoff: '2026-09-19T20:00:00Z',
    derivedAt: '2026-09-19T20:00:10Z',
    methodologyVersion: '1',
    sourceManifest: ['market-feed', 'market-depth', 'corp-actions', 'index-feed'],
    snapshotHash: 'snapshot-hash',
  };
}

test('MONEY-STOCK-01 builds a point-in-time market snapshot without future leakage', () => {
  const snapshot = buildStockMarketSnapshot(snapshotInput());
  assert.equal(snapshot.schemaVersion, 'MONEY-STOCK-01');
  assert.equal(snapshot.quote?.quoteId, 'quote:current');
  assert.equal(snapshot.bars.length, 1);
  assert.equal(snapshot.bars[0]?.adjustmentStatus, 'UNADJUSTED');
  assert.equal(snapshot.orderBook?.bookId, 'book:1');
  assert.equal(snapshot.knownCorporateActions[0]?.actionId, 'action:split:1');
  assert.equal(snapshot.benchmarks[0]?.observation?.observationId, 'benchmark:sp500:1');
  assert.equal(snapshot.executionAuthority, 'NONE');
  assert.ok(!snapshot.marketEvidenceRefs.includes('quote:future:evidence'));
});

test('future corporate actions are visible when they were already announced by cutoff', () => {
  const snapshot = buildStockMarketSnapshot(snapshotInput());
  assert.equal(snapshot.knownCorporateActions.length, 1);
  assert.equal(
    snapshot.knownCorporateActions[0]?.effectiveAt,
    '2026-09-25T13:30:00Z',
  );
});

test('crossed quotes and books fail closed', () => {
  assert.throws(
    () => assertStockQuote(quote('quote:crossed', '2026-09-19T19:59:20Z', '101', '100')),
    /CROSSED_QUOTE/,
  );

  assert.throws(
    () =>
      assertStockOrderBook({
        ...book,
        bids: [{ price: '101', size: '10' }],
        asks: [{ price: '100', size: '10' }],
      }),
    /CROSSED_BOOK/,
  );
});

test('snapshot rejects market records with the wrong venue or currency', () => {
  const input = snapshotInput();
  assert.throws(
    () =>
      buildStockMarketSnapshot({
        ...input,
        quotes: [{ ...quote('quote:bad', '2026-09-19T19:59:20Z'), venue: 'XNYS' }],
      }),
    /VENUE_MISMATCH/,
  );
});

const relationship: IssuerInstrumentRelationship = {
  relationshipId: 'issuer-stock:1',
  issuerId: 'issuer:acme',
  instrumentId: instrument.instrumentId,
  relationshipType: 'ISSUER_OF',
  effectiveAt: '2020-01-01T00:00:00Z',
  evidenceRefs: [],
  provenanceHash: 'issuer-stock:hash',
};

function fundamentalState(
  informationCutoff = '2026-09-18T20:00:00Z',
): FundamentalState {
  return {
    stateId: `fundamental:${informationCutoff}`,
    issuerId: 'issuer:acme',
    informationCutoff,
    factIds: ['fact:revenue'],
    status: 'DATA_COMPLETE',
    derivedAt: '2026-09-19T12:00:00Z',
    methodologyVersion: '1',
    inputSnapshotHash: 'fundamental-input-hash',
    evidenceRefs: [],
    provenanceHash: 'fundamental-provenance-hash',
  };
}

test('fuses market and issuer reality while preserving zero financial authority', () => {
  const market = buildStockMarketSnapshot(snapshotInput());
  const fused = buildStockIssuerMarketState(
    instrument,
    market,
    relationship,
    fundamentalState(),
    '1',
    'fusion-hash',
  );

  assert.equal(fused.instrumentId, instrument.instrumentId);
  assert.equal(fused.issuerId, 'issuer:acme');
  assert.equal(fused.status, 'FUNDAMENTALS_PRIOR_CUTOFF');
  assert.ok(fused.fundamentalLagMs > 0);
  assert.equal(fused.financialAuthority, 'NONE');
});

test('issuer fusion rejects fundamentals that were not available at the market cutoff', () => {
  const market = buildStockMarketSnapshot(snapshotInput());
  assert.throws(
    () =>
      buildStockIssuerMarketState(
        instrument,
        market,
        relationship,
        fundamentalState('2026-09-20T00:00:00Z'),
        '1',
        'fusion-hash',
      ),
    /FUNDAMENTAL_FUTURE_LEAK/,
  );
});

test('session state cannot leak future observations into a historical snapshot', () => {
  const input = snapshotInput();
  assert.throws(
    () =>
      buildStockMarketSnapshot({
        ...input,
        session: {
          ...session,
          observedAt: '2026-09-19T20:00:01Z',
          effectiveAt: '2026-09-19T20:00:01Z',
        },
      }),
    /SESSION_FUTURE_LEAK/,
  );
});
