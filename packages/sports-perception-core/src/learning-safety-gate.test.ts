import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LearningCandidate } from './prediction-learning.js';
import { assertNoDirectFinancialExecutionPath, auditLearningCandidate, auditValidatedLearning } from './learning-safety-gate.js';
import { ValidatedLearningStore } from './validated-learning-store.js';

const candidate: LearningCandidate = {
  candidateId: 'learn:1',
  predictionId: 'p1',
  gameId: 'g1',
  target: 'PLAYER_STATE',
  parameterPath: 'player.state',
  proposedDelta: -0.04,
  boundedDelta: -0.04,
  evidenceIds: ['e1'],
  attributionKind: 'PLAYER_STATE',
  attributionConfidence: 0.9,
  realityStateVersion: 3,
  realityStateHash: 'state-3',
  modelVersion: 'm1',
  calibrationVersion: 'c1',
  featureSetVersion: 'f1',
  disposition: 'PROPOSED',
  rationale: 'test',
};

describe('B-70 learning safety gate', () => {
  it('requires repeated validation before learning becomes eligible', () => {
    const store = new ValidatedLearningStore();
    store.propose(candidate);
    store.validate({ validationId: 'v1', candidateId: candidate.candidateId, observedAt: '2026-09-20T12:00:00.000Z', evidenceIds: ['e2'], supportsCandidate: true, realityStateHash: 'game-1' });
    assert.equal(store.record(candidate.candidateId).disposition, 'PROPOSED');
    store.validate({ validationId: 'v2', candidateId: candidate.candidateId, observedAt: '2026-09-21T12:00:00.000Z', evidenceIds: ['e3'], supportsCandidate: true, realityStateHash: 'game-2' });
    assert.equal(store.record(candidate.candidateId).disposition, 'VALIDATED');
  });

  it('preserves bounded updates and provenance', () => {
    assert.equal(auditLearningCandidate(candidate).passed, true);
    const store = new ValidatedLearningStore();
    store.propose(candidate);
    store.validate({ validationId: 'v1', candidateId: candidate.candidateId, observedAt: '2026-09-20T12:00:00.000Z', evidenceIds: ['e2'], supportsCandidate: true, realityStateHash: 'game-1' });
    store.validate({ validationId: 'v2', candidateId: candidate.candidateId, observedAt: '2026-09-21T12:00:00.000Z', evidenceIds: ['e3'], supportsCandidate: true, realityStateHash: 'game-2' });
    assert.equal(auditValidatedLearning(store.record(candidate.candidateId)).passed, true);
  });

  it('blocks direct dependencies on financial execution', () => {
    assert.doesNotThrow(() => assertNoDirectFinancialExecutionPath(['sports-perception-core', 'simulation']));
    assert.throws(() => assertNoDirectFinancialExecutionPath(['sports-perception-core', 'money-core']));
  });
});
