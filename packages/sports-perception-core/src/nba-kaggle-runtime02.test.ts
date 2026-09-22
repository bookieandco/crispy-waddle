import assert from 'node:assert/strict';
import test from 'node:test';

import { certifyNBAKaggleRuntime02 } from './nba-kaggle-runtime02.js';

const hash = 'a'.repeat(64);

test('KAGGLE-RUNTIME.02 certifies only content-addressed quarantined evidence', () => {
  const result = certifyNBAKaggleRuntime02(
    {
      schemaVersion: 2,
      dataset: 'wyattowalsh/basketball',
      auth: 'KAGGLE_API_TOKEN',
      tokenPersisted: false,
      localPathPersisted: false,
      fileCount: 1,
      totalBytes: 42,
      manifestSha256: hash,
      files: [{ path: 'basketball.sqlite', bytes: 42, sha256: hash }],
    },
    {
      dataset: 'wyattowalsh/basketball',
      source: 'KAGGLE',
      surfaces: [
        {
          sourceFile: 'basketball.sqlite',
          surface: 'game',
          columns: ['game_id'],
          rowCount: 1,
          allowedUses: ['HISTORICAL_CONTEXT'],
        },
      ],
      quarantine: {
        physicalInferenceInput: false,
        hiddenGroundTruthInputBeforeFreeze: false,
        playerIdentityTruthBeforeFreeze: false,
        allowedOnlyAfterPhysicalFreezeForReconciliation: true,
      },
    },
  );

  assert.equal(result.certified, true);
});

test('KAGGLE-RUNTIME.02 fails when the manifest is empty', () => {
  const result = certifyNBAKaggleRuntime02(
    {
      schemaVersion: 2,
      dataset: 'wyattowalsh/basketball',
      auth: 'KAGGLE_API_TOKEN',
      tokenPersisted: false,
      localPathPersisted: false,
      fileCount: 0,
      totalBytes: 0,
      manifestSha256: hash,
      files: [],
    },
    {
      dataset: 'wyattowalsh/basketball',
      source: 'KAGGLE',
      surfaces: [],
      quarantine: {
        physicalInferenceInput: false,
        hiddenGroundTruthInputBeforeFreeze: false,
        playerIdentityTruthBeforeFreeze: false,
        allowedOnlyAfterPhysicalFreezeForReconciliation: true,
      },
    },
  );

  assert.equal(result.certified, false);
  assert.equal(result.checks.filesPresent, false);
  assert.equal(result.checks.surfacesInspected, false);
});
