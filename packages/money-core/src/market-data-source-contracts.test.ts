import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MARKET_DATA_SOURCE_SCHEMA_VERSION,
  assertMarketDataSourceContract,
  assertMarketDataUseAllowed,
  canSupportPointInTimeResearch,
  marketDataSourceRiskFlags,
  type MarketDataSourceContract,
} from './market-data-source-contracts.js';

const lse: MarketDataSourceContract = {
  schemaVersion: MARKET_DATA_SOURCE_SCHEMA_VERSION,
  sourceId: 'provider:london-strategic-edge',
  providerName: 'London Strategic Edge',
  sourceKind: 'LICENSED_API',
  canonicalLocator: 'https://github.com/londonstrategicedge/lse-data',
  codeLicenseExpression: 'MIT',
  transports: ['HTTP', 'WEBSOCKET', 'FILE_EXPORT'],
  capabilities: [
    'LIVE_TICKS',
    'HISTORICAL_TICKS',
    'CANDLES',
    'OPTIONS_CHAIN',
    'OPTIONS_PRINTS',
    'OPTIONS_GREEKS',
    'ECONOMIC_CALENDAR',
    'MACRO_SERIES',
    'INSIDER_TRADES',
    'DIVIDENDS',
    'SPLITS',
    'FUNDAMENTALS',
    'COT',
    'YIELD_CURVE',
    'FUTURES',
    'FOREX',
    'CRYPTO',
    'BONDS',
  ],
  assetClasses: ['STOCK', 'FOREX', 'CRYPTO', 'COMMODITY', 'INDEX', 'ETF', 'FUTURES', 'OPTIONS', 'BONDS'],
  pointInTimeSupport: 'DERIVABLE',
  supportsObservedAt: true,
  supportsAvailableAt: false,
  rights: {
    basis: 'PROVIDER_DECLARED',
    termsLocator: 'https://londonstrategicedge.com/terms',
    evaluatedAt: '2026-09-26T21:50:00Z',
    research: 'ALLOWED',
    modelTraining: 'ALLOWED',
    commercialInternal: 'ALLOWED',
    redistribution: 'RESTRICTED',
    resale: 'RESTRICTED',
    notes: 'Client code is MIT; provider data rights are separate and provider-declared.',
    evidenceRefs: ['github:londonstrategicedge/lse-data:README'],
  },
  provenanceHash: 'lse-source-contract-proof',
  financialAuthority: 'NONE',
};

const referenceCode: MarketDataSourceContract = {
  schemaVersion: MARKET_DATA_SOURCE_SCHEMA_VERSION,
  sourceId: 'reference:simonlin1212/global-stock-data',
  providerName: 'global-stock-data',
  sourceKind: 'REFERENCE_CODE',
  canonicalLocator: 'https://github.com/simonlin1212/global-stock-data',
  codeLicenseExpression: 'Apache-2.0',
  transports: [],
  capabilities: [],
  assetClasses: ['STOCK', 'OPTIONS'],
  pointInTimeSupport: 'UNKNOWN',
  supportsObservedAt: false,
  supportsAvailableAt: false,
  rights: {
    basis: 'UNKNOWN',
    evaluatedAt: '2026-09-26T21:50:00Z',
    research: 'NOT_APPLICABLE',
    modelTraining: 'NOT_APPLICABLE',
    commercialInternal: 'NOT_APPLICABLE',
    redistribution: 'NOT_APPLICABLE',
    resale: 'NOT_APPLICABLE',
    notes: 'This record covers the open-source code reference only; every upstream market-data source retains its own terms.',
    evidenceRefs: ['github:simonlin1212/global-stock-data:README'],
  },
  provenanceHash: 'global-stock-data-reference-proof',
  financialAuthority: 'NONE',
};

test('MONEY-DATA-SOURCE-01 separates client-code license from fetched-data rights', () => {
  assert.doesNotThrow(() => assertMarketDataSourceContract(lse));
  assert.doesNotThrow(() => assertMarketDataUseAllowed(lse, 'RESEARCH'));
  assert.doesNotThrow(() => assertMarketDataUseAllowed(lse, 'MODEL_TRAINING'));
  assert.doesNotThrow(() => assertMarketDataUseAllowed(lse, 'COMMERCIAL_INTERNAL'));

  assert.throws(
    () => assertMarketDataUseAllowed(lse, 'REDISTRIBUTION'),
    /MONEY_DATA_SOURCE_USE_NOT_ALLOWED/,
  );
  assert.throws(
    () => assertMarketDataUseAllowed(lse, 'RESALE'),
    /MONEY_DATA_SOURCE_USE_NOT_ALLOWED/,
  );
});

test('MONEY-DATA-SOURCE-01 never promotes reference scraper code into a runtime data source', () => {
  assert.doesNotThrow(() => assertMarketDataSourceContract(referenceCode));
  assert.equal(canSupportPointInTimeResearch(referenceCode), false);
  assert.deepEqual(marketDataSourceRiskFlags(referenceCode), [
    'REFERENCE_CODE_NOT_RUNTIME_DATA',
    'POINT_IN_TIME_UNKNOWN',
    'AVAILABLE_AT_NOT_NATIVE',
    'DATA_RIGHTS_UNKNOWN',
    'COMMERCIAL_USE_NOT_CLEARED',
    'REDISTRIBUTION_NOT_CLEARED',
  ]);
});

test('MONEY-DATA-SOURCE-01 marks LSE research-capable but still records missing native availableAt and redistribution clearance', () => {
  assert.equal(canSupportPointInTimeResearch(lse), true);
  assert.deepEqual(marketDataSourceRiskFlags(lse), [
    'AVAILABLE_AT_NOT_NATIVE',
    'REDISTRIBUTION_NOT_CLEARED',
  ]);
});

test('MONEY-DATA-SOURCE-01 rejects non-reference providers with no transport or capability metadata', () => {
  assert.throws(
    () =>
      assertMarketDataSourceContract({
        ...lse,
        transports: [],
      }),
    /MONEY_DATA_SOURCE_TRANSPORT_REQUIRED/,
  );
  assert.throws(
    () =>
      assertMarketDataSourceContract({
        ...lse,
        capabilities: [],
      }),
    /MONEY_DATA_SOURCE_CAPABILITY_REQUIRED/,
  );
});
