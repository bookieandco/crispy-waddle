import {
  defaultQueueForKind,
  normalizeWorkloadPriority,
  type ComputeQueueClass,
  type ComputeResourceRequest,
  type ComputeWorkload,
  type ComputeWorkloadKind,
  type ComputeAuthorityBinding,
} from './resource-contract.js';

export type ComputeCapacityRequest = Omit<
  ComputeResourceRequest,
  'allowCloudBurst' | 'sensitiveData' | 'maxCostUsdPerHour'
>;

export type ComputeExecutionConstraints = Pick<
  ComputeResourceRequest,
  'allowCloudBurst' | 'sensitiveData' | 'maxCostUsdPerHour'
>;

export type ComputeResourceProfile = {
  id: string;
  allowedKinds: readonly ComputeWorkloadKind[];
  resources: ComputeCapacityRequest;
  labels?: Readonly<Record<string, string>>;
};

export type ComputeWorkloadDraft = {
  id: string;
  source: ComputeWorkload['source'];
  kind: ComputeWorkloadKind;
  authority: ComputeAuthorityBinding;
  resourceProfileId: string;
  queue?: ComputeQueueClass;
  requestedPriority?: number;
  constraints?: ComputeExecutionConstraints;
  dataLocalityKeys?: readonly string[];
  preferredNodeIds?: readonly string[];
  forbiddenNodeIds?: readonly string[];
  createdAt: string;
};

export type ComputeResourceProfileCatalog = Readonly<Record<string, ComputeResourceProfile>>;

export function validateResourceProfile(profile: ComputeResourceProfile): readonly string[] {
  const reasons: string[] = [];
  if (!profile.id.trim()) reasons.push('COMPUTE_PROFILE_ID_REQUIRED');
  if (!profile.allowedKinds.length) reasons.push('COMPUTE_PROFILE_KIND_REQUIRED');
  if (!Number.isFinite(profile.resources.cpuCores) || profile.resources.cpuCores <= 0) {
    reasons.push('COMPUTE_PROFILE_CPU_INVALID');
  }
  if (!Number.isFinite(profile.resources.ramGiB) || profile.resources.ramGiB <= 0) {
    reasons.push('COMPUTE_PROFILE_RAM_INVALID');
  }
  if (!Number.isFinite(profile.resources.scratchGiB) || profile.resources.scratchGiB < 0) {
    reasons.push('COMPUTE_PROFILE_SCRATCH_INVALID');
  }
  for (const [key, value] of [
    ['network', profile.resources.networkMbps],
    ['durable-read', profile.resources.durableReadGiB],
    ['durable-write', profile.resources.durableWriteGiB],
  ] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      reasons.push(`COMPUTE_PROFILE_${key.toUpperCase().replace('-', '_')}_INVALID`);
    }
  }
  const gpu = profile.resources.gpu;
  if (gpu) {
    if (!Number.isInteger(gpu.count) || gpu.count <= 0) reasons.push('COMPUTE_PROFILE_GPU_COUNT_INVALID');
    if (
      gpu.minVramGiBPerDevice !== undefined &&
      (!Number.isFinite(gpu.minVramGiBPerDevice) || gpu.minVramGiBPerDevice <= 0)
    ) reasons.push('COMPUTE_PROFILE_GPU_VRAM_INVALID');
  }
  return Object.freeze([...new Set(reasons)]);
}

function validateDraft(draft: ComputeWorkloadDraft): void {
  if (!draft.id.trim()) throw new Error('COMPUTE_WORKLOAD_ID_REQUIRED');
  if (!draft.resourceProfileId.trim()) throw new Error('COMPUTE_RESOURCE_PROFILE_REQUIRED');
  if (
    !draft.authority.system.trim() ||
    !draft.authority.jobId.trim() ||
    !draft.authority.idempotencyKey.trim()
  ) {
    throw new Error('COMPUTE_AUTHORITY_LINEAGE_REQUIRED');
  }
  if (
    draft.constraints?.maxCostUsdPerHour !== undefined &&
    (!Number.isFinite(draft.constraints.maxCostUsdPerHour) ||
      draft.constraints.maxCostUsdPerHour <= 0)
  ) {
    throw new Error('COMPUTE_COST_LIMIT_INVALID');
  }
}

export function resolveComputeWorkload(
  draft: ComputeWorkloadDraft,
  profiles: ComputeResourceProfileCatalog,
): ComputeWorkload {
  validateDraft(draft);
  const profile = profiles[draft.resourceProfileId];
  if (!profile) throw new Error(`COMPUTE_RESOURCE_PROFILE_NOT_FOUND:${draft.resourceProfileId}`);
  const profileErrors = validateResourceProfile(profile);
  if (profileErrors.length) {
    throw new Error(`COMPUTE_RESOURCE_PROFILE_INVALID:${profileErrors.join(',')}`);
  }
  if (profile.id !== draft.resourceProfileId) {
    throw new Error('COMPUTE_RESOURCE_PROFILE_ID_MISMATCH');
  }
  if (!profile.allowedKinds.includes(draft.kind)) {
    throw new Error(`COMPUTE_RESOURCE_PROFILE_KIND_MISMATCH:${draft.kind}`);
  }

  const queue = draft.queue ?? defaultQueueForKind(draft.kind);
  const resources: ComputeResourceRequest = {
    ...profile.resources,
    gpu: profile.resources.gpu
      ? {
          ...profile.resources.gpu,
          requiredFeatures: profile.resources.gpu.requiredFeatures
            ? [...profile.resources.gpu.requiredFeatures]
            : undefined,
        }
      : undefined,
    ...draft.constraints,
  };

  return {
    id: draft.id,
    source: draft.source,
    kind: draft.kind,
    queue,
    priority: normalizeWorkloadPriority(queue, draft.requestedPriority),
    authority: { ...draft.authority },
    resourceProfileId: draft.resourceProfileId,
    resources,
    dataLocalityKeys: draft.dataLocalityKeys ? [...new Set(draft.dataLocalityKeys)] : undefined,
    preferredNodeIds: draft.preferredNodeIds ? [...new Set(draft.preferredNodeIds)] : undefined,
    forbiddenNodeIds: draft.forbiddenNodeIds ? [...new Set(draft.forbiddenNodeIds)] : undefined,
    createdAt: draft.createdAt,
  };
}
