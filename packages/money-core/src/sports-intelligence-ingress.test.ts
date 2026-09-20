import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertProposalEligible } from './decision-workflow-contracts.js';
import {
  assertSportsMoneyResearchOnly,
  assertSportsPredictionResearchIngress,
  ingestSportsPredictionResearch,
  type SportsPredictionTransportEnvelope,
} from './sports-intelligence-ingress.js';

function envelope(): SportsPredictionTransportEnvelope {
  return {
    schemaVersion: 'SPORT-PRED-01',
    envelopeId: 'sport-pred:tennis:1',
    sport: 'tennis',
    subject: { subjectId: 'match:1', kind: 'match' },
    informationCutoff: '2026-09-19T20:00:00Z',
    issuedAt: '2026-09-19T20:01:00Z',
    model: {
      modelId: 'tennis-baseline',
      modelVersion: '1.0.0',
      methodologyVersion: '1',
      featureSnapshotHash: 'feature-hash',
    },
    distribution: {
      outcomes: [
        { outcomeId: 'p1', label: 'Player 1', probability: 0.55 },
        { outcomeId: 'p2', label: 'Player 2', probability: 0.45 },
      ],
    },
    calibration: {
      status: 'CALIBRATED',
      sampleSize: 250,
      brierScore: 0.18,
    },
    uncertainty: {
      aleatoric: 0.3,
      epistemic: 0.2,
      overall: 0.25,
    },
    resolution: {
      type: 'BINARY',
      authority: 'official-result-feed',
      ruleVersion: '1',
    },
    evidenceRefs: [
      {
        evidenceId: 'sports:e1',
        sourceType: 'official_feed',
        observedAt: '2026-09-19T19:59:00Z',
      },
    ],
    provenance: {
      inputSnapshotHash: 'input-hash',
      evidenceSnapshotHash: 'evidence-hash',
      generatedBy: 'sports-prediction-core',
    },
    allowedUses: ['ANALYSIS', 'MONEY_RESEARCH_INPUT'],
    authority: {
      decision: 'INTELLIGENCE_ONLY',
      coachingExecution: 'NONE',
      bettingExecution: 'NONE',
      financialExecution: 'NONE',
    },
  };
}

const context = {
  accountId: 'research-account',
  requestedBy: 'sports-intelligence-bridge',
  receivedAt: '2026-09-19T20:02:00Z',
  sourceNamespace: 'coaching-ai',
  evidenceQuality: 'SUPPORTED' as const,
};

test('SPORT-MONEY-01 ingests sports predictions as research only', () => {
  const artifact = ingestSportsPredictionResearch(envelope(), context);
  assert.equal(artifact.bridgeVersion, 'SPORT-MONEY-01');
  assert.equal(artifact.decisionCase.status, 'RESEARCH_ONLY');
  assert.equal(artifact.assessment.disposition, 'RESEARCH_ONLY');
  assert.equal(artifact.assessment.authorityStatus, 'MISSING');
  assert.equal(artifact.bettingAuthority, 'NONE');
  assert.equal(artifact.financialAuthority, 'NONE');
  assert.equal(artifact.evidence[0]?.sourceId, 'coaching-ai:official_feed');
  assertSportsMoneyResearchOnly(artifact);
});

test('sports research ingress can never satisfy proposal eligibility by itself', () => {
  const artifact = ingestSportsPredictionResearch(envelope(), context);
  assert.throws(
    () => assertProposalEligible(artifact.assessment),
    /NOT_PROPOSAL_ELIGIBLE/,
  );
});

test('rejects envelopes that do not grant Money research use', () => {
  const input = { ...envelope(), allowedUses: ['ANALYSIS'] };
  assert.throws(
    () => assertSportsPredictionResearchIngress(input, context),
    /RESEARCH_USE_NOT_ALLOWED/,
  );
});

test('rejects any claimed betting or financial execution authority', () => {
  const input = {
    ...envelope(),
    authority: {
      ...envelope().authority,
      financialExecution: 'BROKER' as never,
    },
  };
  assert.throws(
    () => assertSportsPredictionResearchIngress(input, context),
    /EXECUTION_AUTHORITY_FORBIDDEN/,
  );
});

test('rejects unsupported Sports Prediction schema versions', () => {
  const input = {
    ...envelope(),
    schemaVersion: 'SPORT-PRED-99' as never,
  };
  assert.throws(
    () => assertSportsPredictionResearchIngress(input, context),
    /SCHEMA_VERSION_UNSUPPORTED/,
  );
});

test('rejects evidence that appeared after the prediction information cutoff', () => {
  const original = envelope();
  const input = {
    ...original,
    evidenceRefs: [
      {
        ...original.evidenceRefs[0]!,
        observedAt: '2026-09-19T20:00:01Z',
      },
    ],
  };
  assert.throws(
    () => assertSportsPredictionResearchIngress(input, context),
    /EVIDENCE_AFTER_INFORMATION_CUTOFF/,
  );
});

test('rejects transport arrival timestamps that predate issuance', () => {
  assert.throws(
    () =>
      assertSportsPredictionResearchIngress(envelope(), {
        ...context,
        receivedAt: '2026-09-19T19:00:00Z',
      }),
    /RECEIVED_BEFORE_ISSUED/,
  );
});
