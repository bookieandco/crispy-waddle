import type {
  ComputeAuthorityBinding,
  ComputeExecutionConstraints,
  ComputeWorkloadDraft,
} from '@jhadina/compute-core';

function unique(keys: readonly string[]): string[] {
  return [...new Set(keys.filter((key) => key.trim()))];
}

export interface JllmInteractiveComputeInput {
  requestId: string;
  workSessionId: string;
  profileId: string;
  modelId?: string;
  memoryIds?: readonly string[];
  mediaAssetIds?: readonly string[];
  requestedPriority?: number;
  createdAt?: string;
}

export function jllmInteractiveComputeDraft(
  input: JllmInteractiveComputeInput,
): ComputeWorkloadDraft {
  return {
    id: `compute:jllm:${input.requestId}`,
    source: 'jllm',
    kind: 'llm-interactive',
    authority: {
      system: 'jhadina-work-session',
      jobId: input.workSessionId,
      idempotencyKey: input.requestId,
    },
    resourceProfileId: input.profileId,
    requestedPriority: input.requestedPriority,
    constraints: { sensitiveData: true },
    dataLocalityKeys: unique([
      `work-session:${input.workSessionId}`,
      ...(input.modelId ? [`model:${input.modelId}`] : []),
      ...(input.memoryIds ?? []).map((id) => `memory:${id}`),
      ...(input.mediaAssetIds ?? []).map((id) => `asset:${id}`),
    ]),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export interface JllmVoiceComputeInput {
  requestId: string;
  workSessionId: string;
  voiceIdentityId: string;
  profileId: string;
  requestedPriority?: number;
  createdAt?: string;
}

export function jllmVoiceComputeDraft(input: JllmVoiceComputeInput): ComputeWorkloadDraft {
  return {
    id: `compute:jllm-voice:${input.requestId}`,
    source: 'jllm',
    kind: 'voice-generation',
    queue: 'interactive',
    authority: {
      system: 'jhadina-work-session',
      jobId: input.workSessionId,
      idempotencyKey: input.requestId,
    },
    resourceProfileId: input.profileId,
    requestedPriority: input.requestedPriority,
    constraints: { sensitiveData: true },
    dataLocalityKeys: [
      `work-session:${input.workSessionId}`,
      `voice:${input.voiceIdentityId}`,
    ],
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export interface CharacterRuntimeComputeInput {
  runtimeId: string;
  characterId: string;
  authority: ComputeAuthorityBinding;
  profileId: string;
  modelIds?: readonly string[];
  voiceIdentityId?: string;
  memoryIds?: readonly string[];
  requestedPriority?: number;
  createdAt?: string;
}

export function characterRuntimeComputeDraft(
  input: CharacterRuntimeComputeInput,
): ComputeWorkloadDraft {
  return {
    id: `compute:character:${input.runtimeId}`,
    source: 'jllm',
    kind: 'character-runtime',
    authority: { ...input.authority },
    resourceProfileId: input.profileId,
    requestedPriority: input.requestedPriority,
    constraints: { sensitiveData: true },
    dataLocalityKeys: unique([
      `character:${input.characterId}`,
      ...(input.modelIds ?? []).map((id) => `model:${id}`),
      ...(input.voiceIdentityId ? [`voice:${input.voiceIdentityId}`] : []),
      ...(input.memoryIds ?? []).map((id) => `memory:${id}`),
    ]),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export interface MemoryMaintenanceComputeInput {
  jobId: string;
  idempotencyKey: string;
  profileId: string;
  operation: 'embedding' | 'index';
  memoryIds?: readonly string[];
  sourceAssetIds?: readonly string[];
  requestedPriority?: number;
  constraints?: Pick<ComputeExecutionConstraints, 'maxCostUsdPerHour'>;
  createdAt?: string;
}

/**
 * Computes indexes/features for already-governed memory records. This adapter
 * cannot admit, approve, modify or delete a memory.
 */
export function memoryMaintenanceComputeDraft(
  input: MemoryMaintenanceComputeInput,
): ComputeWorkloadDraft {
  return {
    id: `compute:memory:${input.jobId}`,
    source: 'memory',
    kind: input.operation === 'embedding' ? 'embedding' : 'memory-index',
    authority: {
      system: 'memory-maintenance-job',
      jobId: input.jobId,
      idempotencyKey: input.idempotencyKey,
    },
    resourceProfileId: input.profileId,
    requestedPriority: input.requestedPriority,
    constraints: {
      sensitiveData: true,
      maxCostUsdPerHour: input.constraints?.maxCostUsdPerHour,
    },
    dataLocalityKeys: unique([
      ...(input.memoryIds ?? []).map((id) => `memory:${id}`),
      ...(input.sourceAssetIds ?? []).map((id) => `asset:${id}`),
    ]),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
