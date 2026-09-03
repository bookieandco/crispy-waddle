import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PredictionRealityAttributionReport } from './prediction-reality-attribution.js';
import { proposeLearningCandidates } from './prediction-learning.js';

const report = (kind: PredictionRealityAttributionReport['attributions'][number]['kind'], confidence = 0.9): PredictionRealityAttributionReport => ({
  predictionId: 'p1',
  gameId: 'g1',
  informationCutoff: '2026-09-03T12:00:00.000Z',
  evaluatedAt: '2026-09-03T15:00:00.000Z',
  prediction: {
    predictionId: 'p1',
    gameId: 'g1',
    evaluatedAt: '2026-09-03T15:00:00.000Z',
    modelVersion: 'model-v1',
    calibrationVersion: 'cal-v1',
    featureSetVersion: 'features-v1',
    brierScore: 0.2,
    logLoss: 0.3,
    meanAbsoluteResidual: 0.2,
    evidenceIds: ['e1'],
  } as PredictionRealityAttributionReport['prediction'],
  realityChanged: true,
  attributions: [{ kind, confidence, rationale: 'test', evidenceIds: ['e2'], divergencePaths: ['player.fatigue'] }],
  primaryAttribution: kind,
  temporalLeakageDetected: false,
  summary: 'test',
});

describe('proposeLearningCandidates', () => {
  it('does not learn from ordinary variance or quarantined leakage', () => {
    assert.equal(proposeLearningCandidates(report('ORDINARY_VARIANCE')).length, 0);
    const quarantined = { ...report('PLAYER_STATE'), temporalLeakageDetected: true };
    assert.equal(proposeLearningCandidates(quarantined).length, 0);
  });

  it('creates a bounded player-state proposal with lineage', () => {
    const candidates = proposeLearningCandidates(report('PLAYER_STATE'));
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]?.target, 'PLAYER_STATE');
    assert.ok(Math.abs(candidates[0]?.boundedDelta ?? 99) <= 0.05);
    assert.deepEqual(candidates[0]?.evidenceIds, ['e2']);
    assert.equal(candidates[0]?.modelVersion, 'model-v1');
  });

  it('records model attribution as a challenger signal without parameter mutation', () => {
    const candidates = proposeLearningCandidates(report('MODEL'));
    assert.equal(candidates[0]?.target, 'MODEL_CHALLENGER');
    assert.equal(candidates[0]?.boundedDelta, 0);
    assert.match(candidates[0]?.rationale ?? '', /challenger signal/);
  });

  it('requires strong attribution before proposing a change', () => {
    assert.equal(proposeLearningCandidates(report('MATCHUP_ASSUMPTION', 0.69)).length, 0);
  });
});
