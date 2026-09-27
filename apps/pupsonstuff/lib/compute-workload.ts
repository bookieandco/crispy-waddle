import type {
  ComputeExecutionConstraints,
  ComputeWorkloadDraft,
} from '@jhadina/compute-core';

export interface PupsonCreativeComputeInput {
  jobId: string;
  idempotencyKey: string;
  petIdentityId: string;
  productId: string;
  artStyle: string;
  sourceAssetIds: readonly string[];
  profileId: string;
  requestedPriority?: number;
  /**
   * A cost ceiling may be carried for future governed remote execution, but
   * source pet photos remain sensitive and therefore cloud-ineligible under
   * the current compute placement policy.
   */
  maxCostUsdPerHour?: number;
  createdAt?: string;
}

export function pupsonCreativeComputeDraft(
  input: PupsonCreativeComputeInput,
): ComputeWorkloadDraft {
  const constraints: ComputeExecutionConstraints = {
    sensitiveData: true,
    maxCostUsdPerHour: input.maxCostUsdPerHour,
  };
  return {
    id: `compute:pupson:${input.jobId}`,
    source: 'pupsonstuff',
    kind: 'image-generation',
    authority: {
      system: 'pupson-creative-job',
      jobId: input.jobId,
      idempotencyKey: input.idempotencyKey,
    },
    resourceProfileId: input.profileId,
    requestedPriority: input.requestedPriority,
    constraints,
    dataLocalityKeys: [
      `pet-identity:${input.petIdentityId}`,
      `product:${input.productId}`,
      `art-style:${input.artStyle}`,
      ...input.sourceAssetIds.map((assetId) => `asset:${assetId}`),
    ],
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export interface PodCreativeComputeInput {
  jobId: string;
  idempotencyKey: string;
  productId: string;
  sourceAssetIds: readonly string[];
  profileId: string;
  requestedPriority?: number;
  sensitiveData?: boolean;
  allowCloudBurst?: boolean;
  maxCostUsdPerHour?: number;
  createdAt?: string;
}

/**
 * General POD is separate from PupsonStuff: it can operate on non-pet artwork
 * and may later be eligible for governed cloud burst when the caller explicitly
 * says the inputs are non-sensitive. This function still does not authorize
 * spend or submit a Kubernetes job.
 */
export function podCreativeComputeDraft(
  input: PodCreativeComputeInput,
): ComputeWorkloadDraft {
  return {
    id: `compute:pod:${input.jobId}`,
    source: 'pod',
    kind: 'image-generation',
    authority: {
      system: 'pod-creative-job',
      jobId: input.jobId,
      idempotencyKey: input.idempotencyKey,
    },
    resourceProfileId: input.profileId,
    requestedPriority: input.requestedPriority,
    constraints: {
      sensitiveData: input.sensitiveData ?? true,
      allowCloudBurst: input.allowCloudBurst,
      maxCostUsdPerHour: input.maxCostUsdPerHour,
    },
    dataLocalityKeys: [
      `product:${input.productId}`,
      ...input.sourceAssetIds.map((assetId) => `asset:${assetId}`),
    ],
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
