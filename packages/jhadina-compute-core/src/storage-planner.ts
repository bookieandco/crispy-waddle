import {
  STORAGE_DURABILITY_RANK,
  inferredStorageRequirements,
  validateStorageIntent,
  type StorageBackend,
  type StorageCandidate,
  type StorageIntent,
  type StoragePlan,
  type StorageRejectionCode,
  type StorageStrategy,
} from './storage-contract.js';

function primaryRejectionCodes(
  backend: StorageBackend,
  intent: StorageIntent,
): StorageRejectionCode[] {
  const codes: StorageRejectionCode[] = [];
  const req = inferredStorageRequirements(intent);

  if (backend.status !== 'ready') codes.push('BACKEND_NOT_READY');

  if (backend.provider === 'external') {
    if (!intent.allowExternalStorage) codes.push('EXTERNAL_STORAGE_NOT_ALLOWED');
    if (intent.sensitiveData) codes.push('SENSITIVE_DATA_EXTERNAL_DENIED');
    if (
      intent.maxExternalCostUsdPerMonth !== undefined &&
      (backend.monthlyCostUsd ?? Number.POSITIVE_INFINITY) >
        intent.maxExternalCostUsdPerMonth
    ) {
      codes.push('EXTERNAL_COST_LIMIT_EXCEEDED');
    }
  }

  if (
    intent.estimatedSizeGiB !== undefined &&
    backend.capacityGiBFree !== undefined &&
    backend.capacityGiBFree < intent.estimatedSizeGiB
  ) {
    codes.push('CAPACITY_INSUFFICIENT');
  }

  if (
    STORAGE_DURABILITY_RANK[backend.durability] <
    STORAGE_DURABILITY_RANK[intent.durability]
  ) {
    codes.push('DURABILITY_INSUFFICIENT');
  }

  if (req.requirePosix && !backend.capabilities.posix) {
    codes.push('POSIX_REQUIRED');
  }
  if (req.requireReadWriteMany && !backend.capabilities.readWriteMany) {
    codes.push('READ_WRITE_MANY_REQUIRED');
  }
  if (req.requireRangeReads && !backend.capabilities.rangeReads) {
    codes.push('RANGE_READS_REQUIRED');
  }
  if (req.requireArchiveTier && !backend.capabilities.archiveTier) {
    codes.push('ARCHIVE_TIER_REQUIRED');
  }

  return [...new Set(codes)];
}

function cacheRejectionCodes(
  backend: StorageBackend,
  intent: StorageIntent,
): StorageRejectionCode[] {
  const codes: StorageRejectionCode[] = [];
  if (backend.status !== 'ready') codes.push('BACKEND_NOT_READY');
  if (!backend.capabilities.cache) codes.push('CACHE_CAPABILITY_REQUIRED');
  const req = inferredStorageRequirements(intent);
  if (req.requireOfflinePinning && !backend.capabilities.offlinePinning) {
    codes.push('OFFLINE_PINNING_REQUIRED');
  }
  if (backend.provider === 'external') {
    if (!intent.allowExternalStorage) codes.push('EXTERNAL_STORAGE_NOT_ALLOWED');
    if (intent.sensitiveData) codes.push('SENSITIVE_DATA_EXTERNAL_DENIED');
  }
  return [...new Set(codes)];
}

function primaryScore(
  backend: StorageBackend,
  intent: StorageIntent,
): StorageCandidate {
  let score = 0;
  const reasons: string[] = [];

  if (backend.provider === 'homebase') {
    score += 100;
    reasons.push('homebase-private');
  } else if (backend.provider === 'remote-homebase') {
    score += 70;
    reasons.push('trusted-remote-homebase');
  } else {
    score += 10;
    reasons.push('explicit-external-storage');
  }

  const locality = new Set(backend.localityKeys ?? []);
  const localityHits = (intent.dataLocalityKeys ?? []).filter((key) =>
    locality.has(key),
  ).length;
  if (localityHits > 0) {
    score += localityHits * 20;
    reasons.push(`data-locality:${localityHits}`);
  }

  switch (intent.stage) {
    case 'prepare':
      if (backend.capabilities.objectApi) {
        score += 30;
        reasons.push('prepare-object-fit');
      }
      break;
    case 'train':
      if (backend.capabilities.posix) {
        score += 35;
        reasons.push('train-posix-fit');
      }
      if (
        intent.accessPattern === 'sequential-large' &&
        backend.capabilities.objectApi
      ) {
        score += 20;
        reasons.push('train-object-large-file-fit');
      }
      break;
    case 'serve':
      if (backend.capabilities.readOnlyFanout) {
        score += 40;
        reasons.push('serve-read-fanout');
      }
      if (backend.latencyClass === 'ultra-low' || backend.latencyClass === 'low') {
        score += 20;
        reasons.push('serve-low-latency');
      }
      break;
    case 'archive':
      if (backend.capabilities.archiveTier) {
        score += 50;
        reasons.push('archive-tier-fit');
      }
      if (backend.capabilities.objectApi) {
        score += 20;
        reasons.push('archive-object-fit');
      }
      break;
    case 'media-ingest':
      if (backend.capabilities.objectApi || backend.capabilities.posix) {
        score += 25;
        reasons.push('media-ingest-fit');
      }
      break;
    case 'media-edit':
      if (backend.capabilities.rangeReads) {
        score += 40;
        reasons.push('media-range-read-fit');
      }
      if (backend.kind === 'virtual-drive') {
        score += 25;
        reasons.push('media-mounted-drive-fit');
      }
      if (backend.capabilities.posix) {
        score += 20;
        reasons.push('media-posix-fit');
      }
      break;
    case 'media-review':
    case 'media-delivery':
      if (backend.capabilities.rangeReads || backend.capabilities.objectApi) {
        score += 25;
        reasons.push('media-distribution-fit');
      }
      break;
  }

  if (backend.throughputMBps !== undefined) {
    score += Math.min(backend.throughputMBps, 10000) / 1000;
    reasons.push(`throughput:${backend.throughputMBps}MBps`);
  }

  if (backend.monthlyCostUsd !== undefined) {
    score -= backend.monthlyCostUsd / 100;
    reasons.push(`cost:${backend.monthlyCostUsd.toFixed(2)}/month`);
  }

  return { backendId: backend.id, score: Number(score.toFixed(3)), reasons };
}

function cacheScore(
  backend: StorageBackend,
  intent: StorageIntent,
): StorageCandidate {
  let score = 0;
  const reasons: string[] = [];

  if (backend.kind === 'local-nvme') {
    score += 100;
    reasons.push('node-local-nvme');
  } else if (backend.provider === 'homebase') {
    score += 60;
    reasons.push('homebase-cache');
  } else if (backend.provider === 'remote-homebase') {
    score += 30;
    reasons.push('remote-homebase-cache');
  }

  if (backend.capabilities.sparseCache) {
    score += 35;
    reasons.push('sparse-partial-cache');
  }
  if (backend.capabilities.offlinePinning) {
    score += 20;
    reasons.push('offline-pinning');
  }

  const locality = new Set(backend.localityKeys ?? []);
  const hits = (intent.dataLocalityKeys ?? []).filter((key) =>
    locality.has(key),
  ).length;
  if (hits > 0) {
    score += hits * 15;
    reasons.push(`data-locality:${hits}`);
  }

  if (backend.latencyClass === 'ultra-low') {
    score += 20;
    reasons.push('ultra-low-latency');
  } else if (backend.latencyClass === 'low') {
    score += 10;
    reasons.push('low-latency');
  }

  return { backendId: backend.id, score: Number(score.toFixed(3)), reasons };
}

function cacheUseful(intent: StorageIntent): boolean {
  return (
    intent.stage === 'train' ||
    intent.stage === 'serve' ||
    intent.stage === 'media-edit'
  );
}

function storageStrategy(
  intent: StorageIntent,
  primary: StorageBackend | undefined,
  cache: StorageBackend | undefined,
): StorageStrategy[] {
  const strategy: StorageStrategy[] = [];
  const req = inferredStorageRequirements(intent);

  if (req.requirePosix) strategy.push('shared-posix');
  if (intent.stage === 'archive') strategy.push('archive-tier');

  if (intent.stage === 'media-edit' && req.requireRangeReads) {
    strategy.push('range-stream');
  }

  if (cache) {
    if (
      intent.stage === 'serve' ||
      (intent.stage === 'train' && intent.accessPattern === 'sequential-large')
    ) {
      strategy.push('prefetch-before-run');
    } else {
      strategy.push('read-through-cache');
    }

    if (
      intent.requireOfflinePinning ||
      (intent.stage === 'media-edit' && cache.capabilities.offlinePinning)
    ) {
      strategy.push('pin-for-offline');
    }
  }

  if (
    intent.stage === 'train' &&
    intent.checkpointing === 'periodic' &&
    cache?.kind === 'local-nvme' &&
    primary &&
    STORAGE_DURABILITY_RANK[primary.durability] >=
      STORAGE_DURABILITY_RANK.durable
  ) {
    strategy.push('checkpoint-local-then-durable');
  }

  if (strategy.length === 0) strategy.push('direct');
  return [...new Set(strategy)];
}

/**
 * Pure data-path planning. This does not mount filesystems, copy bytes, delete
 * remote files, create cloud accounts, authorize external movement, or mutate
 * the durable asset registry.
 */
export function planStoragePath(
  backends: StorageBackend[],
  intent: StorageIntent,
): StoragePlan {
  const intentErrors = validateStorageIntent(intent);
  if (intentErrors.length) {
    throw new Error(`STORAGE_INTENT_INVALID:${intentErrors.join(',')}`);
  }

  const primaryCandidates: StorageCandidate[] = [];
  const cacheCandidates: StorageCandidate[] = [];
  const rejectedPrimary: StoragePlan['rejectedPrimary'] = [];
  const rejectedCache: StoragePlan['rejectedCache'] = [];

  for (const backend of backends) {
    const primaryCodes = primaryRejectionCodes(backend, intent);
    if (primaryCodes.length) {
      rejectedPrimary.push({ backendId: backend.id, codes: primaryCodes });
    } else {
      primaryCandidates.push(primaryScore(backend, intent));
    }

    if (cacheUseful(intent)) {
      const cacheCodes = cacheRejectionCodes(backend, intent);
      if (cacheCodes.length) {
        rejectedCache.push({ backendId: backend.id, codes: cacheCodes });
      } else {
        cacheCandidates.push(cacheScore(backend, intent));
      }
    }
  }

  const sortCandidates = (items: StorageCandidate[]) =>
    items.sort((a, b) =>
      b.score !== a.score
        ? b.score - a.score
        : a.backendId.localeCompare(b.backendId),
    );
  sortCandidates(primaryCandidates);
  sortCandidates(cacheCandidates);
  rejectedPrimary.sort((a, b) => a.backendId.localeCompare(b.backendId));
  rejectedCache.sort((a, b) => a.backendId.localeCompare(b.backendId));

  const primaryBackendId = primaryCandidates[0]?.backendId;
  const cacheBackendId = cacheCandidates[0]?.backendId;
  const primary = backends.find((backend) => backend.id === primaryBackendId);
  const cache = backends.find((backend) => backend.id === cacheBackendId);

  const requirements = inferredStorageRequirements(intent);
  const blockingReasons: string[] = [];
  if (!primaryBackendId) blockingReasons.push('NO_PRIMARY_STORAGE_PATH');
  if (requirements.requireOfflinePinning && !cacheBackendId) {
    blockingReasons.push('NO_OFFLINE_PINNING_CACHE');
  }

  return {
    intentId: intent.id,
    admissible: blockingReasons.length === 0,
    blockingReasons,
    primaryBackendId: blockingReasons.includes('NO_PRIMARY_STORAGE_PATH')
      ? undefined
      : primaryBackendId,
    cacheBackendId,
    primaryCandidates,
    cacheCandidates,
    rejectedPrimary,
    rejectedCache,
    strategy: storageStrategy(intent, primary, cache),
  };
}
