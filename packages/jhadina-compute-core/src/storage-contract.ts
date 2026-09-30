import type { ComputeAuthorityBinding } from './resource-contract.js';

export type StorageLifecycleStage =
  | 'prepare'
  | 'train'
  | 'serve'
  | 'archive'
  | 'media-ingest'
  | 'media-edit'
  | 'media-review'
  | 'media-delivery';

export type StorageProvider = 'homebase' | 'remote-homebase' | 'external';

export type StorageBackendKind =
  | 'local-nvme'
  | 'object'
  | 'shared-posix'
  | 'block'
  | 'virtual-drive';

export type StorageAccessPattern =
  | 'sequential-large'
  | 'random-small'
  | 'range-stream'
  | 'metadata-heavy'
  | 'shared-read-write'
  | 'read-mostly-fanout'
  | 'write-once-read-rarely';

export type StorageDurability = 'ephemeral' | 'recoverable' | 'durable' | 'archive';

export type StorageCacheMode =
  | 'none'
  | 'read-through'
  | 'pinned'
  | 'prefetch'
  | 'shared-cache';

export type StorageIntent = {
  id: string;
  authority: ComputeAuthorityBinding;
  stage: StorageLifecycleStage;
  accessPattern: StorageAccessPattern;
  durability: StorageDurability;
  estimatedSizeGiB?: number;
  fileCount?: number;
  nodeCount?: number;
  sharedWriters?: number;
  immutable?: boolean;
  checkpointing?: 'none' | 'periodic';
  sensitiveData?: boolean;
  allowExternalStorage?: boolean;
  maxExternalCostUsdPerMonth?: number;
  requirePosix?: boolean;
  requireRangeReads?: boolean;
  requireReadWriteMany?: boolean;
  requireOfflinePinning?: boolean;
  dataLocalityKeys?: string[];
  createdAt: string;
};

export type StorageBackendCapabilities = {
  objectApi?: boolean;
  posix?: boolean;
  readWriteMany?: boolean;
  rangeReads?: boolean;
  sparseCache?: boolean;
  offlinePinning?: boolean;
  readOnlyFanout?: boolean;
  archiveTier?: boolean;
  snapshots?: boolean;
  nativeHashes?: boolean;
  cache?: boolean;
};

export type StorageBackend = {
  id: string;
  provider: StorageProvider;
  kind: StorageBackendKind;
  status: 'ready' | 'degraded' | 'offline';
  zone: string;
  durability: StorageDurability;
  capacityGiBFree?: number;
  throughputMBps?: number;
  latencyClass?: 'ultra-low' | 'low' | 'standard' | 'cold';
  monthlyCostUsd?: number;
  localityKeys?: string[];
  capabilities: StorageBackendCapabilities;
  labels?: Record<string, string>;
};

export type StorageRejectionCode =
  | 'BACKEND_NOT_READY'
  | 'EXTERNAL_STORAGE_NOT_ALLOWED'
  | 'SENSITIVE_DATA_EXTERNAL_DENIED'
  | 'CAPACITY_INSUFFICIENT'
  | 'DURABILITY_INSUFFICIENT'
  | 'POSIX_REQUIRED'
  | 'READ_WRITE_MANY_REQUIRED'
  | 'RANGE_READS_REQUIRED'
  | 'OFFLINE_PINNING_REQUIRED'
  | 'ARCHIVE_TIER_REQUIRED'
  | 'CACHE_CAPABILITY_REQUIRED'
  | 'EXTERNAL_COST_LIMIT_EXCEEDED';

export type StorageCandidate = {
  backendId: string;
  score: number;
  reasons: string[];
};

export type StorageRejection = {
  backendId: string;
  codes: StorageRejectionCode[];
};

export type StorageStrategy =
  | 'direct'
  | 'read-through-cache'
  | 'pin-for-offline'
  | 'prefetch-before-run'
  | 'range-stream'
  | 'checkpoint-local-then-durable'
  | 'shared-posix'
  | 'archive-tier';

export type StoragePlan = {
  intentId: string;
  admissible: boolean;
  blockingReasons: string[];
  primaryBackendId?: string;
  cacheBackendId?: string;
  primaryCandidates: StorageCandidate[];
  cacheCandidates: StorageCandidate[];
  rejectedPrimary: StorageRejection[];
  rejectedCache: StorageRejection[];
  strategy: StorageStrategy[];
};

export const STORAGE_DURABILITY_RANK: Record<StorageDurability, number> = {
  ephemeral: 0,
  recoverable: 1,
  durable: 2,
  archive: 3,
};

export function validateStorageIntent(intent: StorageIntent): readonly string[] {
  const reasons: string[] = [];
  if (!intent.id.trim()) reasons.push('STORAGE_INTENT_ID_REQUIRED');
  if (
    !intent.authority.system.trim() ||
    !intent.authority.jobId.trim() ||
    !intent.authority.idempotencyKey.trim()
  ) reasons.push('STORAGE_AUTHORITY_LINEAGE_REQUIRED');
  if (
    intent.estimatedSizeGiB !== undefined &&
    (!Number.isFinite(intent.estimatedSizeGiB) || intent.estimatedSizeGiB < 0)
  ) reasons.push('STORAGE_ESTIMATED_SIZE_INVALID');
  if (
    intent.fileCount !== undefined &&
    (!Number.isInteger(intent.fileCount) || intent.fileCount < 0)
  ) reasons.push('STORAGE_FILE_COUNT_INVALID');
  if (
    intent.nodeCount !== undefined &&
    (!Number.isInteger(intent.nodeCount) || intent.nodeCount < 1)
  ) reasons.push('STORAGE_NODE_COUNT_INVALID');
  if (
    intent.sharedWriters !== undefined &&
    (!Number.isInteger(intent.sharedWriters) || intent.sharedWriters < 0)
  ) reasons.push('STORAGE_SHARED_WRITERS_INVALID');
  if (
    intent.maxExternalCostUsdPerMonth !== undefined &&
    (!Number.isFinite(intent.maxExternalCostUsdPerMonth) ||
      intent.maxExternalCostUsdPerMonth <= 0)
  ) reasons.push('STORAGE_EXTERNAL_COST_LIMIT_INVALID');
  return Object.freeze([...new Set(reasons)]);
}

export function inferredStorageRequirements(intent: StorageIntent): {
  requirePosix: boolean;
  requireReadWriteMany: boolean;
  requireRangeReads: boolean;
  requireOfflinePinning: boolean;
  requireArchiveTier: boolean;
} {
  const trainingNeedsPosix =
    intent.stage === 'train' &&
    (intent.accessPattern === 'random-small' ||
      intent.accessPattern === 'shared-read-write' ||
      (intent.sharedWriters ?? 0) > 0);
  const mediaNeedsRange =
    intent.stage === 'media-edit' && intent.accessPattern === 'range-stream';

  return {
    requirePosix: intent.requirePosix ?? trainingNeedsPosix,
    requireReadWriteMany:
      intent.requireReadWriteMany ??
      (intent.stage === 'train' &&
        (intent.sharedWriters ?? 0) > 1),
    requireRangeReads: intent.requireRangeReads ?? mediaNeedsRange,
    requireOfflinePinning:
      intent.requireOfflinePinning ??
      (intent.stage === 'media-edit' && intent.accessPattern === 'range-stream'),
    requireArchiveTier: intent.stage === 'archive',
  };
}
