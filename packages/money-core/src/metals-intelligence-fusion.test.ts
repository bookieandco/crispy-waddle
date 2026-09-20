import test from 'node:test';
import assert from 'node:assert/strict';
import { assertProposalEligible } from './decision-workflow-contracts.js';
import { buildMetalMarketSnapshot, type MetalInstrumentDefinition } from './metals-market-reality.js';
import {
  buildMetalFactorSet,
  buildMetalForecast,
  buildMetalIntelligenceSnapshot,
  buildMetalRegime,
  buildMetalRiskAssessment,
  type MetalFactorObservation,
} from './metals-intelligence-fusion.js';
import type { CanonicalInstrument } from './market-instrument-contracts.js';

const instrument: CanonicalInstrument = {
  instrumentId: 'metal:XAG:spot:LBMA',
  assetClass: 'XAG',
  instrumentType: 'SPOT_METAL',
  venue: 'LBMA',
  identifiers: ['XAG/USD'],
  quoteCurrency: 'USD',
  settlementCurrency: 'USD',
  status: 'ACTIVE',
  provenanceHash: 'instrument-proof',
};

const definition: MetalInstrumentDefinition = {
  definitionId: 'xag-spot-lbma',
  instrumentId: instrument.instrumentId,
  metal: 'XAG',
  marketType: 'SPOT',
  venue: 'LBMA',
  quoteCurrency: 'USD',
  settlementCurrency: 'USD',
  unit: 'TROY_OUNCE',
  purity: 0.999,
  minimumPriceIncrement: '0.001',
  evidenceRefs: ['definition-evidence'],
  provenanceHash: 'definition-proof',
};

const market = buildMetalMarketSnapshot({
  instrument,
  definition,
  quotes: [{
    quoteId: 'silver-q1',
    instrumentId: instrument.instrumentId,
    venue: 'LBMA',
    metal: 'XAG',
    unit: 'TROY_OUNCE',
    currency: 'USD',
    bidPrice: '31.000',
    askPrice: '31.040',
    observedAt: '2026-09-20T14:00:00Z',
    availableAt: '2026-09-20T14:00:01Z',
    receivedAt: '2026-09-20T14:00:02Z',
    provider: 'reference',
    evidenceRefs: ['quote-evidence'],
    provenanceHash: 'quote-proof',
  }],
  informationCutoff: '2026-09-20T15:00:00Z',
  derivedAt: '2026-09-20T15:00:01Z',
  methodologyVersion: 'metals-reality-v1',
  sourceManifest: ['provider:reference'],
  snapshotHash: 'snapshot-proof',
});

const realRateFactor: MetalFactorObservation = {
  factorId: 'real-rate',
  kind: 'REAL_RATE',
  value: 1.25,
  unit: 'PCT',
  informationCutoff: market.informationCutoff,
  sourceSnapshotIds: [market.snapshotId],
  evidenceRefs: ['real-rate-evidence'],
  methodologyVersion: 'real-rate-v1',
  provenanceHash: 'real-rate-proof',
};

test('MONEY-METALS-02 remains research-only through factor, forecast, risk and decision case', () => {
  const factors = buildMetalFactorSet({
    factorSetId: 'silver-factors',
    marketSnapshot: market,
    factors: [realRateFactor],
    evidenceRefs: ['factor-set-evidence'],
    provenanceHash: 'factor-set-proof',
  });
  const spread = factors.factors.find((factor) => factor.kind === 'SPREAD');
  assert.ok(spread);

  const regime = buildMetalRegime({
    regimeId: 'silver-regime',
    factorSet: factors,
    label: 'REAL_RATE_PRESSURE',
    confidence: 0.7,
    rationale: 'Research-only interpretation of real-rate and spread evidence.',
    sourceFactorIds: [realRateFactor.factorId],
    evidenceRefs: ['regime-evidence'],
    provenanceHash: 'regime-proof',
  });

  const forecast = buildMetalForecast({
    forecastId: 'silver-forecast',
    marketSnapshot: market,
    factorSet: factors,
    regime,
    issuedAt: '2026-09-20T15:01:00Z',
    targetAt: '2026-09-27T15:01:00Z',
    horizonLabel: '1W',
    modelId: 'metals-research',
    modelVersion: '1',
    scenarios: [
      { scenarioId: 'down', label: 'Down', probability: 0.35, expectedReturn: -0.03, maxReturnExclusive: 0 },
      { scenarioId: 'up', label: 'Up', probability: 0.65, expectedReturn: 0.04, minReturnInclusive: 0 },
    ],
    evidenceRefs: ['forecast-evidence'],
    provenanceHash: 'forecast-proof',
  });

  const risk = buildMetalRiskAssessment({
    riskAssessmentId: 'silver-risk',
    marketSnapshot: market,
    forecast,
    liquidityRisk: 'LOW',
    stressScenarios: [{
      stressId: 'usd-spike',
      label: 'USD spike',
      shockedReturn: -0.08,
      spreadShockBps: 25,
      rationale: 'Stress-only scenario.',
      evidenceRefs: ['stress-evidence'],
    }],
    evidenceRefs: ['risk-evidence'],
    provenanceHash: 'risk-proof',
  });

  const intelligence = buildMetalIntelligenceSnapshot({
    intelligenceId: 'silver-intel',
    accountId: 'research-account',
    requestedBy: 'tester',
    createdAt: '2026-09-20T15:02:00Z',
    factorSet: factors,
    regime,
    forecast,
    risk,
    provenanceHash: 'intel-proof',
  });

  assert.equal(intelligence.decisionCase.status, 'RESEARCH_ONLY');
  assert.equal(intelligence.assessment.authorityStatus, 'MISSING');
  assert.equal(intelligence.assessment.disposition, 'RESEARCH_ONLY');
  assert.equal(intelligence.financialAuthority, 'NONE');
  assert.throws(() => assertProposalEligible(intelligence.assessment), /MONEY_DECISION_NOT_PROPOSAL_ELIGIBLE/);
});

test('MONEY-METALS-02 rejects future factor evidence and malformed probability mass', () => {
  assert.throws(() => buildMetalFactorSet({
    factorSetId: 'future-factor-set',
    marketSnapshot: market,
    factors: [{ ...realRateFactor, informationCutoff: '2026-09-21T15:00:00Z' }],
    evidenceRefs: ['factor-set-evidence'],
    provenanceHash: 'factor-set-proof',
  }), /MONEY_METALS_FACTOR_FUTURE_INFORMATION/);

  const factors = buildMetalFactorSet({
    factorSetId: 'valid-factors',
    marketSnapshot: market,
    factors: [realRateFactor],
    evidenceRefs: ['factor-set-evidence'],
    provenanceHash: 'factor-set-proof',
  });
  const regime = buildMetalRegime({
    regimeId: 'valid-regime',
    factorSet: factors,
    label: 'MIXED',
    confidence: 0.5,
    rationale: 'Mixed research evidence.',
    sourceFactorIds: [realRateFactor.factorId],
    evidenceRefs: ['regime-evidence'],
    provenanceHash: 'regime-proof',
  });

  assert.throws(() => buildMetalForecast({
    forecastId: 'bad-mass',
    marketSnapshot: market,
    factorSet: factors,
    regime,
    issuedAt: '2026-09-20T15:01:00Z',
    targetAt: '2026-09-27T15:01:00Z',
    horizonLabel: '1W',
    modelId: 'metals-research',
    modelVersion: '1',
    scenarios: [
      { scenarioId: 'a', label: 'A', probability: 0.4, expectedReturn: -0.01 },
      { scenarioId: 'b', label: 'B', probability: 0.4, expectedReturn: 0.01 },
    ],
    evidenceRefs: ['forecast-evidence'],
    provenanceHash: 'forecast-proof',
  }), /MONEY_METALS_FORECAST_PROBABILITY_MASS_INVALID/);
});
