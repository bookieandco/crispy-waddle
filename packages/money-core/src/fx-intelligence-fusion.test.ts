import assert from 'node:assert/strict';
import test from 'node:test';
import { assertProposalEligible } from './decision-workflow-contracts.js';
import type { FxMarketSnapshot } from './fx-market-reality.js';
import {
  buildFxFactorSet,
  buildFxForecast,
  buildFxIntelligenceSnapshot,
  buildFxRegimeAssessment,
  buildFxRiskAssessment,
  deriveFxRealityFactors,
  fxReferenceMidPrice,
  resolveFxForecast,
  scoreFxForecast,
  type FxFactorObservation,
} from './fx-intelligence-fusion.js';

const primary: FxMarketSnapshot = {
  schemaVersion: 'MONEY-FOREX-01',
  snapshotId: 'fx:EURUSD:2026-09-19T14:00Z',
  pairId: 'fx:EURUSD',
  instrumentId: 'instrument:fx:EURUSD',
  baseCurrency: 'EUR',
  quoteCurrency: 'USD',
  settlementCurrency: 'USD',
  informationCutoff: '2026-09-19T14:00:00Z',
  derivedAt: '2026-09-19T14:00:10Z',
  quote: {
    quoteId: 'quote:eurusd:1',
    pairId: 'fx:EURUSD',
    baseCurrency: 'EUR',
    quoteCurrency: 'USD',
    bidPrice: '1.10000',
    askPrice: '1.10020',
    observedAt: '2026-09-19T13:59:30Z',
    availableAt: '2026-09-19T13:59:30Z',
    receivedAt: '2026-09-19T13:59:31Z',
    provider: 'fx-feed',
    sourceType: 'DIRECT',
    sourceQuoteIds: [],
    evidenceRefs: ['quote:eurusd:e1'],
    provenanceHash: 'quote:eurusd:hash',
  },
  spreadPips: 2,
  activeSessions: [
    {
      sessionId: 'london',
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
    },
    {
      sessionId: 'new-york',
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
    },
  ],
  carry: {
    carryId: 'carry:eurusd:1',
    pairId: 'fx:EURUSD',
    baseCurrency: 'EUR',
    quoteCurrency: 'USD',
    basePolicyRatePct: 2.5,
    quotePolicyRatePct: 4,
    rateDifferentialPct: -1.5,
    longSwapPoints: '-0.8',
    shortSwapPoints: '0.3',
    swapPointUnit: 'PIPS',
    rolloverAt: '2026-09-19T21:00:00Z',
    tripleRolloverWeekday: 'WEDNESDAY',
    observedAt: '2026-09-19T13:00:00Z',
    availableAt: '2026-09-19T13:00:01Z',
    receivedAt: '2026-09-19T13:00:02Z',
    provider: 'broker-swap-feed',
    evidenceRefs: ['carry:eurusd:e1'],
    provenanceHash: 'carry:eurusd:hash',
  },
  baseMacroContext: {
    contextId: 'EUR:macro:1',
    currencyCode: 'EUR',
    jurisdiction: 'EU',
    centralBankId: 'central-bank:ecb',
    macroSnapshotId: 'macro:EUR:1',
    macroInformationCutoff: '2026-09-19T12:00:00Z',
    macroArtifactIds: ['macro:EUR:policy-rate'],
    evidenceRefs: ['macro:EUR:e1'],
    provenanceHash: 'macro:EUR:hash',
  },
  quoteMacroContext: {
    contextId: 'USD:macro:1',
    currencyCode: 'USD',
    jurisdiction: 'US',
    centralBankId: 'central-bank:fed',
    macroSnapshotId: 'macro:USD:1',
    macroInformationCutoff: '2026-09-19T12:00:00Z',
    macroArtifactIds: ['macro:USD:policy-rate'],
    evidenceRefs: ['macro:USD:e1'],
    provenanceHash: 'macro:USD:hash',
  },
  methodologyVersion: '1',
  sourceManifest: ['fx-feed', 'macro-core', 'session-calendar'],
  evidenceRefs: [
    'quote:eurusd:e1',
    'session:london:e1',
    'session:new-york:e1',
    'carry:eurusd:e1',
    'macro:EUR:e1',
    'macro:USD:e1',
  ],
  snapshotHash: 'fx:eurusd:snapshot-hash',
  researchAuthority: 'INTELLIGENCE_ONLY',
  executionAuthority: 'NONE',
  financialAuthority: 'NONE',
};

const related: FxMarketSnapshot = {
  ...primary,
  snapshotId: 'fx:USDJPY:2026-09-19T14:00Z',
  pairId: 'fx:USDJPY',
  instrumentId: 'instrument:fx:USDJPY',
  baseCurrency: 'USD',
  quoteCurrency: 'JPY',
  settlementCurrency: 'JPY',
  quote: {
    ...primary.quote,
    quoteId: 'quote:usdjpy:1',
    pairId: 'fx:USDJPY',
    baseCurrency: 'USD',
    quoteCurrency: 'JPY',
    bidPrice: '150.000',
    askPrice: '150.030',
    evidenceRefs: ['quote:usdjpy:e1'],
    provenanceHash: 'quote:usdjpy:hash',
  },
  spreadPips: 3,
  activeSessions: [],
  carry: undefined,
  baseMacroContext: {
    ...primary.quoteMacroContext,
    contextId: 'USD:macro:related',
  },
  quoteMacroContext: {
    contextId: 'JPY:macro:1',
    currencyCode: 'JPY',
    jurisdiction: 'JP',
    centralBankId: 'central-bank:boj',
    macroSnapshotId: 'macro:JPY:1',
    macroInformationCutoff: '2026-09-19T12:00:00Z',
    macroArtifactIds: ['macro:JPY:policy-rate'],
    evidenceRefs: ['macro:JPY:e1'],
    provenanceHash: 'macro:JPY:hash',
  },
  evidenceRefs: [
    'quote:usdjpy:e1',
    'macro:USD:e1',
    'macro:JPY:e1',
  ],
  snapshotHash: 'fx:usdjpy:snapshot-hash',
};

function buildFactorSet() {
  const derived = deriveFxRealityFactors(
    primary,
    '1',
    'fx-factor:derived:hash',
  );

  const crossPairFactor: Omit<
    FxFactorObservation,
    | 'pairId'
    | 'instrumentId'
    | 'baseCurrency'
    | 'quoteCurrency'
    | 'informationCutoff'
  > = {
    factorId: 'factor:usd-relative-context',
    category: 'CROSS_PAIR',
    name: 'USD_RELATED_PAIR_CONTEXT',
    value: 1,
    unit: 'BOOLEAN',
    sourceEvidenceRefs: ['quote:usdjpy:e1'],
    sourceMacroArtifactIds: ['macro:JPY:policy-rate'],
    sourceSnapshotIds: [related.snapshotId],
    methodologyVersion: '1',
    evidenceRefs: ['quote:usdjpy:e1', 'macro:JPY:e1'],
    provenanceHash: 'factor:usd-relative-context:hash',
  };

  return buildFxFactorSet({
    marketSnapshot: primary,
    relatedSnapshots: [related],
    factors: [...derived, crossPairFactor],
    methodologyVersion: '1',
    inputSnapshotHash: 'fx-factor-input-hash',
    provenanceHash: 'fx-factor-set-hash',
  });
}

function buildRegime() {
  const factorSet = buildFactorSet();
  return buildFxRegimeAssessment({
    factorSet,
    regimeId: 'regime:eurusd:1',
    label: 'QUOTE_RATE_ADVANTAGE',
    confidence: 0.72,
    rationale:
      'Quote-currency policy rate exceeds base-currency policy rate while London/New York overlap is active.',
    sourceFactorIds: [
      `${primary.snapshotId}:policy-rate-differential`,
      `${primary.snapshotId}:session-overlap`,
    ],
    methodologyVersion: '1',
    evidenceRefs: ['regime:model:e1'],
    provenanceHash: 'regime:eurusd:hash',
  });
}

function buildForecast() {
  const factorSet = buildFactorSet();
  const regime = buildFxRegimeAssessment({
    factorSet,
    regimeId: 'regime:eurusd:1',
    label: 'QUOTE_RATE_ADVANTAGE',
    confidence: 0.72,
    rationale: 'Relative-rate and session context.',
    sourceFactorIds: [
      `${primary.snapshotId}:policy-rate-differential`,
      `${primary.snapshotId}:session-overlap`,
    ],
    methodologyVersion: '1',
    evidenceRefs: ['regime:model:e1'],
    provenanceHash: 'regime:eurusd:hash',
  });

  return {
    factorSet,
    regime,
    forecast: buildFxForecast({
      factorSet,
      regime,
      marketSnapshot: primary,
      forecastId: 'forecast:eurusd:1',
      issuedAt: '2026-09-19T14:01:00Z',
      targetAt: '2026-09-20T14:00:00Z',
      horizonLabel: '1D',
      modelId: 'fx-research-model',
      modelVersion: '1.0.0',
      methodologyVersion: '1',
      scenarios: [
        {
          scenarioId: 'base-weakens',
          label: 'EUR weakens vs USD',
          probability: 0.35,
          expectedReturn: -0.006,
          maxReturnExclusive: -0.002,
        },
        {
          scenarioId: 'range',
          label: 'Range',
          probability: 0.45,
          expectedReturn: 0,
          minReturnInclusive: -0.002,
          maxReturnExclusive: 0.002,
        },
        {
          scenarioId: 'base-strengthens',
          label: 'EUR strengthens vs USD',
          probability: 0.2,
          expectedReturn: 0.005,
          minReturnInclusive: 0.002,
        },
      ],
      calibrationStatus: 'PARTIAL',
      priorCalibrationScore: 0.21,
      evidenceRefs: ['forecast:model:e1'],
      inputSnapshotHash: 'forecast:input:hash',
      provenanceHash: 'forecast:eurusd:hash',
    }),
  };
}

test('derives spread, session, carry and relative-rate factors from FX reality', () => {
  const factors = deriveFxRealityFactors(
    primary,
    '1',
    'derived:hash',
  );

  assert.equal(
    factors.find((factor) => factor.name === 'SPREAD_PIPS')?.value,
    2,
  );
  assert.equal(
    factors.find(
      (factor) => factor.name === 'ACTIVE_SESSION_COUNT',
    )?.value,
    2,
  );
  assert.equal(
    factors.find((factor) => factor.name === 'SESSION_OVERLAP')
      ?.value,
    1,
  );
  assert.equal(
    factors.find(
      (factor) =>
        factor.name === 'POLICY_RATE_DIFFERENTIAL_PCT',
    )?.value,
    -1.5,
  );
});

test('reference mid-price preserves decimal quote semantics', () => {
  assert.equal(fxReferenceMidPrice(primary), '1.10010');
});

test('factor set can use point-in-time related-pair context', () => {
  const factorSet = buildFactorSet();
  assert.equal(factorSet.financialAuthority, 'NONE');
  assert.deepEqual(factorSet.relatedSnapshotIds, [related.snapshotId]);
  assert.ok(
    factorSet.factors.some(
      (factor) => factor.name === 'USD_RELATED_PAIR_CONTEXT',
    ),
  );
});

test('factor set rejects future related-pair snapshots', () => {
  const futureRelated: FxMarketSnapshot = {
    ...related,
    snapshotId: 'fx:USDJPY:future',
    informationCutoff: '2026-09-20T14:00:00Z',
  };

  assert.throws(
    () =>
      buildFxFactorSet({
        marketSnapshot: primary,
        relatedSnapshots: [futureRelated],
        factors: deriveFxRealityFactors(
          primary,
          '1',
          'derived:hash',
        ),
        methodologyVersion: '1',
        inputSnapshotHash: 'input',
        provenanceHash: 'provenance',
      }),
    /RELATED_SNAPSHOT_FUTURE_LEAK/,
  );
});

test('factor set rejects invented cross-pair lineage', () => {
  const factor: Omit<
    FxFactorObservation,
    | 'pairId'
    | 'instrumentId'
    | 'baseCurrency'
    | 'quoteCurrency'
    | 'informationCutoff'
  > = {
    factorId: 'factor:invented',
    category: 'CROSS_PAIR',
    name: 'INVENTED_CONTEXT',
    value: 1,
    unit: 'BOOLEAN',
    sourceEvidenceRefs: ['quote:usdjpy:e1'],
    sourceMacroArtifactIds: [],
    sourceSnapshotIds: ['snapshot:not-present'],
    methodologyVersion: '1',
    evidenceRefs: ['quote:usdjpy:e1'],
    provenanceHash: 'factor:invented:hash',
  };

  assert.throws(
    () =>
      buildFxFactorSet({
        marketSnapshot: primary,
        relatedSnapshots: [related],
        factors: [factor],
        methodologyVersion: '1',
        inputSnapshotHash: 'input',
        provenanceHash: 'provenance',
      }),
    /UNKNOWN_SNAPSHOT/,
  );
});

test('regime assessment must cite factors from its factor set', () => {
  const factorSet = buildFactorSet();
  assert.throws(
    () =>
      buildFxRegimeAssessment({
        factorSet,
        regimeId: 'regime:bad',
        label: 'UNKNOWN',
        confidence: 0.5,
        rationale: 'Invalid lineage test.',
        sourceFactorIds: ['factor:not-present'],
        methodologyVersion: '1',
        evidenceRefs: ['regime:e1'],
        provenanceHash: 'regime:bad:hash',
      }),
    /UNKNOWN_FACTOR/,
  );
});

test('builds normalized FX forecast without financial authority', () => {
  const { forecast } = buildForecast();
  assert.equal(
    forecast.scenarios.reduce(
      (sum, scenario) => sum + scenario.probability,
      0,
    ),
    1,
  );
  assert.equal(forecast.financialAuthority, 'NONE');
});

test('forecast rejects invalid probability mass and overlapping ranges', () => {
  const factorSet = buildFactorSet();
  const regime = buildRegime();

  assert.throws(
    () =>
      buildFxForecast({
        factorSet,
        regime,
        marketSnapshot: primary,
        forecastId: 'forecast:bad-mass',
        issuedAt: '2026-09-19T14:01:00Z',
        targetAt: '2026-09-20T14:00:00Z',
        horizonLabel: '1D',
        modelId: 'm',
        modelVersion: '1',
        methodologyVersion: '1',
        scenarios: [
          {
            scenarioId: 'a',
            label: 'A',
            probability: 0.7,
            expectedReturn: -0.01,
          },
          {
            scenarioId: 'b',
            label: 'B',
            probability: 0.7,
            expectedReturn: 0.01,
          },
        ],
        calibrationStatus: 'UNKNOWN',
        evidenceRefs: ['model:e1'],
        inputSnapshotHash: 'input',
        provenanceHash: 'hash',
      }),
    /PROBABILITY_MASS_INVALID/,
  );

  assert.throws(
    () =>
      buildFxForecast({
        factorSet,
        regime,
        marketSnapshot: primary,
        forecastId: 'forecast:overlap',
        issuedAt: '2026-09-19T14:01:00Z',
        targetAt: '2026-09-20T14:00:00Z',
        horizonLabel: '1D',
        modelId: 'm',
        modelVersion: '1',
        methodologyVersion: '1',
        scenarios: [
          {
            scenarioId: 'a',
            label: 'A',
            probability: 0.5,
            expectedReturn: -0.01,
            minReturnInclusive: -0.05,
            maxReturnExclusive: 0.01,
          },
          {
            scenarioId: 'b',
            label: 'B',
            probability: 0.5,
            expectedReturn: 0.02,
            minReturnInclusive: 0,
            maxReturnExclusive: 0.05,
          },
        ],
        calibrationStatus: 'UNKNOWN',
        evidenceRefs: ['model:e1'],
        inputSnapshotHash: 'input',
        provenanceHash: 'hash',
      }),
    /RANGES_OVERLAP/,
  );
});

test('risk assessment preserves spread and explicit FX stress dimensions', () => {
  const { forecast } = buildForecast();
  const risk = buildFxRiskAssessment({
    forecast,
    marketSnapshot: primary,
    riskAssessmentId: 'risk:eurusd:1',
    volatilityEstimate: 0.09,
    downsideEstimate: -0.03,
    liquidityRisk: 'LOW',
    stressScenarios: [
      {
        stressId: 'stress:central-bank-surprise',
        label: 'Unexpected relative-rate shock',
        shockedReturn: -0.02,
        spreadShockPips: 12,
        carryDifferentialShockPct: -1,
        rationale: 'Research stress around a policy surprise.',
        evidenceRefs: ['stress:macro:e1'],
      },
    ],
    methodologyVersion: '1',
    evidenceRefs: ['risk:model:e1'],
    provenanceHash: 'risk:eurusd:hash',
  });

  assert.equal(risk.observedSpreadPips, 2);
  assert.equal(risk.stressScenarios[0]?.spreadShockPips, 12);
  assert.equal(risk.financialAuthority, 'NONE');
});

test('combined FX intelligence remains research-only and cannot satisfy proposal eligibility', () => {
  const { factorSet, regime, forecast } = buildForecast();
  const risk = buildFxRiskAssessment({
    forecast,
    marketSnapshot: primary,
    riskAssessmentId: 'risk:eurusd:1',
    liquidityRisk: 'LOW',
    stressScenarios: [],
    methodologyVersion: '1',
    evidenceRefs: ['risk:model:e1'],
    provenanceHash: 'risk:eurusd:hash',
  });

  const intelligence = buildFxIntelligenceSnapshot({
    accountId: 'research-account',
    requestedBy: 'fx-research',
    createdAt: '2026-09-19T14:02:00Z',
    intelligenceId: 'fx-intelligence:eurusd:1',
    factorSet,
    regime,
    forecast,
    risk,
    provenanceHash: 'fx-intelligence:hash',
  });

  assert.equal(intelligence.schemaVersion, 'MONEY-FOREX-02');
  assert.equal(intelligence.decisionCase.status, 'RESEARCH_ONLY');
  assert.equal(intelligence.assessment.disposition, 'RESEARCH_ONLY');
  assert.equal(intelligence.assessment.authorityStatus, 'MISSING');
  assert.equal(intelligence.financialAuthority, 'NONE');
  assert.throws(
    () => assertProposalEligible(intelligence.assessment),
    /NOT_PROPOSAL_ELIGIBLE/,
  );
});

test('resolves and scores FX forecast only after target time', () => {
  const { forecast } = buildForecast();
  const resolution = resolveFxForecast({
    forecast,
    resolutionId: 'resolution:eurusd:1',
    resolvedAt: '2026-09-20T14:00:01Z',
    referencePrice: fxReferenceMidPrice(primary),
    resolvedPrice: '1.10560',
    authority: 'canonical-fx-fixing',
    ruleVersion: '1',
    evidenceRefs: ['fixing:eurusd:e1'],
    provenanceHash: 'resolution:eurusd:hash',
  });

  assert.equal(
    resolution.matchedScenarioId,
    'base-strengthens',
  );
  assert.ok(resolution.realizedReturn > 0.002);

  const score = scoreFxForecast({
    forecast,
    resolution,
    scoreId: 'score:eurusd:1',
    scoredAt: '2026-09-20T14:01:00Z',
    methodologyVersion: '1',
    provenanceHash: 'score:eurusd:hash',
  });

  assert.ok((score.multiclassBrierScore ?? 0) > 0);
  assert.ok(score.absoluteExpectedReturnError >= 0);
});

test('resolution before target and scoring before resolution fail closed', () => {
  const { forecast } = buildForecast();

  assert.throws(
    () =>
      resolveFxForecast({
        forecast,
        resolutionId: 'resolution:early',
        resolvedAt: '2026-09-20T13:59:59Z',
        referencePrice: '1.10010',
        resolvedPrice: '1.10100',
        authority: 'canonical-fx-fixing',
        ruleVersion: '1',
        evidenceRefs: ['fixing:e1'],
        provenanceHash: 'resolution:early:hash',
      }),
    /RESOLUTION_BEFORE_TARGET/,
  );

  const resolution = resolveFxForecast({
    forecast,
    resolutionId: 'resolution:ok',
    resolvedAt: '2026-09-20T14:00:01Z',
    referencePrice: '1.10010',
    resolvedPrice: '1.10100',
    authority: 'canonical-fx-fixing',
    ruleVersion: '1',
    evidenceRefs: ['fixing:e1'],
    provenanceHash: 'resolution:ok:hash',
  });

  assert.throws(
    () =>
      scoreFxForecast({
        forecast,
        resolution,
        scoreId: 'score:early',
        scoredAt: '2026-09-20T14:00:00Z',
        methodologyVersion: '1',
        provenanceHash: 'score:early:hash',
      }),
    /SCORE_BEFORE_RESOLUTION/,
  );
});
