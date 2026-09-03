import assert from 'node:assert/strict';
import test from 'node:test';
import { freezePredictionRecord, validatePredictionRecord } from './validation.js';
import type { PredictionRecord } from './contracts.js';

const baseRecord = (): PredictionRecord => ({
  predictionId: 'pred-1',
  eventId: 'game-1',
  sport: 'NBA',
  predictionCutoff: '2026-09-03T12:00:00.000Z',
  createdAt: '2026-09-03T12:00:01.000Z',
  featureSnapshot: {
    snapshotId: 'features-1',
    asOf: '2026-09-03T11:59:59.000Z',
    contentHash: 'features-hash',
    featureSetVersion: 'v1',
    evidenceIds: ['e1'],
  },
  evidence: [{
    evidenceId: 'e1',
    sourceId: 'official-feed',
    domain: 'WORLD',
    observedAt: '2026-09-03T11:59:00.000Z',
    receivedAt: '2026-09-03T11:59:30.000Z',
    quality: 'VERIFIED',
    contentHash: 'e1-hash',
  }],
  distribution: {
    outcomes: [
      { outcome: 'home', probability: 0.6 },
      { outcome: 'away', probability: 0.4 },
    ],
    modelId: 'model-1',
    modelVersion: '1.0.0',
  },
  calibrationVersion: 'cal-v1',
  confidence: 0.8,
  uncertainty: 0.2,
  inputHash: 'input-hash',
});

test('accepts a temporally valid prediction record', () => {
  assert.doesNotThrow(() => validatePredictionRecord(baseRecord()));
});

test('rejects evidence received after cutoff', () => {
  const record = baseRecord();
  record.evidence[0].receivedAt = '2026-09-03T12:00:01.000Z';
  assert.throws(() => validatePredictionRecord(record), /received after prediction cutoff/);
});

test('rejects feature snapshots after cutoff', () => {
  const record = baseRecord();
  record.featureSnapshot.asOf = '2026-09-03T12:00:00.001Z';
  assert.throws(() => validatePredictionRecord(record), /after prediction cutoff/);
});

test('rejects distributions that do not sum to one', () => {
  const record = baseRecord();
  record.distribution.outcomes[0].probability = 0.7;
  assert.throws(() => validatePredictionRecord(record), /sum to 1/);
});

test('freezes historical prediction records after validation', () => {
  const record = freezePredictionRecord(baseRecord());
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.distribution.outcomes), true);
});
