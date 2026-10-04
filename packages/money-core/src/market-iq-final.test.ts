import assert from 'node:assert/strict'
import test from 'node:test'
import type { IndependentProbabilityEstimate } from './prediction-market-intelligence.js'
import type { PredictionMarketSnapshot } from './prediction-market-reality.js'
import {
  buildPredictionMarketIqBridge,
} from './prediction-market-iq-bridge.js'
import {
  buildSportsMarketIqObservation,
  buildStockMarketIqObservation,
  buildCryptoMarketIqObservation,
  buildForexMarketIqObservation,
  buildPreciousMetalMarketIqObservation,
} from './market-iq-domain-bridge.js'
import { buildMarketIqMoneyRiskContext } from './market-iq-risk-interface.js'

const snapshot: PredictionMarketSnapshot = {
  schemaVersion: 'MONEY-PREDICTION-01',
  snapshotId: 'prediction:m1:2026-10-04T18:00:00.000Z',
  marketId: 'm1',
  instrumentId: 'instrument:prediction:m1',
  venue: 'venue-a',
  title: 'Will event happen?',
  contractKind: 'BINARY',
  status: 'OPEN',
  quoteCurrency: 'USD',
  settlementCurrency: 'USD',
  payoutAmount: 1,
  opensAt: '2026-10-01T00:00:00.000Z',
  closesAt: '2026-10-10T00:00:00.000Z',
  informationCutoff: '2026-10-04T18:00:00.000Z',
  derivedAt: '2026-10-04T18:00:00.000Z',
  outcomes: [
    {
      outcomeId: 'YES',
      label: 'Yes',
      bidProbability: 0.6,
      askProbability: 0.62,
      midpointProbability: 0.61,
      spreadProbability: 0.02,
      bidSize: 5000,
      askSize: 4000,
      quoteId: 'q1',
      evidenceRefs: ['e:q1'],
    },
    {
      outcomeId: 'NO',
      label: 'No',
      bidProbability: 0.38,
      askProbability: 0.4,
      midpointProbability: 0.39,
      spreadProbability: 0.02,
      bidSize: 4000,
      askSize: 5000,
      quoteId: 'q2',
      evidenceRefs: ['e:q2'],
    },
  ],
  midpointProbabilityMass: 1,
  completeSetArbitrage: 'NONE',
  resolution: {
    authorityId: 'resolver',
    ruleVersion: 'v1',
    canonicalRule: 'Official source resolves the event.',
    scheduledResolutionAt: '2026-10-11T00:00:00.000Z',
    voidTreatment: 'VENUE_RULES',
    evidenceRefs: ['e:rules'],
    provenanceHash: 'p:rules',
  },
  methodologyVersion: 'test-v1',
  sourceManifest: ['provider-a'],
  evidenceRefs: ['e:snapshot'],
  snapshotHash: 'p:snapshot',
  researchAuthority: 'INTELLIGENCE_ONLY',
  executionAuthority: 'NONE',
  financialAuthority: 'NONE',
}

const estimate: IndependentProbabilityEstimate = {
  estimateId: 'estimate:1',
  outcomeId: 'YES',
  probability: 0.7,
  modelId: 'jhadina-test',
  modelVersion: 'v1',
  issuedAt: '2026-10-04T17:59:00.000Z',
  availableAt: '2026-10-04T17:59:30.000Z',
  informationCutoff: '2026-10-04T17:59:30.000Z',
  calibrationStatus: 'PROVISIONAL',
  evidenceRefs: ['e:model'],
  evidenceSnapshotHash: 'p:model-evidence',
  provenanceHash: 'p:model',
  financialAuthority: 'NONE',
}

test('MARKET-IQ.14 prediction bridge stays intelligence-only', () => {
  const bridged = buildPredictionMarketIqBridge({
    snapshot,
    estimate,
    costs: [
      { kind: 'FEES', amount: 0.005, evidenceRefs: ['e:fee'] },
      { kind: 'SLIPPAGE', amount: 0.01, evidenceRefs: ['e:slippage'] },
    ],
  })
  assert.equal(bridged.authority, 'INTELLIGENCE_ONLY')
  assert.equal(bridged.financialAuthority, 'NONE')
  assert.equal(bridged.canAuthorizeTrade, false)
  assert.equal(bridged.canExecute, false)
  assert.equal(bridged.priceTruth.rawDivergence, 0.09)
  assert.ok(bridged.executableEdge.netEdge > 0)
})

test('MARKET-IQ.15 money domains share observation primitives without sharing calibration', () => {
  const base = {
    observationId: 'obs:shared',
    subjectId: 'subject:1',
    venue: 'venue-a',
    valueKind: 'PRICE' as const,
    observedValue: 100,
    observedAt: '2026-10-04T18:00:00.000Z',
    availableAt: '2026-10-04T18:00:00.000Z',
    informationCutoff: '2026-10-04T18:00:00.000Z',
    evidenceRefs: ['e:1'],
    provenanceHash: 'p:1',
  }
  const sports = buildSportsMarketIqObservation({ ...base, valueKind: 'PROBABILITY', observedValue: 0.6 })
  const stock = buildStockMarketIqObservation(base)
  const crypto = buildCryptoMarketIqObservation(base)
  const forex = buildForexMarketIqObservation(base)
  const metal = buildPreciousMetalMarketIqObservation(base)
  assert.deepEqual(
    [sports.domain, stock.domain, crypto.domain, forex.domain, metal.domain],
    ['SPORTS', 'STOCK', 'CRYPTO', 'FOREX', 'PRECIOUS_METAL'],
  )
  for (const item of [sports, stock, crypto, forex, metal]) {
    assert.equal(item.canAuthorizeCapital, false)
    assert.equal(item.canExecute, false)
  }
})

test('MARKET-IQ.16 risk interface cannot authorize money', () => {
  const bridged = buildPredictionMarketIqBridge({ snapshot, estimate, costs: [] })
  const risk = buildMarketIqMoneyRiskContext({
    subjectId: 'm1:YES',
    evaluatedAt: '2026-10-04T18:01:00.000Z',
    policy: { minimumNetEdge: 0.02, maximumTruthContradictionRisk: 0.2, minimumTruthCoverage: 1 },
    executableEdge: bridged.executableEdge,
    truth: bridged.truth,
  })
  assert.equal(risk.riskState, 'CLEAR')
  assert.equal(risk.financialAuthority, 'NONE')
  assert.equal(risk.canAuthorizeCapital, false)
  assert.equal(risk.canAuthorizeTrade, false)
  assert.equal(risk.canExecute, false)
})
