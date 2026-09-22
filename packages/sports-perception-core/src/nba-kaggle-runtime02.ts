import { KAGGLE_PERCEPTION_RULE } from './nba-kaggle-reference.js';

export type NBAKaggleRuntimeUse =
  | 'HISTORICAL_CONTEXT'
  | 'ROSTER_CROSSCHECK'
  | 'BOX_SCORE_RECONCILIATION'
  | 'CALIBRATION_CORPUS';

export interface NBAKaggleRuntimeFile {
  path: string;
  bytes: number;
  sha256: string;
}

export interface NBAKaggleRuntimeReceipt {
  schemaVersion: 2;
  dataset: 'wyattowalsh/basketball';
  auth: 'KAGGLE_API_TOKEN';
  tokenPersisted: false;
  localPathPersisted: false;
  fileCount: number;
  totalBytes: number;
  manifestSha256: string;
  files: readonly NBAKaggleRuntimeFile[];
}

export interface NBAKaggleRuntimeAudit {
  dataset: 'wyattowalsh/basketball';
  source: 'KAGGLE';
  surfaces: readonly {
    sourceFile: string;
    surface: string;
    columns: readonly string[];
    rowCount: number;
    allowedUses: readonly NBAKaggleRuntimeUse[];
  }[];
  quarantine: {
    physicalInferenceInput: false;
    hiddenGroundTruthInputBeforeFreeze: false;
    playerIdentityTruthBeforeFreeze: false;
    allowedOnlyAfterPhysicalFreezeForReconciliation: true;
  };
}

const HASH = /^[a-f0-9]{64}$/i;

export function certifyNBAKaggleRuntime02(
  receipt: NBAKaggleRuntimeReceipt,
  audit: NBAKaggleRuntimeAudit,
) {
  const uniquePaths = new Set(receipt.files.map(file => file.path));
  const summedBytes = receipt.files.reduce((sum, file) => sum + file.bytes, 0);
  const checks = Object.freeze({
    schema: receipt.schemaVersion === 2,
    dataset:
      receipt.dataset === 'wyattowalsh/basketball' &&
      audit.dataset === receipt.dataset &&
      audit.source === 'KAGGLE',
    secretSafe:
      receipt.auth === 'KAGGLE_API_TOKEN' &&
      receipt.tokenPersisted === false &&
      receipt.localPathPersisted === false,
    immutableManifest: HASH.test(receipt.manifestSha256),
    filesPresent: receipt.fileCount > 0 && receipt.files.length === receipt.fileCount,
    fileHashes: receipt.files.every(
      file => file.path.length > 0 && file.bytes >= 0 && HASH.test(file.sha256),
    ),
    uniqueFiles: uniquePaths.size === receipt.files.length,
    byteAccounting: summedBytes === receipt.totalBytes,
    surfacesInspected: audit.surfaces.length > 0,
    quarantine:
      audit.quarantine.physicalInferenceInput === false &&
      audit.quarantine.hiddenGroundTruthInputBeforeFreeze === false &&
      audit.quarantine.playerIdentityTruthBeforeFreeze === false &&
      audit.quarantine.allowedOnlyAfterPhysicalFreezeForReconciliation === true,
  });

  return Object.freeze({
    phase: 'KAGGLE-RUNTIME.02' as const,
    certified: Object.values(checks).every(Boolean),
    checks,
    perceptionRule: KAGGLE_PERCEPTION_RULE,
  });
}
