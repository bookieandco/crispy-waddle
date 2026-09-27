import type { ComputeWorkload } from './resource-contract.js';
import type { StorageIntent } from './storage-contract.js';

export type DataPathLineageDecision = {
  admissible: boolean;
  reasons: readonly string[];
};

export function validateComputeStorageLineage(
  workload: ComputeWorkload,
  intent: StorageIntent,
): DataPathLineageDecision {
  const reasons: string[] = [];
  const compute = workload.authority;
  const storage = intent.authority;

  if (compute.system !== storage.system) {
    reasons.push('COMPUTE_STORAGE_AUTHORITY_SYSTEM_MISMATCH');
  }
  if (compute.jobId !== storage.jobId) {
    reasons.push('COMPUTE_STORAGE_AUTHORITY_JOB_MISMATCH');
  }
  if (compute.idempotencyKey !== storage.idempotencyKey) {
    reasons.push('COMPUTE_STORAGE_IDEMPOTENCY_MISMATCH');
  }
  if (
    compute.projectId !== undefined &&
    storage.projectId !== undefined &&
    compute.projectId !== storage.projectId
  ) {
    reasons.push('COMPUTE_STORAGE_PROJECT_MISMATCH');
  }

  return {
    admissible: reasons.length === 0,
    reasons: Object.freeze([...new Set(reasons)]),
  };
}

export function assertComputeStorageLineage(
  workload: ComputeWorkload,
  intent: StorageIntent,
): void {
  const decision = validateComputeStorageLineage(workload, intent);
  if (!decision.admissible) {
    throw new Error(`COMPUTE_STORAGE_LINEAGE_INVALID:${decision.reasons.join(',')}`);
  }
}
