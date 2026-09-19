import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePrediction, reliabilityBuckets } from './evaluation.js';
import type { ActualOutcome, PredictionRecord } from './contracts.js';

const prediction: PredictionRecord = {
  predictionId: 'pred-2',
  eventId: 'game-2',
  sport: 'SOCCER',
  predictionCutoff: '2026-09-03T12:00:00.000Z',
  createdAt: '2026-09-03T12:00:00.100Z',
  featureSnapshot: {
    snapshotId: 'features-2', asOf: '2026-09-03T11:59:00.000Z', contentHash: 'h',
    featureSetVersion: 'v1', evidenceIds: ['e2'],
  },
  evidence: [{
    evidenceId: 'e2', sourceId: 'feed', domain: 'WORLD',
    observedAt: '2026-09-03T11:58:00.000Z', receivedAt: '2026-09-03T11:59:00.000Z',
    quality: 'VERIFIED', contentHash: 'eh',
  }],
  distribution: {
    outcomes: [
      { outcome: 'home', probability: 0.7 },
      { outcome: 'draw', probability: 0.2 },
      { outcome: 'away', probability: 0.1 },
    ],
    modelId: 'model-2', modelVersion: '2.0.0',
  },
  calibrationVersion: 'cal-v2', confidence: 0.75, uncertainty: 0.25, inputHash: 'ih',
};

const actual: ActualOutcome = {
  eventId: 'game-2', outcome: 'home', observedAt: '2026-09-03T14:00:00.000Z', evidenceIds: ['final-1'],
};

test('computes multiclass Brier score and log loss', () => {
  const result = evaluatePrediction(prediction, actual);
  assert.equal(result.predictedProbability, 0.7);
  assert.ok(Math.abs(result.brierScore - 0.14) < 1e-12);
  assert.ok(Math.abs(result.logLoss - (-Math.log(0.7))) < 1e-12);
});

test('builds binary reliability buckets for a selected outcome', () => {
  const buckets = reliabilityBuckets([
    { predictedProbability: 0.6, occurred: true },
    { predictedProbability: 0.7, occurred: true },
    { predictedProbability: 0.8, occurred: false },
  ], 5);
  const nonEmpty = buckets.filter((bucket) => bucket.count > 0);
  assert.equal(nonEmpty.length, 2);
  assert.equal(nonEmpty[0].observedFrequency, 1);
  assert.equal(nonEmpty[1].observedFrequency, 0.5);
});
