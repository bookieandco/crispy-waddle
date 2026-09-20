import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LearningCandidate } from './prediction-learning.js';
import { certifyLearningReplay } from './learning-replay-certification.js';

const candidate: LearningCandidate = {
  candidateId: 'learn:cert',
  predictionId: 'prediction:1',
  gameId: 'game:1',
  target: 'PLAYER_STATE',
  parameterPath: 'player.state',
  proposedDelta: -0.04,
  boundedDelta: -0.04,
  evidenceIds: ['prediction-evidence'],
  attributionKind: 'PLAYER_STATE',
  attributionConfidence: 0.9,
  realityStateVersion: 2,
  realityStateHash: 'prediction-reality-v2',
  modelVersion: 'model-v1',
  calibrationVersion: 'cal-v1',
  featureSetVersion: 'features-v1',
  disposition: 'PROPOSED',
  rationale: 'certification fixture',
};

describe('B-70.13.56 learning replay certification', () => {
  it('certifies deterministic, bounded, lineage-preserving learning replay', () => {
    const result = certifyLearningReplay({
      candidate,
      validations: [
        { validationId: 'v1', candidateId: candidate.candidateId, observedAt: '2026-09-20T12:00:00.000Z', evidenceIds: ['e1'], supportsCandidate: true, realityStateVersion: 3, realityStateHash: 'game-a' },
        { validationId: 'v2', candidateId: candidate.candidateId, observedAt: '2026-09-21T12:00:00.000Z', evidenceIds: ['e2'], supportsCandidate: true, realityStateVersion: 4, realityStateHash: 'game-b' },
      ],
    });
    assert.equal(result.passed, true);
    assert.equal(result.deterministicReplay, true);
    assert.equal(result.temporalIntegrity, true);
    assert.equal(result.rollbackSafe, true);
    assert.equal(result.finalRecord.disposition, 'VALIDATED');
  });

  it('rejects validation against an older reality state', () => {
    const result = certifyLearningReplay({
      candidate,
      validations: [
        { validationId: 'v1', candidateId: candidate.candidateId, observedAt: '2026-09-20T12:00:00.000Z', evidenceIds: ['e1'], supportsCandidate: true, realityStateVersion: 1, realityStateHash: 'old-a' },
        { validationId: 'v2', candidateId: candidate.candidateId, observedAt: '2026-09-21T12:00:00.000Z', evidenceIds: ['e2'], supportsCandidate: true, realityStateVersion: 4, realityStateHash: 'game-b' },
      ],
    });
    assert.equal(result.passed, false);
    assert.equal(result.temporalIntegrity, false);
  });
});
