import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalInstrument } from './market-instrument-contracts.js';
import type { MacroSnapshotV2 } from './macro-economic-contracts-v2.js';
import {
  assertFxPair,
  assertFxQuote,
  buildFxCarryObservation,
  buildFxCrossQuote,
  buildFxMacroContext,
  buildFxMarketSnapshot,
  fxSpreadPips,
  type FxCurrency,
  type FxPairDefinition,
  type FxQuote,
  type FxTradingSession,
} from './fx-market-reality.js';

const usd: FxCurrency = {
  currencyId: 'currency:USD',
  code: 'USD',
  name: 'US Dollar',
  kind: 'FIAT',
  jurisdiction: 'US',
  centralBankId: 'central-bank:fed',
  settlementCalendarId: 'calendar:USD',
  minorUnits: 2,
  evidenceRefs: ['currency:usd:e1'],
  provenanceHash: 'currency:usd:hash',
};

const eur: FxCurrency = {
  currencyId: 'currency:EUR',
  code: 'EUR',
  name: 'Euro',
  kind: 'FIAT',
  jurisdiction: 'EU',
  centralBankId: 'central-bank:ecb',
  settlementCalendarId: 'calendar:EUR',
  minorUnits: 2,
  evidenceRefs: ['currency:eur:e1'],
  provenanceHash: 'currency:eur:hash',
};

const jpy: FxCurrency = {
  currencyId: 'currency:JPY',
  code: 'JPY',
  name: 'Japanese Yen',
  kind: 'FIAT',
  jurisdiction: 'JP',
  centralBankId: 'central-bank:boj',
  settlementCalendarId: 'calendar:JPY',
  minorUnits: 0,
  evidenceRefs: ['currency:jpy:e1'],
  provenanceHash: 'currency:jpy:hash',
};

const eurusdPair: FxPairDefinition = {
  pairId: 'fx:EURUSD',
  instrumentId: 'instrument:fx:EURUSD',
  symbol: 'EUR/USD',
  baseCurrency: 'EUR',
  quoteCurrency: 'USD',
  settlementCurrency: 'USD',
  marketType: 'SPOT_DELIVERABLE',
  venue: 'OTC',
  settlementLagBusinessDays: 2,
  pricePrecision: 5,
  pipSize: '0.0001',
  minimumPriceIncrement: '0.00001',
  standardLotBaseUnits: '100000',
  evidenceRefs: ['pair:eurusd:e1'],
  provenanceHash: 'pair:eurusd:hash',
};

const eurusdInstrument: CanonicalInstrument = {
  instrumentId: eurusdPair.instrumentId,
  assetClass: 'FOREX',
  instrumentType: 'SPOT_FX',
  venue: 'OTC',
  identifiers: ['symbol:EURUSD'],
  quoteCurrency: 'USD',
  settlementCurrency: 'USD',
  status: 'ACTIVE',
  provenanceHash: 'instrument:eurusd:hash',
};

function directQuote(
  pair: FxPairDefinition,
  quoteId: string,
  bidPrice: string,
  askPrice: string,
  availableAt = '2026-09-19T19:59:00Z',
): FxQuote {
  return {
    quoteId,
    pairId: pair.pairId,
    baseCurrency: pair.baseCurrency,
    quoteCurrency: pair.quoteCurrency,
    bidPrice,
    askPrice,
    observedAt: availableAt,
    availableAt,
    receivedAt: availableAt,
    provider: 'fx-feed',
    sourceType: 'DIRECT',
    sourceQuoteIds: [],
    evidenceRefs: [`${quoteId}:e1`],
    provenanceHash: `${quoteId}:hash`,
  };
}

const london: FxTradingSession = {
  sessionId: 'session:london:2026-09-19',
  name: 'LONDON',
  timezone: 'Europe/London',
  opensAt: '2026-09-19T07:00:00Z',
  closesAt: '2026-09-19T16:00:00Z',
  status: 'OPEN',
  observedAt: '2026-09-19T06:59:00Z',
  availableAt: '2026-09-19T06:59:00Z',
  receivedAt: '2026-09-19T06:59:01Z',
  evidenceRefs: ['session:london:e1'],
  provenanceHash: 'session:london:hash',
};

const newYork: FxTradingSession = {
  sessionId: 'session:new-york:2026-09-19',
  name: 'NEW_YORK',
  timezone: 'America/New_York',
  opensAt: '2026-09-19T12:00:00Z',
  closesAt: '2026-09-19T21:00:00Z',
  status: 'OPEN',
  observedAt: '2026-09-19T11:59:00Z',
  availableAt: '2026-09-19T11:59:00Z',
  receivedAt: '2026-09-19T11:59:01Z',
  evidenceRefs: ['session:new-york:e1'],
  provenanceHash: 'session:new-york:hash',
};

function macroSnapshot(
  currencyCode: string,
  cutoff = '2026-09-19T12:00:00Z',
): MacroSnapshotV2 {
  return {
    snapshotId: `macro:${currencyCode}:1`,
    informationCutoff: cutoff,
    artifactIds: [`macro:${currencyCode}:policy-rate`],
    methodologyVersion: '1',
    inputSnapshotHash: `macro:${currencyCode}:input`,
    provenanceHash: `macro:${currencyCode}:hash`,
  };
}

function macroContexts(cutoff = '2026-09-19T14:00:00Z') {
  return [
    buildFxMacroContext(
      eur,
      macroSnapshot('EUR'),
      cutoff,
      ['macro:eur:e1'],
      'macro-context:eur:hash',
    ),
    buildFxMacroContext(
      usd,
      macroSnapshot('USD'),
      cutoff,
      ['macro:usd:e1'],
      'macro-context:usd:hash',
    ),
  ];
}

test('validates canonical base/quote pair semantics against the instrument', () => {
  assert.doesNotThrow(() =>
    assertFxPair(eurusdPair, eurusdInstrument, eur, usd),
  );

  assert.throws(
    () =>
      assertFxPair(
        { ...eurusdPair, baseCurrency: 'USD', quoteCurrency: 'USD' },
        eurusdInstrument,
        usd,
        usd,
      ),
    /IDENTICAL_CURRENCIES/,
  );
});

test('rejects crossed direct FX quotes', () => {
  assert.throws(
    () =>
      assertFxQuote(
        directQuote(eurusdPair, 'quote:bad', '1.12000', '1.11000'),
        eurusdPair,
      ),
    /CROSSED_QUOTE/,
  );
});

test('computes pair spread in canonical pips', () => {
  const quote = directQuote(
    eurusdPair,
    'quote:spread',
    '1.10000',
    '1.10020',
  );
  assert.equal(fxSpreadPips(quote, eurusdPair), 2);
});

test('builds policy-rate differential and preserves provider-specific swap points', () => {
  const carry = buildFxCarryObservation({
    carryId: 'carry:eurusd:1',
    pair: eurusdPair,
    basePolicyRatePct: 2.5,
    quotePolicyRatePct: 4.0,
    longSwapPoints: '0',
    shortSwapPoints: '0.3',
    swapPointUnit: 'PIPS',
    rolloverAt: '2026-09-19T21:00:00Z',
    tripleRolloverWeekday: 'WEDNESDAY',
    observedAt: '2026-09-19T13:00:00Z',
    availableAt: '2026-09-19T13:00:01Z',
    receivedAt: '2026-09-19T13:00:02Z',
    provider: 'broker-swap-feed',
    evidenceRefs: ['carry:e1'],
    provenanceHash: 'carry:hash',
  });

  assert.equal(carry.rateDifferentialPct, -1.5);
  assert.equal(carry.longSwapPoints, '0');
  assert.equal(carry.shortSwapPoints, '0.3');
});

test('rejects macro context that did not exist at the FX information cutoff', () => {
  assert.throws(
    () =>
      buildFxMacroContext(
        eur,
        macroSnapshot('EUR', '2026-09-20T00:00:00Z'),
        '2026-09-19T14:00:00Z',
        ['macro:eur:e1'],
        'macro-context:eur:hash',
      ),
    /MACRO_FUTURE_LEAK/,
  );
});

test('reconstructs EUR/JPY from EUR/USD and USD/JPY with explicit bridge lineage', () => {
  const usdjpyPair: FxPairDefinition = {
    pairId: 'fx:USDJPY',
    instrumentId: 'instrument:fx:USDJPY',
    symbol: 'USD/JPY',
    baseCurrency: 'USD',
    quoteCurrency: 'JPY',
    settlementCurrency: 'JPY',
    marketType: 'SPOT_DELIVERABLE',
    venue: 'OTC',
    settlementLagBusinessDays: 2,
    pricePrecision: 3,
    pipSize: '0.01',
    minimumPriceIncrement: '0.001',
    standardLotBaseUnits: '100000',
    evidenceRefs: ['pair:usdjpy:e1'],
    provenanceHash: 'pair:usdjpy:hash',
  };
  const eurjpyPair: FxPairDefinition = {
    pairId: 'fx:EURJPY',
    instrumentId: 'instrument:fx:EURJPY',
    symbol: 'EUR/JPY',
    baseCurrency: 'EUR',
    quoteCurrency: 'JPY',
    settlementCurrency: 'JPY',
    marketType: 'SPOT_DELIVERABLE',
    venue: 'OTC',
    settlementLagBusinessDays: 2,
    pricePrecision: 3,
    pipSize: '0.01',
    minimumPriceIncrement: '0.001',
    standardLotBaseUnits: '100000',
    evidenceRefs: ['pair:eurjpy:e1'],
    provenanceHash: 'pair:eurjpy:hash',
  };

  const cross = buildFxCrossQuote({
    targetPair: eurjpyPair,
    bridgeCurrency: 'USD',
    leftPair: eurusdPair,
    leftQuote: directQuote(
      eurusdPair,
      'quote:eurusd',
      '1.10000',
      '1.10020',
      '2026-09-19T13:59:00Z',
    ),
    rightPair: usdjpyPair,
    rightQuote: directQuote(
      usdjpyPair,
      'quote:usdjpy',
      '150.000',
      '150.030',
      '2026-09-19T13:59:10Z',
    ),
    informationCutoff: '2026-09-19T14:00:00Z',
    derivedAt: '2026-09-19T13:59:30Z',
    provenanceHash: 'cross:eurjpy:hash',
  });

  assert.equal(cross.sourceType, 'CROSS_DERIVED');
  assert.deepEqual(cross.sourceQuoteIds, [
    'quote:eurusd',
    'quote:usdjpy',
  ]);
  assert.equal(cross.bidPrice, '165.000');
  assert.equal(cross.askPrice, '165.063');
});

test('cross-rate reconstruction supports inversion on a source leg', () => {
  const usdEurPair: FxPairDefinition = {
    ...eurusdPair,
    pairId: 'fx:USDEUR',
    instrumentId: 'instrument:fx:USDEUR',
    symbol: 'USD/EUR',
    baseCurrency: 'USD',
    quoteCurrency: 'EUR',
    settlementCurrency: 'EUR',
    provenanceHash: 'pair:usdeur:hash',
  };
  const usdJpyPair: FxPairDefinition = {
    pairId: 'fx:USDJPY',
    instrumentId: 'instrument:fx:USDJPY',
    symbol: 'USD/JPY',
    baseCurrency: 'USD',
    quoteCurrency: 'JPY',
    settlementCurrency: 'JPY',
    marketType: 'SPOT_DELIVERABLE',
    venue: 'OTC',
    settlementLagBusinessDays: 2,
    pricePrecision: 3,
    pipSize: '0.01',
    minimumPriceIncrement: '0.001',
    standardLotBaseUnits: '100000',
    evidenceRefs: ['pair:usdjpy:e1'],
    provenanceHash: 'pair:usdjpy:hash',
  };
  const eurJpyPair: FxPairDefinition = {
    pairId: 'fx:EURJPY',
    instrumentId: 'instrument:fx:EURJPY',
    symbol: 'EUR/JPY',
    baseCurrency: 'EUR',
    quoteCurrency: 'JPY',
    settlementCurrency: 'JPY',
    marketType: 'SPOT_DELIVERABLE',
    venue: 'OTC',
    settlementLagBusinessDays: 2,
    pricePrecision: 3,
    pipSize: '0.01',
    minimumPriceIncrement: '0.001',
    standardLotBaseUnits: '100000',
    evidenceRefs: ['pair:eurjpy:e1'],
    provenanceHash: 'pair:eurjpy:hash',
  };

  const cross = buildFxCrossQuote({
    targetPair: eurJpyPair,
    bridgeCurrency: 'USD',
    leftPair: usdEurPair,
    leftQuote: directQuote(
      usdEurPair,
      'quote:usdeur',
      '0.90890',
      '0.90910',
      '2026-09-19T13:59:00Z',
    ),
    rightPair: usdJpyPair,
    rightQuote: directQuote(
      usdJpyPair,
      'quote:usdjpy:2',
      '150.000',
      '150.030',
      '2026-09-19T13:59:10Z',
    ),
    informationCutoff: '2026-09-19T14:00:00Z',
    derivedAt: '2026-09-19T13:59:30Z',
    provenanceHash: 'cross:inverted:hash',
  });

  assert.equal(cross.sourceType, 'CROSS_DERIVED');
  assert.ok(Number(cross.bidPrice) > 164);
  assert.ok(Number(cross.askPrice) > Number(cross.bidPrice));
});

test('builds a point-in-time FX snapshot with overlapping active sessions and no execution authority', () => {
  const carry = buildFxCarryObservation({
    carryId: 'carry:eurusd:1',
    pair: eurusdPair,
    basePolicyRatePct: 2.5,
    quotePolicyRatePct: 4.0,
    longSwapPoints: '-0.8',
    shortSwapPoints: '0.3',
    swapPointUnit: 'PIPS',
    rolloverAt: '2026-09-19T21:00:00Z',
    tripleRolloverWeekday: 'WEDNESDAY',
    observedAt: '2026-09-19T13:00:00Z',
    availableAt: '2026-09-19T13:00:01Z',
    receivedAt: '2026-09-19T13:00:02Z',
    provider: 'broker-swap-feed',
    evidenceRefs: ['carry:e1'],
    provenanceHash: 'carry:hash',
  });

  const snapshot = buildFxMarketSnapshot({
    instrument: eurusdInstrument,
    pair: eurusdPair,
    baseCurrency: eur,
    quoteCurrency: usd,
    quotes: [
      directQuote(
        eurusdPair,
        'quote:current',
        '1.10000',
        '1.10020',
        '2026-09-19T13:59:30Z',
      ),
      directQuote(
        eurusdPair,
        'quote:future',
        '1.10100',
        '1.10120',
        '2026-09-19T14:01:00Z',
      ),
    ],
    sessions: [london, newYork],
    carryObservations: [carry],
    macroContexts: macroContexts(),
    informationCutoff: '2026-09-19T14:00:00Z',
    derivedAt: '2026-09-19T14:00:10Z',
    methodologyVersion: '1',
    sourceManifest: [
      'fx-feed',
      'session-calendar',
      'broker-swap-feed',
      'macro-core',
    ],
    snapshotHash: 'fx-snapshot-hash',
  });

  assert.equal(snapshot.schemaVersion, 'MONEY-FOREX-01');
  assert.equal(snapshot.quote.quoteId, 'quote:current');
  assert.equal(snapshot.activeSessions.length, 2);
  assert.equal(snapshot.carry?.rateDifferentialPct, -1.5);
  assert.equal(snapshot.baseMacroContext.currencyCode, 'EUR');
  assert.equal(snapshot.quoteMacroContext.currencyCode, 'USD');
  assert.equal(snapshot.spreadPips, 2);
  assert.equal(snapshot.researchAuthority, 'INTELLIGENCE_ONLY');
  assert.equal(snapshot.executionAuthority, 'NONE');
  assert.equal(snapshot.financialAuthority, 'NONE');
  assert.ok(!snapshot.evidenceRefs.includes('quote:future:e1'));
});

test('FX snapshot fails closed without both currency macro contexts', () => {
  assert.throws(
    () =>
      buildFxMarketSnapshot({
        instrument: eurusdInstrument,
        pair: eurusdPair,
        baseCurrency: eur,
        quoteCurrency: usd,
        quotes: [
          directQuote(
            eurusdPair,
            'quote:current',
            '1.10000',
            '1.10020',
          ),
        ],
        sessions: [london, newYork],
        carryObservations: [],
        macroContexts: [
          buildFxMacroContext(
            eur,
            macroSnapshot('EUR'),
            '2026-09-19T14:00:00Z',
            ['macro:eur:e1'],
            'macro-context:eur:hash',
          ),
        ],
        informationCutoff: '2026-09-19T14:00:00Z',
        derivedAt: '2026-09-19T14:00:10Z',
        methodologyVersion: '1',
        sourceManifest: ['fx-feed', 'macro-core'],
        snapshotHash: 'fx-snapshot-hash',
      }),
    /QUOTE_MACRO_CONTEXT_REQUIRED/,
  );
});

test('cross quote rejects source data unavailable by historical cutoff', () => {
  const usdjpyPair: FxPairDefinition = {
    pairId: 'fx:USDJPY',
    instrumentId: 'instrument:fx:USDJPY',
    symbol: 'USD/JPY',
    baseCurrency: 'USD',
    quoteCurrency: 'JPY',
    settlementCurrency: 'JPY',
    marketType: 'SPOT_DELIVERABLE',
    venue: 'OTC',
    settlementLagBusinessDays: 2,
    pricePrecision: 3,
    pipSize: '0.01',
    minimumPriceIncrement: '0.001',
    standardLotBaseUnits: '100000',
    evidenceRefs: ['pair:usdjpy:e1'],
    provenanceHash: 'pair:usdjpy:hash',
  };
  const eurjpyPair: FxPairDefinition = {
    pairId: 'fx:EURJPY',
    instrumentId: 'instrument:fx:EURJPY',
    symbol: 'EUR/JPY',
    baseCurrency: 'EUR',
    quoteCurrency: 'JPY',
    settlementCurrency: 'JPY',
    marketType: 'SPOT_DELIVERABLE',
    venue: 'OTC',
    settlementLagBusinessDays: 2,
    pricePrecision: 3,
    pipSize: '0.01',
    minimumPriceIncrement: '0.001',
    standardLotBaseUnits: '100000',
    evidenceRefs: ['pair:eurjpy:e1'],
    provenanceHash: 'pair:eurjpy:hash',
  };

  assert.throws(
    () =>
      buildFxCrossQuote({
        targetPair: eurjpyPair,
        bridgeCurrency: 'USD',
        leftPair: eurusdPair,
        leftQuote: directQuote(
          eurusdPair,
          'quote:eurusd:future',
          '1.10000',
          '1.10020',
          '2026-09-19T14:01:00Z',
        ),
        rightPair: usdjpyPair,
        rightQuote: directQuote(
          usdjpyPair,
          'quote:usdjpy',
          '150.000',
          '150.030',
          '2026-09-19T13:59:00Z',
        ),
        informationCutoff: '2026-09-19T14:00:00Z',
        derivedAt: '2026-09-19T14:00:00Z',
        provenanceHash: 'cross:future:hash',
      }),
    /SOURCE_FUTURE_LEAK/,
  );
});


test('historical snapshot ignores later macro contexts instead of leaking them', () => {
  const current = macroContexts();
  const futureUsd = {
    ...current[1]!,
    contextId: 'USD:macro:future',
    macroSnapshotId: 'macro:USD:future',
    macroInformationCutoff: '2026-09-20T00:00:00Z',
    macroArtifactIds: ['macro:USD:future-rate'],
    provenanceHash: 'macro-context:usd:future:hash',
  };

  const snapshot = buildFxMarketSnapshot({
    instrument: eurusdInstrument,
    pair: eurusdPair,
    baseCurrency: eur,
    quoteCurrency: usd,
    quotes: [
      directQuote(
        eurusdPair,
        'quote:current:macro-test',
        '1.10000',
        '1.10020',
      ),
    ],
    sessions: [london, newYork],
    carryObservations: [],
    macroContexts: [...current, futureUsd],
    informationCutoff: '2026-09-19T14:00:00Z',
    derivedAt: '2026-09-19T14:00:10Z',
    methodologyVersion: '1',
    sourceManifest: ['fx-feed', 'macro-core'],
    snapshotHash: 'fx-snapshot-macro-cutoff',
  });

  assert.equal(
    snapshot.quoteMacroContext.macroSnapshotId,
    'macro:USD:1',
  );
});
