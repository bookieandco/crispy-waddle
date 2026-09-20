import test from 'node:test';
import assert from 'node:assert/strict';
import type { EvidenceRef } from './financial-intelligence-contracts.js';
import type { NormalizedMetric } from './fundamental-normalization-contracts.js';
import type { StockIssuerMarketState, StockMarketSnapshot } from './stock-market-reality.js';
import {
  buildRatioFactorObservation,
  buildStockFactorSet,
  buildStockForecast,
  buildStockIntelligenceSnapshot,
  buildStockRiskAssessment,
  deriveMarketMicrostructureFactors,
  resolveStockForecast,
  scoreStockForecast,
  stockReferencePrice,
  type StockFactorObservation,
} from './stock-intelligence-fusion.js';

const evidence: EvidenceRef = {
  evidenceId: 'fundamental:e1',
  sourceId: 'sec',
  observedAt: '2026-09-18T20:00:00Z',
  receivedAt: '2026-09-18T20:01:00Z',
  quality: 'VERIFIED',
  inputHash: 'fundamental-input',
};

const market: StockMarketSnapshot = {
  schemaVersion: 'MONEY-STOCK-01',
  snapshotId: 'stock:acme:2026-09-19',
  instrumentId: 'stock:acme:xnas',
  venue: 'XNAS',
  quoteCurrency: 'USD',
  informationCutoff: '2026-09-19T20:00:00Z',
  derivedAt: '2026-09-19T20:00:10Z',
  session: {
    sessionId: 'xnas:regular',
    marketId: 'xnas',
    venue: 'XNAS',
    timezone: 'America/New_York',
    opensAt: '2026-09-19T13:30:00Z',
    closesAt: '2026-09-19T20:00:00Z',
    status: 'OPEN',
    observedAt: '2026-09-19T19:59:00Z',
    effectiveAt: '2026-09-19T19:59:00Z',
    evidenceRefs: ['session:e1'],
  },
  quote: {
    quoteId: 'quote:1',
    instrumentId: 'stock:acme:xnas',
    venue: 'XNAS',
    currency: 'USD',
    bidPrice: '99.90',
    askPrice: '100.10',
    bidSize: '100',
    askSize: '120',
    observedAt: '2026-09-19T19:59:30Z',
    availableAt: '2026-09-19T19:59:30Z',
    receivedAt: '2026-09-19T19:59:31Z',
    provider: 'market-feed',
    evidenceRef: 'quote:e1',
    provenanceHash: 'quote:hash',
  },
  bars: [
    {
      barId: 'bar:1',
      instrumentId: 'stock:acme:xnas',
      venue: 'XNAS',
      currency: 'USD',
      interval: '1d',
      startsAt: '2026-09-17T13:30:00Z',
      endsAt: '2026-09-17T20:00:00Z',
      observedAt: '2026-09-17T20:00:00Z',
      availableAt: '2026-09-17T20:00:01Z',
      receivedAt: '2026-09-17T20:00:02Z',
      open: '95',
      high: '98',
      low: '94',
      close: '96',
      volume: '1000',
      adjustmentStatus: 'UNADJUSTED',
      provider: 'market-feed',
      evidenceRef: 'bar:e1',
      provenanceHash: 'bar1:hash',
    },
    {
      barId: 'bar:2',
      instrumentId: 'stock:acme:xnas',
      venue: 'XNAS',
      currency: 'USD',
      interval: '1d',
      startsAt: '2026-09-18T13:30:00Z',
      endsAt: '2026-09-18T20:00:00Z',
      observedAt: '2026-09-18T20:00:00Z',
      availableAt: '2026-09-18T20:00:01Z',
      receivedAt: '2026-09-18T20:00:02Z',
      open: '96',
      high: '101',
      low: '95',
      close: '100',
      volume: '1200',
      adjustmentStatus: 'UNADJUSTED',
      provider: 'market-feed',
      evidenceRef: 'bar:e2',
      provenanceHash: 'bar2:hash',
    },
  ],
  orderBook: {
    bookId: 'book:1',
    instrumentId: 'stock:acme:xnas',
    venue: 'XNAS',
    currency: 'USD',
    bids: [{ price: '99.90', size: '100' }],
    asks: [{ price: '100.10', size: '50' }],
    observedAt: '2026-09-19T19:59:40Z',
    availableAt: '2026-09-19T19:59:40Z',
    receivedAt: '2026-09-19T19:59:41Z',
    provider: 'market-depth',
    evidenceRef: 'book:e1',
    provenanceHash: 'book:hash',
  },
  knownCorporateActions: [],
  benchmarks: [
    {
      reference: {
        referenceId: 'benchmark-ref:1',
        instrumentId: 'stock:acme:xnas',
        benchmarkId: 'index:SP500',
        relationship: 'MARKET',
        effectiveAt: '2020-01-01T00:00:00Z',
        availableAt: '2020-01-01T00:00:00Z',
        receivedAt: '2020-01-01T00:00:01Z',
        evidenceRef: 'benchmark:e1',
        provenanceHash: 'benchmark:hash',
      },
    },
  ],
  methodologyVersion: '1',
  sourceManifest: ['market-feed'],
  snapshotHash: 'market-snapshot-hash',
  marketEvidenceRefs: [
    'session:e1',
    'quote:e1',
    'bar:e1',
    'bar:e2',
    'book:e1',
    'benchmark:e1',
  ],
  executionAuthority: 'NONE',
};

const issuerMarketState: StockIssuerMarketState = {
  stateId: 'issuer-market:1',
  instrumentId: 'stock:acme:xnas',
  issuerId: 'issuer:acme',
  informationCutoff: '2026-09-19T20:00:00Z',
  marketSnapshotId: market.snapshotId,
  fundamentalStateId: 'fundamental:1',
  issuerInstrumentRelationshipId: 'issuer-stock:1',
  fundamentalLagMs: 86_400_000,
  status: 'FUNDAMENTALS_PRIOR_CUTOFF',
  methodologyVersion: '1',
  provenanceHash: 'issuer-market:hash',
  financialAuthority: 'NONE',
};

const normalizedMetric: NormalizedMetric = {
  metricId: 'metric:eps',
  issuerId: 'issuer:acme',
  conceptId: 'EPS_DILUTED_TTM',
  value: {
    coefficient: 500n,
    scale: 2,
    currency: 'USD',
    unit: 'USD_PER_SHARE',
  },
  treatment: 'NORMALIZED',
  sourceFactIds: ['fact:eps'],
  sourceStateId: 'fundamental:1',
  informationCutoff: '2026-09-18T20:00:00Z',
  methodologyVersion: '1',
  normalizationRuleIds: ['rule:eps'],
  status: 'VALID',
  inputSnapshotHash: 'fundamental-input',
  evidenceRefs: [evidence],
  provenanceHash: 'metric:hash',
};

function buildFactorSet() {
  const marketFactors = deriveMarketMicrostructureFactors(
    market,
    issuerMarketState.issuerId,
    '1',
    'market-factor:hash',
  );

  const pe = buildRatioFactorObservation({
    factorId: 'factor:pe',
    instrumentId: market.instrumentId,
    issuerId: issuerMarketState.issuerId,
    category: 'VALUATION',
    name: 'PRICE_TO_EARNINGS',
    numerator: stockReferencePrice(market),
    denominator: 5,
    unit: 'MULTIPLE',
    informationCutoff: market.informationCutoff,
    sourceMetricIds: [normalizedMetric.metricId],
    sourceMarketEvidenceRefs: ['quote:e1'],
    sourceBenchmarkIds: [],
    methodologyVersion: '1',
    evidenceRefs: ['quote:e1', evidence.evidenceId],
    provenanceHash: 'factor:pe:hash',
  });

  return buildStockFactorSet({
    marketSnapshot: market,
    issuerMarketState,
    fundamentalMetrics: [normalizedMetric],
    factors: [...marketFactors, pe],
    methodologyVersion: '1',
    inputSnapshotHash: 'factor-input-hash',
    provenanceHash: 'factor-set-hash',
  });
}

function buildForecast() {
  const factorSet = buildFactorSet();
  return buildStockForecast({
    factorSet,
    marketSnapshot: market,
    issuerMarketState,
    forecastId: 'forecast:1',
    issuedAt: '2026-09-19T20:01:00Z',
    targetAt: '2026-09-26T20:00:00Z',
    horizonLabel: '1W',
    modelId: 'stock-research-model',
    modelVersion: '1.0.0',
    methodologyVersion: '1',
    scenarios: [
      {
        scenarioId: 'down',
        label: 'Downside',
        probability: 0.2,
        expectedReturn: -0.08,
        maxReturnExclusive: -0.02,
      },
      {
        scenarioId: 'flat',
        label: 'Range',
        probability: 0.5,
        expectedReturn: 0,
        minReturnInclusive: -0.02,
        maxReturnExclusive: 0.03,
      },
      {
        scenarioId: 'up',
        label: 'Upside',
        probability: 0.3,
        expectedReturn: 0.08,
        minReturnInclusive: 0.03,
      },
    ],
    calibrationStatus: 'PARTIAL',
    priorCalibrationScore: 0.22,
    evidenceRefs: ['model:e1'],
    inputSnapshotHash: 'forecast-input-hash',
    provenanceHash: 'forecast-hash',
  });
}

test('derives deterministic market microstructure and momentum factors', () => {
  const factors = deriveMarketMicrostructureFactors(
    market,
    issuerMarketState.issuerId,
    '1',
    'market-factor:hash',
  );
  assert.equal(factors.length, 3);
  assert.equal(factors[0]?.name, 'BID_ASK_SPREAD_BPS');
  assert.equal(factors[1]?.name, 'TOP_BOOK_IMBALANCE');
  assert.equal(factors[2]?.name, 'SNAPSHOT_TRAILING_RETURN');
  assert.ok((factors[2]?.value ?? 0) > 0);
});

test('builds valuation/factor fusion only from known point-in-time sources', () => {
  const factorSet = buildFactorSet();
  assert.equal(factorSet.financialAuthority, 'NONE');
  assert.equal(factorSet.factors.length, 4);
  assert.ok(factorSet.evidenceRefs.includes(evidence.evidenceId));
});

test('rejects a factor that cites a future or unknown fundamental metric', () => {
  const badMetric: NormalizedMetric = {
    ...normalizedMetric,
    metricId: 'metric:future',
    informationCutoff: '2026-09-20T20:00:00Z',
  };

  const factor: Omit<
    StockFactorObservation,
    'instrumentId' | 'issuerId' | 'informationCutoff'
  > = {
    factorId: 'factor:future',
    category: 'QUALITY',
    name: 'FUTURE_FACTOR',
    value: 1,
    unit: 'RATIO',
    sourceMetricIds: ['metric:future'],
    sourceMarketEvidenceRefs: [],
    sourceBenchmarkIds: [],
    methodologyVersion: '1',
    evidenceRefs: [evidence.evidenceId],
    provenanceHash: 'factor:future:hash',
  };

  assert.throws(
    () =>
      buildStockFactorSet({
        marketSnapshot: market,
        issuerMarketState,
        fundamentalMetrics: [badMetric],
        factors: [factor],
        methodologyVersion: '1',
        inputSnapshotHash: 'input',
        provenanceHash: 'provenance',
      }),
    /METRIC_FUTURE_LEAK/,
  );
});

test('builds a normalized probabilistic forecast with no financial authority', () => {
  const forecast = buildForecast();
  assert.equal(forecast.scenarios.length, 3);
  assert.equal(
    forecast.scenarios.reduce((sum, scenario) => sum + scenario.probability, 0),
    1,
  );
  assert.equal(forecast.financialAuthority, 'NONE');
});

test('rejects invalid forecast probability mass and overlapping bounded ranges', () => {
  const factorSet = buildFactorSet();

  assert.throws(
    () =>
      buildStockForecast({
        factorSet,
        marketSnapshot: market,
        issuerMarketState,
        forecastId: 'forecast:bad-mass',
        issuedAt: '2026-09-19T20:01:00Z',
        targetAt: '2026-09-26T20:00:00Z',
        horizonLabel: '1W',
        modelId: 'm',
        modelVersion: '1',
        methodologyVersion: '1',
        scenarios: [
          { scenarioId: 'a', label: 'A', probability: 0.8, expectedReturn: -0.1 },
          { scenarioId: 'b', label: 'B', probability: 0.8, expectedReturn: 0.1 },
        ],
        calibrationStatus: 'UNKNOWN',
        evidenceRefs: ['model:e1'],
        inputSnapshotHash: 'hash',
        provenanceHash: 'hash',
      }),
    /PROBABILITY_MASS_INVALID/,
  );

  assert.throws(
    () =>
      buildStockForecast({
        factorSet,
        marketSnapshot: market,
        issuerMarketState,
        forecastId: 'forecast:overlap',
        issuedAt: '2026-09-19T20:01:00Z',
        targetAt: '2026-09-26T20:00:00Z',
        horizonLabel: '1W',
        modelId: 'm',
        modelVersion: '1',
        methodologyVersion: '1',
        scenarios: [
          {
            scenarioId: 'a',
            label: 'A',
            probability: 0.5,
            expectedReturn: -0.01,
            minReturnInclusive: -0.1,
            maxReturnExclusive: 0.05,
          },
          {
            scenarioId: 'b',
            label: 'B',
            probability: 0.5,
            expectedReturn: 0.05,
            minReturnInclusive: 0.04,
            maxReturnExclusive: 0.1,
          },
        ],
        calibrationStatus: 'UNKNOWN',
        evidenceRefs: ['model:e1'],
        inputSnapshotHash: 'hash',
        provenanceHash: 'hash',
      }),
    /RANGES_OVERLAP/,
  );
});

test('attaches research risk/stress context without making the forecast executable', () => {
  const forecast = buildForecast();
  const risk = buildStockRiskAssessment({
    forecast,
    riskAssessmentId: 'risk:1',
    volatilityEstimate: 0.32,
    downsideEstimate: -0.15,
    liquidityRisk: 'LOW',
    stressScenarios: [
      {
        stressId: 'stress:earnings-miss',
        label: 'Earnings miss',
        shockedReturn: -0.18,
        rationale: 'Research stress only',
        evidenceRefs: ['stress:e1'],
      },
    ],
    methodologyVersion: '1',
    evidenceRefs: ['risk:e1'],
    provenanceHash: 'risk:hash',
  });

  assert.equal(risk.financialAuthority, 'NONE');
  assert.equal(risk.stressScenarios.length, 1);
});

test('full stock intelligence snapshot remains RESEARCH_ONLY and authority-missing', () => {
  const factorSet = buildFactorSet();
  const forecast = buildForecast();
  const risk = buildStockRiskAssessment({
    forecast,
    riskAssessmentId: 'risk:1',
    liquidityRisk: 'LOW',
    stressScenarios: [],
    methodologyVersion: '1',
    evidenceRefs: ['risk:e1'],
    provenanceHash: 'risk:hash',
  });

  const intelligence = buildStockIntelligenceSnapshot({
    accountId: 'research-account',
    requestedBy: 'stock-research',
    createdAt: '2026-09-19T20:02:00Z',
    factorSet,
    forecast,
    risk,
    intelligenceId: 'stock-intelligence:1',
    provenanceHash: 'stock-intelligence:hash',
  });

  assert.equal(intelligence.schemaVersion, 'MONEY-STOCK-02');
  assert.equal(intelligence.decisionCase.status, 'RESEARCH_ONLY');
  assert.equal(intelligence.assessment.disposition, 'RESEARCH_ONLY');
  assert.equal(intelligence.assessment.authorityStatus, 'MISSING');
  assert.equal(intelligence.financialAuthority, 'NONE');
});

test('forecast resolution and scoring create calibration evidence after the target', () => {
  const forecast = buildForecast();
  const resolution = resolveStockForecast({
    forecast,
    resolutionId: 'resolution:1',
    resolvedAt: '2026-09-26T20:01:00Z',
    referencePrice: 100,
    resolvedPrice: 106,
    authority: 'canonical-market-close',
    ruleVersion: '1',
    evidenceRefs: ['close:e1'],
    provenanceHash: 'resolution:hash',
  });

  assert.equal(resolution.matchedScenarioId, 'up');
  assert.ok(resolution.realizedReturn > 0.05);

  const score = scoreStockForecast({
    forecast,
    resolution,
    scoreId: 'score:1',
    scoredAt: '2026-09-26T20:02:00Z',
    methodologyVersion: '1',
    provenanceHash: 'score:hash',
  });

  assert.ok((score.multiclassBrierScore ?? 0) > 0);
  assert.ok(score.absoluteExpectedReturnError >= 0);
});

test('forecast cannot be resolved before its target time', () => {
  const forecast = buildForecast();
  assert.throws(
    () =>
      resolveStockForecast({
        forecast,
        resolutionId: 'resolution:early',
        resolvedAt: '2026-09-25T20:00:00Z',
        referencePrice: 100,
        resolvedPrice: 102,
        authority: 'canonical-market-close',
        ruleVersion: '1',
        evidenceRefs: ['close:e1'],
        provenanceHash: 'resolution:hash',
      }),
    /RESOLUTION_BEFORE_TARGET/,
  );
});
