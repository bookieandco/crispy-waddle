import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalInstrument } from './market-instrument-contracts.js';
import {
  assertPredictionMarketResolution,
  buildPredictionMarketSnapshot,
  type PredictionMarketDefinition,
  type PredictionOutcomeQuote,
} from './prediction-market-reality.js';

const instrument: CanonicalInstrument = {
  instrumentId: 'prediction:venue:weather-2026',
  assetClass: 'PREDICTION',
  instrumentType: 'EVENT_CONTRACT',
  venue: 'TEST_VENUE',
  identifiers: ['TEST:WEATHER-2026'],
  quoteCurrency: 'USD',
  settlementCurrency: 'USD',
  status: 'ACTIVE',
  provenanceHash: 'instrument-proof',
};

const definition: PredictionMarketDefinition = {
  definitionId: 'weather-2026-definition',
  marketId: 'weather-2026',
  instrumentId: instrument.instrumentId,
  venue: instrument.venue,
  title: 'Will the event occur?',
  contractKind: 'BINARY',
  quoteCurrency: 'USD',
  settlementCurrency: 'USD',
  payoutAmount: 1,
  opensAt: '2026-09-01T00:00:00Z',
  closesAt: '2026-09-30T00:00:00Z',
  outcomes: [
    { outcomeId: 'YES', label: 'Yes', evidenceRefs: ['outcome:yes'] },
    { outcomeId: 'NO', label: 'No', evidenceRefs: ['outcome:no'] },
  ],
  resolution: {
    authorityId: 'official-authority',
    ruleVersion: '1',
    canonicalRule: 'Resolve YES only if the official authority publishes the defined event before the deadline.',
    scheduledResolutionAt: '2026-10-01T00:00:00Z',
    disputeWindowEndsAt: '2026-10-02T00:00:00Z',
    voidTreatment: 'REFUND',
    evidenceRefs: ['resolution-rules'],
    provenanceHash: 'resolution-proof',
  },
  evidenceRefs: ['definition-evidence'],
  provenanceHash: 'definition-proof',
};

function quote(
  outcomeId: 'YES' | 'NO',
  bidProbability: number,
  askProbability: number,
  overrides: Partial<PredictionOutcomeQuote> = {},
): PredictionOutcomeQuote {
  return {
    quoteId: `q:${outcomeId}`,
    marketId: definition.marketId,
    outcomeId,
    bidProbability,
    askProbability,
    bidSize: 100,
    askSize: 120,
    observedAt: '2026-09-20T14:00:00Z',
    availableAt: '2026-09-20T14:00:01Z',
    receivedAt: '2026-09-20T14:00:02Z',
    provider: 'reference',
    evidenceRefs: [`quote:${outcomeId}`],
    provenanceHash: `quote-proof:${outcomeId}`,
    ...overrides,
  };
}

test('MONEY-PREDICTION-01 builds a point-in-time, non-executable market snapshot', () => {
  const snapshot = buildPredictionMarketSnapshot({
    instrument,
    definition,
    status: 'OPEN',
    quotes: [
      quote('YES', 0.41, 0.43),
      quote('NO', 0.57, 0.59),
      quote('YES', 0.9, 0.92, {
        quoteId: 'future-yes',
        observedAt: '2026-09-21T14:00:00Z',
        availableAt: '2026-09-21T14:00:01Z',
        receivedAt: '2026-09-21T14:00:02Z',
      }),
    ],
    informationCutoff: '2026-09-20T15:00:00Z',
    derivedAt: '2026-09-20T15:00:01Z',
    methodologyVersion: 'prediction-reality-v1',
    sourceManifest: ['provider:reference'],
    snapshotHash: 'snapshot-proof',
  });

  assert.equal(snapshot.outcomes.find((outcome) => outcome.outcomeId === 'YES')?.quoteId, 'q:YES');
  assert.equal(snapshot.midpointProbabilityMass, 1);
  assert.equal(snapshot.completeSetArbitrage, 'NONE');
  assert.equal(snapshot.researchAuthority, 'INTELLIGENCE_ONLY');
  assert.equal(snapshot.executionAuthority, 'NONE');
  assert.equal(snapshot.financialAuthority, 'NONE');
});

test('MONEY-PREDICTION-01 records complete-set arbitrage instead of hiding it', () => {
  const snapshot = buildPredictionMarketSnapshot({
    instrument,
    definition,
    status: 'OPEN',
    quotes: [quote('YES', 0.2, 0.3), quote('NO', 0.3, 0.4)],
    informationCutoff: '2026-09-20T15:00:00Z',
    derivedAt: '2026-09-20T15:00:01Z',
    methodologyVersion: 'prediction-reality-v1',
    sourceManifest: ['provider:reference'],
    snapshotHash: 'snapshot-proof',
  });
  assert.equal(snapshot.completeSetArbitrage, 'BUY_ALL');
});

test('MONEY-PREDICTION-01 fails closed on crossed quotes, missing outcomes and malformed binary terms', () => {
  assert.throws(() => buildPredictionMarketSnapshot({
    instrument,
    definition,
    status: 'OPEN',
    quotes: [quote('YES', 0.6, 0.5), quote('NO', 0.4, 0.5)],
    informationCutoff: '2026-09-20T15:00:00Z',
    derivedAt: '2026-09-20T15:00:01Z',
    methodologyVersion: 'prediction-reality-v1',
    sourceManifest: ['provider:reference'],
    snapshotHash: 'snapshot-proof',
  }), /MONEY_PREDICTION_CROSSED_QUOTE/);

  assert.throws(() => buildPredictionMarketSnapshot({
    instrument,
    definition,
    status: 'OPEN',
    quotes: [quote('YES', 0.4, 0.5)],
    informationCutoff: '2026-09-20T15:00:00Z',
    derivedAt: '2026-09-20T15:00:01Z',
    methodologyVersion: 'prediction-reality-v1',
    sourceManifest: ['provider:reference'],
    snapshotHash: 'snapshot-proof',
  }), /MONEY_PREDICTION_OUTCOME_QUOTE_REQUIRED_AT_CUTOFF/);

  assert.throws(() => buildPredictionMarketSnapshot({
    instrument,
    definition: {
      ...definition,
      outcomes: [...definition.outcomes, { outcomeId: 'MAYBE', label: 'Maybe', evidenceRefs: ['maybe'] }],
    },
    status: 'OPEN',
    quotes: [],
    informationCutoff: '2026-09-20T15:00:00Z',
    derivedAt: '2026-09-20T15:00:01Z',
    methodologyVersion: 'prediction-reality-v1',
    sourceManifest: ['provider:reference'],
    snapshotHash: 'snapshot-proof',
  }), /MONEY_PREDICTION_BINARY_OUTCOME_COUNT_INVALID/);
});

test('MONEY-PREDICTION-01 binds final resolution to the declared authority and rule', () => {
  assert.doesNotThrow(() => assertPredictionMarketResolution({
    definition,
    instrument,
    resolution: {
      resolutionId: 'r1',
      marketId: definition.marketId,
      instrumentId: definition.instrumentId,
      outcomeId: 'YES',
      status: 'FINAL',
      resolvedAt: '2026-10-01T01:00:00Z',
      availableAt: '2026-10-01T01:00:01Z',
      authorityId: definition.resolution.authorityId,
      ruleVersion: definition.resolution.ruleVersion,
      evidenceRefs: ['official-result'],
      provenanceHash: 'resolution-final-proof',
    },
  }));

  assert.throws(() => assertPredictionMarketResolution({
    definition,
    instrument,
    resolution: {
      resolutionId: 'r2',
      marketId: definition.marketId,
      instrumentId: definition.instrumentId,
      outcomeId: 'YES',
      status: 'FINAL',
      resolvedAt: '2026-10-01T01:00:00Z',
      availableAt: '2026-10-01T01:00:01Z',
      authorityId: 'social-post',
      ruleVersion: definition.resolution.ruleVersion,
      evidenceRefs: ['unofficial'],
      provenanceHash: 'bad-proof',
    },
  }), /MONEY_PREDICTION_FINAL_AUTHORITY_MISMATCH/);
});
