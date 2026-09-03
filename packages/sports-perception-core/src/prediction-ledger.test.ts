import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryPredictionLedger } from './prediction-ledger.js';
import type { PredictionRecord } from './contracts.js';

const record = (): PredictionRecord => ({
  predictionId: 'immutable-1', eventId: 'game-immutable', sport: 'NFL',
  predictionCutoff: '2026-09-03T12:00:00.000Z', createdAt: '2026-09-03T12:00:01.000Z',
  featureSnapshot: { snapshotId: 'fs', asOf: '2026-09-03T11:00:00.000Z', contentHash: 'f', featureSetVersion: '1', evidenceIds: ['e'] },
  evidence: [{ evidenceId: 'e', sourceId: 'official', domain: 'WORLD', observedAt: '2026-09-03T10:00:00.000Z', receivedAt: '2026-09-03T10:01:00.000Z', quality: 'VERIFIED', contentHash: 'eh' }],
  distribution: { outcomes: [{ outcome: 'home', probability: 0.5 }, { outcome: 'away', probability: 0.5 }], modelId: 'm', modelVersion: '1' },
  calibrationVersion: 'cal-1', confidence: 0.5, uncertainty: 0.5, inputHash: 'input-1',
});

test('ledger rejects attempts to overwrite a prediction id', () => {
  const ledger = new InMemoryPredictionLedger();
  ledger.append(record());
  assert.throws(() => ledger.append(record()), /already exists/);
});
