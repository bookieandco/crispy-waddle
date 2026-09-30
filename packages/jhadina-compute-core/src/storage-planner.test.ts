import { describe, expect, it } from 'vitest';
import type { StorageBackend, StorageIntent } from './storage-contract.js';
import { planStoragePath } from './storage-planner.js';

const nvme: StorageBackend = {
  id: 'node-nvme-1',
  provider: 'homebase',
  kind: 'local-nvme',
  status: 'ready',
  zone: 'home',
  durability: 'ephemeral',
  capacityGiBFree: 1800,
  throughputMBps: 6000,
  latencyClass: 'ultra-low',
  localityKeys: ['asset:shot-1', 'model:jllm'],
  capabilities: {
    cache: true,
    sparseCache: true,
    offlinePinning: true,
    rangeReads: true,
  },
};

const cephFs: StorageBackend = {
  id: 'cephfs-hot',
  provider: 'homebase',
  kind: 'shared-posix',
  status: 'ready',
  zone: 'home',
  durability: 'durable',
  capacityGiBFree: 40_000,
  throughputMBps: 5000,
  latencyClass: 'low',
  capabilities: {
    posix: true,
    readWriteMany: true,
    rangeReads: true,
    readOnlyFanout: true,
    snapshots: true,
  },
};

const cephObject: StorageBackend = {
  id: 'ceph-rgw',
  provider: 'homebase',
  kind: 'object',
  status: 'ready',
  zone: 'home',
  durability: 'durable',
  capacityGiBFree: 100_000,
  throughputMBps: 3500,
  latencyClass: 'standard',
  capabilities: {
    objectApi: true,
    rangeReads: true,
    readOnlyFanout: true,
    snapshots: true,
  },
};

const cephArchive: StorageBackend = {
  id: 'ceph-archive',
  provider: 'homebase',
  kind: 'object',
  status: 'ready',
  zone: 'home',
  durability: 'archive',
  capacityGiBFree: 250_000,
  throughputMBps: 1200,
  latencyClass: 'cold',
  capabilities: {
    objectApi: true,
    rangeReads: true,
    archiveTier: true,
    snapshots: true,
  },
};

const shade: StorageBackend = {
  id: 'shade-external',
  provider: 'external',
  kind: 'virtual-drive',
  status: 'ready',
  zone: 'external-us',
  durability: 'durable',
  capacityGiBFree: 50_000,
  throughputMBps: 1000,
  latencyClass: 'standard',
  monthlyCostUsd: 500,
  capabilities: {
    rangeReads: true,
    offlinePinning: true,
  },
};

const authority = {
  system: 'director-generation',
  jobId: 'job-1',
  idempotencyKey: 'idem-1',
  projectId: 'movie-1',
};

function intent(
  overrides: Partial<StorageIntent>,
): StorageIntent {
  return {
    id: 'storage-1',
    authority,
    stage: 'prepare',
    accessPattern: 'sequential-large',
    durability: 'durable',
    sensitiveData: true,
    createdAt: '2026-09-27T02:00:00.000Z',
    ...overrides,
  };
}

describe('planStoragePath', () => {
  it('prefers durable object storage for prepare/data-lake work', () => {
    const plan = planStoragePath(
      [cephFs, cephObject, cephArchive, nvme],
      intent({ stage: 'prepare', accessPattern: 'sequential-large' }),
    );
    expect(plan.admissible).toBe(true);
    expect(plan.primaryBackendId).toBe('ceph-rgw');
    expect(plan.strategy).toEqual(['direct']);
  });

  it('requires shared POSIX/RWX for random small-file multi-writer training', () => {
    const plan = planStoragePath(
      [cephObject, cephFs, nvme],
      intent({
        stage: 'train',
        accessPattern: 'random-small',
        sharedWriters: 8,
        checkpointing: 'periodic',
      }),
    );
    expect(plan.admissible).toBe(true);
    expect(plan.primaryBackendId).toBe('cephfs-hot');
    expect(plan.cacheBackendId).toBe('node-nvme-1');
    expect(plan.strategy).toContain('shared-posix');
    expect(plan.strategy).toContain('checkpoint-local-then-durable');
    expect(
      plan.rejectedPrimary.find((item) => item.backendId === 'ceph-rgw')?.codes,
    ).toEqual(expect.arrayContaining(['POSIX_REQUIRED', 'READ_WRITE_MANY_REQUIRED']));
  });

  it('prefetches serving data into the fastest local cache', () => {
    const plan = planStoragePath(
      [cephObject, cephFs, nvme],
      intent({
        stage: 'serve',
        accessPattern: 'read-mostly-fanout',
        dataLocalityKeys: ['model:jllm'],
      }),
    );
    expect(plan.admissible).toBe(true);
    expect(plan.cacheBackendId).toBe('node-nvme-1');
    expect(plan.strategy).toContain('prefetch-before-run');
  });

  it('selects an archive-capable object tier for write-once cold data', () => {
    const plan = planStoragePath(
      [cephObject, cephArchive, nvme],
      intent({
        stage: 'archive',
        accessPattern: 'write-once-read-rarely',
        durability: 'archive',
      }),
    );
    expect(plan.admissible).toBe(true);
    expect(plan.primaryBackendId).toBe('ceph-archive');
    expect(plan.strategy).toEqual(['archive-tier']);
  });

  it('builds a range-stream + pinned-cache path for active media editing', () => {
    const plan = planStoragePath(
      [cephObject, cephFs, nvme, shade],
      intent({
        stage: 'media-edit',
        accessPattern: 'range-stream',
        dataLocalityKeys: ['asset:shot-1'],
      }),
    );
    expect(plan.admissible).toBe(true);
    expect(plan.primaryBackendId).toBe('cephfs-hot');
    expect(plan.cacheBackendId).toBe('node-nvme-1');
    expect(plan.strategy).toEqual(
      expect.arrayContaining(['range-stream', 'read-through-cache', 'pin-for-offline']),
    );
  });

  it('denies sensitive data on an external provider even when external storage is requested', () => {
    const plan = planStoragePath(
      [shade],
      intent({
        stage: 'media-delivery',
        accessPattern: 'range-stream',
        allowExternalStorage: true,
        sensitiveData: true,
      }),
    );
    expect(plan.admissible).toBe(false);
    expect(plan.primaryBackendId).toBeUndefined();
    expect(plan.rejectedPrimary[0]?.codes).toContain('SENSITIVE_DATA_EXTERNAL_DENIED');
  });

  it('does not infer external storage merely because it is the only available backend', () => {
    const plan = planStoragePath(
      [shade],
      intent({
        stage: 'media-delivery',
        accessPattern: 'range-stream',
        sensitiveData: false,
      }),
    );
    expect(plan.admissible).toBe(false);
    expect(plan.rejectedPrimary[0]?.codes).toContain('EXTERNAL_STORAGE_NOT_ALLOWED');
  });

  it('allows explicitly eligible non-sensitive delivery media on an external backend within cost ceiling', () => {
    const plan = planStoragePath(
      [shade],
      intent({
        stage: 'media-delivery',
        accessPattern: 'range-stream',
        sensitiveData: false,
        allowExternalStorage: true,
        maxExternalCostUsdPerMonth: 600,
      }),
    );
    expect(plan.admissible).toBe(true);
    expect(plan.primaryBackendId).toBe('shade-external');
  });

  it('blocks an edit path when offline pinning is required but no cache can provide it', () => {
    const plan = planStoragePath(
      [cephFs],
      intent({
        stage: 'media-edit',
        accessPattern: 'range-stream',
        requireOfflinePinning: true,
      }),
    );
    expect(plan.admissible).toBe(false);
    expect(plan.blockingReasons).toContain('NO_OFFLINE_PINNING_CACHE');
  });

  it('rejects invalid durable authority lineage before planning', () => {
    expect(() =>
      planStoragePath(
        [cephObject],
        intent({ authority: { ...authority, idempotencyKey: '' } }),
      ),
    ).toThrow('STORAGE_INTENT_INVALID:STORAGE_AUTHORITY_LINEAGE_REQUIRED');
  });
});
