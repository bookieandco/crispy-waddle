import { describe, expect, it } from 'vitest';
import type { ComputeWorkload } from './resource-contract.js';
import type { StorageIntent } from './storage-contract.js';
import {
  assertComputeStorageLineage,
  validateComputeStorageLineage,
} from './data-path-lineage.js';

const workload: ComputeWorkload = {
  id: 'compute-1',
  source: 'director',
  kind: 'video-generation',
  queue: 'creative',
  priority: 700,
  authority: {
    system: 'director-generation',
    jobId: 'job-1',
    idempotencyKey: 'idem-1',
    projectId: 'movie-1',
  },
  resourceProfileId: 'director.video.default',
  resources: {
    cpuCores: 8,
    ramGiB: 32,
    scratchGiB: 100,
  },
  createdAt: '2026-09-27T02:00:00.000Z',
};

const intent: StorageIntent = {
  id: 'storage-1',
  authority: { ...workload.authority },
  stage: 'media-edit',
  accessPattern: 'range-stream',
  durability: 'durable',
  sensitiveData: true,
  createdAt: '2026-09-27T02:00:00.000Z',
};

describe('compute/storage lineage', () => {
  it('accepts the same durable job/idempotency lineage', () => {
    expect(validateComputeStorageLineage(workload, intent)).toEqual({
      admissible: true,
      reasons: [],
    });
    expect(() => assertComputeStorageLineage(workload, intent)).not.toThrow();
  });

  it('rejects a storage intent from another durable job', () => {
    const other = {
      ...intent,
      authority: { ...intent.authority, jobId: 'job-2' },
    };
    expect(validateComputeStorageLineage(workload, other).reasons).toContain(
      'COMPUTE_STORAGE_AUTHORITY_JOB_MISMATCH',
    );
  });

  it('rejects stale/different idempotency lineage', () => {
    expect(() =>
      assertComputeStorageLineage(workload, {
        ...intent,
        authority: { ...intent.authority, idempotencyKey: 'old-attempt' },
      }),
    ).toThrow('COMPUTE_STORAGE_LINEAGE_INVALID:COMPUTE_STORAGE_IDEMPOTENCY_MISMATCH');
  });

  it('rejects a different Director project when both sides declare project identity', () => {
    const decision = validateComputeStorageLineage(workload, {
      ...intent,
      authority: { ...intent.authority, projectId: 'movie-2' },
    });
    expect(decision.reasons).toContain('COMPUTE_STORAGE_PROJECT_MISMATCH');
  });
});
