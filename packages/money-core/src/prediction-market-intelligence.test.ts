import test from 'node:test';
import assert from 'node:assert/strict';
import { assertProposalEligible } from './decision-workflow-contracts.js';
import type { CanonicalInstrument } from './market-instrument-contracts.js';
import {
  buildPredictionMarketSnapshot,
  type PredictionMarketDefinition,
  type PredictionMarketResolution,
} from './prediction-market-reality.js';
import {
  buildPredictionMarketFactors,
  buildPredictionMarketIntelligenceSnapshot,
  buildPredictionMarketResearchView,
  buildPredictionMarketRiskAssessment,
  scorePredictionMarketEstimate,
  type IndependentProbabilityEstimate,
} from './prediction-market-intelligence.js';

const instrument: CanonicalInstrument = {
  instrumentId: 'prediction:test:election-like-event',
  assetClass: 'PREDICTION',
  instrumentType: 'EVENT_CONTRACT',
  venue: 'TEST_VENUE',
  identifiers: ['TEST:EVENT'],
  quoteCurrency: 'USD',
  settlementCurrency: 'USD',
  status: 'ACTIVE',
  provenanceHash: 'instrument-proof',
};

const definition: PredictionMarketDefinition = {
  definitionId: 'event-definition',
  marketId: 'event-market',
  instrumentId: instrument.instrumentId,
  venue: instrument.venue,
  title: 'Will the defined event occur?',
  contractKind: 'BINARY',
  quoteCurrency: 'USD',
  settlementCurrency: 'USD',
  payoutAmount: 1,
  opensAt: '2026-09-01T00:00:00Z',
  closesAt: '2026-09-30T00:00:00Z',
  outcomes: [
    { outcomeId: 'YES', label: 'Yes', evidenceRefs: ['yes-definition'] },
    { outcomeId: 'NO', label: 'No', evidenceRefs: ['no-definition'] },
  ],
  resolution: {
    authorityId: 'official-authority',
    ruleVersion: '1',
    canonicalRule: 'Resolve from the official authority under the published rule.',
    scheduledResolutionAt: '2026-10-01T00:00:00Z',
    voidTreatment: 'REFUND',
    evidenceRefs: ['resolution-rule'],
    provenanceHash: 'resolution-rule-proof',
  },
  evidenceRefs: ['definition-evidence'],
  provenanceHash: 'definition-proof',
};

const snapshot = buildPredictionMarketSnapshot({
  instrument,
  definition,
  status: 'OPEN',
  quotes: [
    {
      quoteId: 'yes-quote',
      marketId: definition.marketId,
      outcomeId: 'YES',
      bidProbability: 0.44,
      askProbability: 0.46,
      bidSize: 200,
      askSize: 220,
      observedAt: '2026-09-20T14:00:00Z',
      availableAt: '2026-09-20T14:00:01Z',
      receivedAt: '2026-09-20T14:00:02Z',
      provider: 'reference',
      evidenceRefs: ['yes-quote-evidence'],
      provenanceHash: 'yes-quote-proof',
    },
    {
      quoteId: 'no-quote',
      marketId: definition.marketId,
      outcomeId: 'NO',
      bidProbability: 0.54,
      askProbability: 0.56,
      bidSize: 210,
      askSize: 230,
      observedAt: '2026-09-20T14:00:00Z',
      availableAt: '2026-09-20T14:00:01Z',
      receivedAt: '2026-09-20T14:00:02Z',
      provider: 'reference',
      evidenceRefs: ['no-quote-evidence'],
      provenanceHash: 'no-quote-proof',
    },
  ],
  informationCutoff: '2026-09-20T15:00:00Z',
  derivedAt: '2026-09-20T15:00:01Z',
  methodologyVersion: 'prediction-reality-v1',
  sourceManifest: ['provider:reference'],
  snapshotHash: 'snapshot-proof',
});

const estimate: IndependentProbabilityEstimate = {
  estimateId: 'estimate-yes',
  outcomeId: 'YES',
  probability: 0.52,
  modelId: 'independent-model',
  modelVersion: '1',
  issuedAt: '2026-09-20T14:30:00Z',
  availableAt: '2026-09-20T14:30:01Z',
  informationCutoff: '2026-09-20T14:29:59Z',
  calibrationStatus: 'PROVISIONAL',
  evidenceRefs: ['independent-evidence'],
  evidenceSnapshotHash: 'independent-snapshot-hash',
  provenanceHash: 'estimate-proof',
  financialAuthority: 'NONE',
};

test('MONEY-PREDICTION-02 preserves research-only authority across the complete intelligence path', () => {
  const factors = buildPredictionMarketFactors({
    snapshot,
    outcomeId: 'YES',
    independentEstimate: estimate,
    additionalFactors: [{
      factorId: 'resolution-risk-factor',
      kind: 'RESOLUTION_RISK',
      outcomeId: 'YES',
      value: 0.2,
      unit: 'SCORE',
      informationCutoff: snapshot.informationCutoff,
      sourceSnapshotIds: [snapshot.snapshotId],
      evidenceRefs: ['resolution-risk-evidence'],
      methodologyVersion: 'resolution-risk-v1',
      provenanceHash: 'resolution-risk-proof',
    }],
  });

  const view = buildPredictionMarketResearchView({
    viewId: 'view-yes',
    snapshot,
    estimate,
    confidence: 0.7,
    rationale: 'Independent estimate exceeds the point-in-time market midpoint; research only.',
    evidenceRefs: ['view-evidence'],
    provenanceHash: 'view-proof',
  });
  assert.equal(view.marketMidpointProbability, 0.45);
  assert.equal(view.divergence, 0.07);
  assert.equal(view.financialAuthority, 'NONE');

  const risk = buildPredictionMarketRiskAssessment({
    riskAssessmentId: 'risk-yes',
    snapshot,
    outcomeId: 'YES',
    liquidityRisk: 'LOW',
    resolutionRisk: 'MEDIUM',
    reasons: ['Explicit resolution authority and rule exist, but event-contract resolution still carries interpretation risk.'],
    evidenceRefs: ['risk-evidence'],
    provenanceHash: 'risk-proof',
  });

  const intelligence = buildPredictionMarketIntelligenceSnapshot({
    intelligenceId: 'intel-yes',
    accountId: 'research-account',
    requestedBy: 'tester',
    createdAt: '2026-09-20T15:01:00Z',
    snapshot,
    estimate,
    factors,
    view,
    risk,
    provenanceHash: 'intelligence-proof',
  });

  assert.equal(intelligence.decisionCase.status, 'RESEARCH_ONLY');
  assert.equal(intelligence.assessment.authorityStatus, 'MISSING');
  assert.equal(intelligence.assessment.disposition, 'RESEARCH_ONLY');
  assert.equal(intelligence.financialAuthority, 'NONE');
  assert.throws(() => assertProposalEligible(intelligence.assessment), /MONEY_DECISION_NOT_PROPOSAL_ELIGIBLE/);
});

test('MONEY-PREDICTION-02 rejects future independent evidence and broken factor lineage', () => {
  assert.throws(() => buildPredictionMarketFactors({
    snapshot,
    outcomeId: 'YES',
    independentEstimate: {
      ...estimate,
      availableAt: '2026-09-21T00:00:00Z',
    },
  }), /MONEY_PREDICTION_ESTIMATE_FUTURE_INFORMATION/);

  assert.throws(() => buildPredictionMarketFactors({
    snapshot,
    outcomeId: 'YES',
    independentEstimate: estimate,
    additionalFactors: [{
      factorId: 'bad-lineage',
      kind: 'EVENT',
      outcomeId: 'YES',
      value: 1,
      unit: 'FLAG',
      informationCutoff: snapshot.informationCutoff,
      sourceSnapshotIds: ['some-other-snapshot'],
      evidenceRefs: ['bad-lineage-evidence'],
      methodologyVersion: '1',
      provenanceHash: 'bad-lineage-proof',
    }],
  }), /MONEY_PREDICTION_FACTOR_SNAPSHOT_LINEAGE_INVALID/);
});

test('MONEY-PREDICTION-02 calibration learns from final resolution without creating authority', () => {
  const resolution: PredictionMarketResolution = {
    resolutionId: 'final-resolution',
    marketId: definition.marketId,
    instrumentId: definition.instrumentId,
    outcomeId: 'YES',
    status: 'FINAL',
    resolvedAt: '2026-10-01T01:00:00Z',
    availableAt: '2026-10-01T01:00:01Z',
    authorityId: definition.resolution.authorityId,
    ruleVersion: definition.resolution.ruleVersion,
    evidenceRefs: ['official-final-result'],
    provenanceHash: 'final-resolution-proof',
  };

  const score = scorePredictionMarketEstimate({
    calibrationId: 'calibration-1',
    estimate,
    resolution,
    scoredAt: '2026-10-01T01:01:00Z',
    evidenceRefs: ['calibration-evidence'],
    provenanceHash: 'calibration-proof',
  });

  assert.equal(score.outcome, 1);
  assert.equal(score.score, (0.52 - 1) ** 2);
  assert.equal(score.authority, 'LEARNING_ONLY');
});

test('MONEY-PREDICTION-02 refuses to score unresolved or premature outcomes', () => {
  assert.throws(() => scorePredictionMarketEstimate({
    calibrationId: 'calibration-pending',
    estimate,
    resolution: {
      resolutionId: 'pending',
      marketId: definition.marketId,
      instrumentId: definition.instrumentId,
      status: 'PENDING',
      resolvedAt: '2026-10-01T01:00:00Z',
      availableAt: '2026-10-01T01:00:01Z',
      authorityId: definition.resolution.authorityId,
      ruleVersion: definition.resolution.ruleVersion,
      evidenceRefs: ['pending-evidence'],
      provenanceHash: 'pending-proof',
    },
    scoredAt: '2026-10-01T01:01:00Z',
    evidenceRefs: ['calibration-evidence'],
    provenanceHash: 'calibration-proof',
  }), /MONEY_PREDICTION_CALIBRATION_FINAL_RESOLUTION_REQUIRED/);
});
