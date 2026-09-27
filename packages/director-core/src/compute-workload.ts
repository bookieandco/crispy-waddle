import type {
  ComputeAuthorityBinding,
  ComputeExecutionConstraints,
  ComputeWorkloadDraft,
  ComputeWorkloadKind,
} from '@jhadina/compute-core';
import type { GenerationTask } from './generation-task.js';
import type { GenerationModality } from './generation-registry.js';
import type { StudioRenderInput } from './studio-render.js';
import type { VideoConditionedFoleyRequest } from './foley-generation.js';
import type {
  SoundtrackGenerationBrief,
  SpeechPerformancePlan,
} from './creative-audio-generation.js';
import type {
  CharacterDatasetGenerationPlan,
  CharacterLoraTrainingRequest,
} from './character-training-pipeline.js';
import type { VideoUpscalePlan } from './video-upscale-finishing.js';

export type DirectorComputeBinding = {
  profileId: string;
  authority: ComputeAuthorityBinding;
  requestedPriority?: number;
  constraints?: ComputeExecutionConstraints;
  createdAt?: string;
};

export type DirectorGenerationComputeOptions = Omit<DirectorComputeBinding, 'authority'>;

function kindForModality(modality: GenerationModality): ComputeWorkloadKind {
  switch (modality) {
    case 'image':
      return 'image-generation';
    case 'video':
    case 'motion':
      return 'video-generation';
    case 'audio':
      return 'audio-generation';
    case '3d':
      return 'three-d';
    case 'subtitle':
      return 'batch-analysis';
  }
}

function locality(...keys: Array<string | undefined>): string[] {
  return [...new Set(keys.filter((key): key is string => Boolean(key?.trim())))];
}

function defaultDirectorConstraints(
  constraints?: ComputeExecutionConstraints,
): ComputeExecutionConstraints {
  return {
    ...constraints,
    sensitiveData: constraints?.sensitiveData ?? true,
  };
}

function assertProjectAuthority(projectId: string, authority: ComputeAuthorityBinding): void {
  if (authority.projectId !== undefined && authority.projectId !== projectId) {
    throw new Error('DIRECTOR_COMPUTE_AUTHORITY_PROJECT_MISMATCH');
  }
}

function draftFromBinding(input: {
  id: string;
  kind: ComputeWorkloadKind;
  projectId: string;
  binding: DirectorComputeBinding;
  localityKeys: readonly string[];
}): ComputeWorkloadDraft {
  assertProjectAuthority(input.projectId, input.binding.authority);
  return {
    id: input.id,
    source: 'director',
    kind: input.kind,
    authority: { ...input.binding.authority, projectId: input.projectId },
    resourceProfileId: input.binding.profileId,
    requestedPriority: input.binding.requestedPriority,
    constraints: defaultDirectorConstraints(input.binding.constraints),
    dataLocalityKeys: [...new Set(input.localityKeys)],
    createdAt: input.binding.createdAt ?? new Date().toISOString(),
  };
}

export function directorGenerationComputeDraft(
  task: GenerationTask,
  options: DirectorGenerationComputeOptions,
): ComputeWorkloadDraft {
  return {
    id: `compute:${task.id}`,
    source: 'director',
    kind: kindForModality(task.request.modality),
    authority: {
      system: 'director-generation',
      jobId: task.id,
      idempotencyKey: task.idempotencyKey,
      projectId: task.projectId,
    },
    resourceProfileId: options.profileId,
    requestedPriority: options.requestedPriority,
    constraints: defaultDirectorConstraints(options.constraints),
    dataLocalityKeys: locality(
      `model:${task.request.model.id}`,
      ...(task.request.references ?? []).map((reference) => `asset:${reference.assetId}`),
      ...(task.request.loras ?? []).map(({ lora }) => `lora:${lora.id}`),
    ),
    createdAt: options.createdAt ?? task.createdAt,
  };
}

export function directorRenderComputeDraft(
  input: StudioRenderInput,
  projectId: string,
  binding: DirectorComputeBinding,
): ComputeWorkloadDraft {
  return draftFromBinding({
    id: `compute:${binding.authority.jobId}:render`,
    kind: 'render',
    projectId,
    binding,
    localityKeys: locality(
      `asset:${input.sourceAssetId}`,
      `asset:${input.compositeAssetId}`,
      `asset:${input.voiceSyncArtifactId}`,
      `asset:${input.animationAssetId}`,
      `asset:${input.physicsAssetId}`,
      input.continuityRef ? `continuity:${input.continuityRef}` : undefined,
    ),
  });
}

export function directorFoleyComputeDraft(
  request: VideoConditionedFoleyRequest,
  binding: DirectorComputeBinding,
): ComputeWorkloadDraft {
  return draftFromBinding({
    id: `compute:${binding.authority.jobId}:foley`,
    kind: 'foley-generation',
    projectId: request.projectId,
    binding,
    localityKeys: locality(
      `asset:${request.sourceVideoAssetId}`,
      request.referenceAudioAssetId ? `asset:${request.referenceAudioAssetId}` : undefined,
    ),
  });
}

export function directorSoundtrackComputeDraft(
  brief: SoundtrackGenerationBrief,
  binding: DirectorComputeBinding,
): ComputeWorkloadDraft {
  return draftFromBinding({
    id: `compute:${binding.authority.jobId}:soundtrack`,
    kind: 'audio-generation',
    projectId: brief.projectId,
    binding,
    localityKeys: locality(
      brief.sourceVideoAssetId ? `asset:${brief.sourceVideoAssetId}` : undefined,
    ),
  });
}

export function directorSpeechComputeDraft(
  plan: SpeechPerformancePlan,
  binding: DirectorComputeBinding,
): ComputeWorkloadDraft {
  return draftFromBinding({
    id: `compute:${binding.authority.jobId}:speech`,
    kind: 'voice-generation',
    projectId: plan.projectId,
    binding,
    localityKeys: locality(
      `character:${plan.characterId}`,
      `voice:${plan.voiceIdentityId}`,
      `voice-variant:${plan.voiceVariantId}`,
    ),
  });
}

export function directorCharacterDatasetComputeDraft(
  plan: CharacterDatasetGenerationPlan,
  binding: DirectorComputeBinding,
): ComputeWorkloadDraft {
  return draftFromBinding({
    id: `compute:${binding.authority.jobId}:dataset`,
    kind: 'image-generation',
    projectId: plan.projectId,
    binding,
    localityKeys: locality(
      `asset:${plan.canonicalAssetId}`,
      ...plan.tasks.flatMap((task) => task.sourceAssetIds.map((assetId) => `asset:${assetId}`)),
      `character:${plan.characterId}`,
    ),
  });
}

export function directorLoraTrainingComputeDraft(
  request: CharacterLoraTrainingRequest,
  binding: DirectorComputeBinding,
): ComputeWorkloadDraft {
  return draftFromBinding({
    id: `compute:${binding.authority.jobId}:lora-train`,
    kind: 'training',
    projectId: request.projectId,
    binding,
    localityKeys: locality(
      `dataset:${request.datasetId}`,
      `model:${request.baseModel}`,
      `character:${request.characterId}`,
    ),
  });
}

export function directorVideoUpscaleComputeDraft(
  plan: VideoUpscalePlan,
  binding: DirectorComputeBinding,
): ComputeWorkloadDraft {
  return draftFromBinding({
    id: `compute:${binding.authority.jobId}:video-upscale`,
    kind: 'video-generation',
    projectId: plan.projectId,
    binding,
    localityKeys: locality(`asset:${plan.sourceAssetId}`),
  });
}
