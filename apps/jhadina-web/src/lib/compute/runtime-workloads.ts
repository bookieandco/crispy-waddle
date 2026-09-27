import type {
  ComputeAuthorityBinding,
  ComputeExecutionConstraints,
  ComputeWorkloadDraft,
  ComputeWorkloadKind,
  ComputeQueueClass,
} from '@jhadina/compute-core';
import type { WorkSessionTask } from '@jhadina/core-spine';

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


export interface WorkSessionTaskComputeInput {
  task:WorkSessionTask;
  kind:ComputeWorkloadKind;
  profileId:string;
  queue?:ComputeQueueClass;
  requestedPriority?:number;
  constraints?:ComputeExecutionConstraints;
  dataLocalityKeys?:readonly string[];
  preferredNodeIds?:readonly string[];
  forbiddenNodeIds?:readonly string[];
  nowIso?:string;
}

/**
 * ONE-RUNTIME -> Compute bridge.
 *
 * A task must already be atomically claimed by a worker. This function only
 * describes compute work; it does not authorize the task, spend money, move
 * sensitive data, or submit Kubernetes/Kueue work.
 */
export function workSessionTaskComputeDraft(
  input:WorkSessionTaskComputeInput,
):ComputeWorkloadDraft {
  const task=input.task;
  const now=Date.parse(input.nowIso??new Date().toISOString());
  if(
    task.status!=='running'||
    !task.leaseOwner?.trim()||
    !task.leaseToken?.trim()||
    !task.leaseExpiresAt||
    !Number.isFinite(now)||
    Date.parse(task.leaseExpiresAt)<=now
  ){
    throw new Error('ONE_RUNTIME_COMPUTE_TASK_ACTIVE_LEASE_REQUIRED');
  }

  return {
    id:`compute:work-session:${task.workSessionId}:${task.id}`,
    source:computeSourceForDomain(task.domain),
    kind:input.kind,
    queue:input.queue,
    authority:{
      system:'jhadina-one-runtime-task',
      jobId:task.id,
      idempotencyKey:task.idempotencyKey,
      projectId:task.workSessionId,
    },
    resourceProfileId:input.profileId,
    requestedPriority:input.requestedPriority,
    constraints:input.constraints,
    dataLocalityKeys:unique([
      `work-session:${task.workSessionId}`,
      `task:${task.id}`,
      ...task.inputRefs.map(ref=>`ref:${ref}`),
      ...(input.dataLocalityKeys??[]),
    ]),
    preferredNodeIds:input.preferredNodeIds?[...new Set(input.preferredNodeIds)]:undefined,
    forbiddenNodeIds:input.forbiddenNodeIds?[...new Set(input.forbiddenNodeIds)]:undefined,
    createdAt:task.updatedAt,
  };
}

function computeSourceForDomain(domain:string):ComputeWorkloadDraft['source']{
  switch(domain){
    case 'jllm':return 'jllm';
    case 'director':return 'director';
    case 'social':return 'social';
    case 'growth':return 'growth';
    case 'pupsonstuff':return 'pupsonstuff';
    case 'pod':return 'pod';
    case 'music':return 'music';
    case 'memory':return 'memory';
    case 'homebase':return 'homebase';
    default:return 'other';
  }
}
