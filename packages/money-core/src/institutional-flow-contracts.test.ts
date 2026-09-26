import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INSTITUTIONAL_FLOW_SCHEMA_VERSION,
  assertInstitutionalFlowObservation,
  assertInstitutionalPatternNonExecutable,
  buildInstitutionalBehaviorPattern,
  createInstitutionalBehaviorExample,
  createInstitutionalFlowClaim,
  type InstitutionalFlowObservation,
} from './institutional-flow-contracts.js';

function directObservation(
  overrides: Partial<InstitutionalFlowObservation> = {},
): InstitutionalFlowObservation {
  return {
    schemaVersion: INSTITUTIONAL_FLOW_SCHEMA_VERSION,
    observationId: 'flow:1',
    instrumentId: 'fx:EURUSD',
    market: 'FOREX',
    sourceKind: 'DIRECT_PARTICIPANT_CLASSIFIED',
    sourceGroup: 'participant-feed-a',
    actorName: 'Example Bank',
    actorConfidence: 'NAMED_VERIFIED',
    side: 'BUY',
    notionalAmount: 200_000_000,
    notionalCurrency: 'USD',
    effectiveAt: '2026-09-26T20:00:00Z',
    observedAt: '2026-09-26T20:00:01Z',
    receivedAt: '2026-09-26T20:00:02Z',
    availableAt: '2026-09-26T20:00:03Z',
    evidenceIds: ['feed:event:1'],
    provenanceHash: 'flow-proof-1',
    status: 'OBSERVED',
    authority: 'EVIDENCE_ONLY',
    ...overrides,
  };
}

test('MONEY-INSTITUTIONAL-FLOW-01 permits named actors only from directly participant-classified evidence', () => {
  assert.doesNotThrow(() => assertInstitutionalFlowObservation(directObservation()));

  assert.throws(
    () =>
      assertInstitutionalFlowObservation(
        directObservation({
          sourceKind: 'VENDOR_ASSERTION',
          status: 'ASSERTED_ONLY',
        }),
      ),
    /MONEY_INSTITUTIONAL_FLOW_NAMED_ACTOR_UNVERIFIED/,
  );

  assert.throws(
    () =>
      assertInstitutionalFlowObservation(
        directObservation({
          sourceKind: 'PUBLIC_REPORT',
          actorConfidence: 'INFERRED',
        }),
      ),
    /MONEY_INSTITUTIONAL_FLOW_NAMED_ACTOR_UNVERIFIED/,
  );
});

test('MONEY-INSTITUTIONAL-FLOW-01 allows actor-agnostic aggregate positioning observations', () => {
  const aggregate = directObservation({
    observationId: 'flow:aggregate',
    sourceKind: 'REGULATORY_AGGREGATE',
    sourceGroup: 'cftc',
    actorName: undefined,
    actorConfidence: 'SECTOR_AGGREGATE',
    notionalAmount: undefined,
    notionalCurrency: undefined,
    positionChangeFraction: 0.12,
    status: 'OBSERVED',
  });

  assert.doesNotThrow(() => assertInstitutionalFlowObservation(aggregate));
});

test('MONEY-INSTITUTIONAL-FLOW-01 records flashy vendor claims as assertions with zero authority', () => {
  const claim = createInstitutionalFlowClaim({
    claimId: 'claim:jpm-200m',
    statement: 'Vendor asserts a named bank placed a 200M EUR/USD position.',
    claimedActorName: 'JP Morgan',
    claimedNotionalAmount: 200_000_000,
    claimedNotionalCurrency: 'USD',
    claimedParticipantCount: 300,
    claimedDataCostPerYear: 2_000_000,
    sourceEvidenceIds: ['source:institutional-flow-transcript'],
  });

  assert.equal(claim.status, 'SOURCE_ASSERTION');
  assert.equal(claim.authority, 'NONE');
});

test('MONEY-INSTITUTIONAL-FLOW-01 prevents future information from entering imitation features', () => {
  const observation = directObservation();

  assert.throws(
    () =>
      createInstitutionalBehaviorExample(observation, {
        exampleId: 'example:future-leak',
        featureCutoff: '2026-09-26T20:00:02Z',
        conditionIds: ['condition:technical-level'],
        evidenceIds: ['feature-set:1'],
      }),
    /MONEY_INSTITUTIONAL_FEATURE_FUTURE_LEAK/,
  );
});

test('MONEY-INSTITUTIONAL-FLOW-01 refuses to learn directly from asserted-only vendor flow', () => {
  const asserted = directObservation({
    actorName: undefined,
    actorConfidence: 'UNKNOWN',
    sourceKind: 'VENDOR_ASSERTION',
    status: 'ASSERTED_ONLY',
  });

  assert.throws(
    () =>
      createInstitutionalBehaviorExample(asserted, {
        exampleId: 'example:asserted',
        featureCutoff: '2026-09-26T20:00:00Z',
        conditionIds: ['condition:pre-news'],
        evidenceIds: ['feature-set:2'],
      }),
    /MONEY_INSTITUTIONAL_EXAMPLE_SOURCE_NOT_LEARNABLE/,
  );
});

test('MONEY-INSTITUTIONAL-FLOW-01 builds a multi-source replay pattern without granting execution authority', () => {
  const first = directObservation({
    observationId: 'flow:a',
    sourceGroup: 'participant-feed-a',
  });
  const second = directObservation({
    observationId: 'flow:b',
    sourceGroup: 'participant-feed-b',
    actorName: 'Example Bank B',
    evidenceIds: ['feed:event:2'],
    provenanceHash: 'flow-proof-2',
    observedAt: '2026-09-26T20:01:01Z',
    receivedAt: '2026-09-26T20:01:02Z',
    availableAt: '2026-09-26T20:01:03Z',
  });

  const examples = [
    createInstitutionalBehaviorExample(first, {
      exampleId: 'example:a',
      featureCutoff: '2026-09-26T20:00:00Z',
      conditionIds: ['condition:dip-buy'],
      outcomeAvailableAt: '2026-09-26T21:00:00Z',
      outcomeLabel: 'MATCHED',
      evidenceIds: ['outcome:a'],
    }),
    createInstitutionalBehaviorExample(second, {
      exampleId: 'example:b',
      featureCutoff: '2026-09-26T20:01:00Z',
      conditionIds: ['condition:dip-buy'],
      outcomeAvailableAt: '2026-09-26T21:01:00Z',
      outcomeLabel: 'MATCHED',
      evidenceIds: ['outcome:b'],
    }),
  ];

  const pattern = buildInstitutionalBehaviorPattern({
    patternId: 'pattern:dip-buy',
    instrumentId: 'fx:EURUSD',
    examples,
    observationById: new Map([
      [first.observationId, first],
      [second.observationId, second],
    ]),
    minimumSamples: 2,
    methodologyVersion: 'institutional-flow-v1',
    evidenceIds: ['pattern-evidence:1'],
    provenanceHash: 'pattern-proof',
  });

  assert.equal(pattern.sampleSize, 2);
  assert.equal(pattern.independentSourceGroupCount, 2);
  assert.equal(pattern.dominantAction, 'BUY');
  assert.equal(pattern.dominantActionRateBps, 10_000);
  assert.equal(pattern.forwardOutcomeHitRateBps, 10_000);
  assert.equal(pattern.calibrationStatus, 'REPLAY_SUPPORTED');
  assert.equal(pattern.canAuthorizeTrade, false);
  assert.doesNotThrow(() => assertInstitutionalPatternNonExecutable(pattern));
});
