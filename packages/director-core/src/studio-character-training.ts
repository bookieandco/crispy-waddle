import type { ActionRequest } from '@jhadina/action-core';
import type {
  CharacterDatasetGenerationPlan,
  CharacterLoraCheckpoint,
  CharacterLoraCheckpointPolicy,
  CharacterLoraTrainingRequest,
  CharacterLoraPromotion,
} from './character-training-pipeline.js';
import {
  promoteCharacterLora,
  selectCharacterLoraCheckpoint,
  validateCharacterLoraTrainingRequest,
} from './character-training-pipeline.js';
import type { DirectorStudioAction, DirectorStudioCapabilityProvider } from './studio-governed-action.js';
import type { VideoUpscalePlan, VideoUpscaleResult } from './video-upscale-finishing.js';
import {
  validateVideoUpscalePlan,
  validateVideoUpscaleResult,
} from './video-upscale-finishing.js';

export interface CharacterDatasetExecutionArtifact {
  artifactId: string;
  planId: string;
  candidateAssetIds: readonly string[];
  provider: string;
  evidenceIds: readonly string[];
}

export interface CharacterDatasetExecutionAdapter {
  readonly name: string;
  generate(plan: CharacterDatasetGenerationPlan): Promise<CharacterDatasetExecutionArtifact>;
}

export interface CharacterLoraTrainingArtifact {
  artifactId: string;
  trainingRequestId: string;
  checkpoints: readonly CharacterLoraCheckpoint[];
  provider: string;
  evidenceIds: readonly string[];
}

export interface CharacterLoraTrainingAdapter {
  readonly name: string;
  train(request: CharacterLoraTrainingRequest): Promise<CharacterLoraTrainingArtifact>;
}

export interface VideoUpscaleExecutionArtifact {
  artifactId: string;
  provider: string;
  result: VideoUpscaleResult;
  evidenceIds: readonly string[];
}

export interface VideoUpscaleExecutionAdapter {
  readonly name: string;
  upscale(plan: VideoUpscalePlan): Promise<VideoUpscaleExecutionArtifact>;
}

export function createCharacterDatasetExecutionProvider(
  adapter: CharacterDatasetExecutionAdapter,
): DirectorStudioCapabilityProvider {
  return {
    supports: capability => capability === 'character-dataset',
    async execute(action: DirectorStudioAction, _request: ActionRequest<DirectorStudioAction>) {
      if (action.capability !== 'character-dataset') {
        throw new Error('Character dataset provider received wrong capability');
      }
      const plan = readDatasetPlan(action);
      const artifact = await adapter.generate(plan);
      if (artifact.planId !== plan.id) {
        throw new Error('Character dataset worker changed governed plan identity');
      }
      if (!artifact.artifactId.trim() || !artifact.candidateAssetIds.length || !artifact.evidenceIds.length) {
        throw new Error('Character dataset worker returned incomplete evidence');
      }
      return {
        capability: 'character-dataset',
        projectId: action.projectId,
        outputAssetIds: [artifact.artifactId, ...artifact.candidateAssetIds],
        evidenceIds: [
          ...artifact.evidenceIds,
          `character-dataset-provider:${artifact.provider}`,
          `character-dataset-plan:${plan.id}`,
          `character-dataset-task-count:${plan.tasks.length}`,
          `continuity:${plan.continuityRef}`,
        ],
      };
    },
  };
}

export function createCharacterLoraTrainingProvider(
  adapter: CharacterLoraTrainingAdapter,
): DirectorStudioCapabilityProvider {
  return {
    supports: capability => capability === 'lora-train',
    async execute(action: DirectorStudioAction, _request: ActionRequest<DirectorStudioAction>) {
      if (action.capability !== 'lora-train') {
        throw new Error('Character LoRA training provider received wrong capability');
      }
      const { trainingRequest, checkpointPolicy } = readTrainingInput(action);
      const artifact = await adapter.train(trainingRequest);
      if (artifact.trainingRequestId !== trainingRequest.id) {
        throw new Error('Character LoRA trainer changed governed training request identity');
      }
      if (!artifact.artifactId.trim() || !artifact.checkpoints.length || !artifact.evidenceIds.length) {
        throw new Error('Character LoRA trainer returned incomplete evidence');
      }
      const selected = selectCharacterLoraCheckpoint(artifact.checkpoints, checkpointPolicy);
      if (!selected) {
        throw new Error('Character LoRA training produced no admissible checkpoint');
      }
      const promotion = promoteCharacterLora(trainingRequest, selected);
      return loraTrainingResult(action.projectId, artifact, promotion);
    },
  };
}

export function createVideoUpscaleExecutionProvider(
  adapter: VideoUpscaleExecutionAdapter,
): DirectorStudioCapabilityProvider {
  return {
    supports: capability => capability === 'video-upscale',
    async execute(action: DirectorStudioAction, _request: ActionRequest<DirectorStudioAction>) {
      if (action.capability !== 'video-upscale') {
        throw new Error('Video upscale provider received wrong capability');
      }
      const plan = readUpscalePlan(action);
      const artifact = await adapter.upscale(plan);
      const reasons = validateVideoUpscaleResult(plan, artifact.result);
      if (reasons.length) {
        throw new Error(`Video upscale worker violated governed result contract: ${reasons.join(', ')}`);
      }
      if (!artifact.artifactId.trim() || !artifact.evidenceIds.length) {
        throw new Error('Video upscale worker returned incomplete evidence');
      }
      return {
        capability: 'video-upscale',
        projectId: action.projectId,
        outputAssetIds: [artifact.result.outputAssetId, artifact.artifactId, ...artifact.result.chunkArtifactIds],
        evidenceIds: [
          ...artifact.evidenceIds,
          ...artifact.result.evidenceIds,
          `video-upscale-provider:${artifact.provider}`,
          `video-upscale-plan:${plan.id}`,
          `video-upscale-target:${plan.targetWidth}x${plan.targetHeight}`,
          `video-upscale-chunks:${plan.chunks.length}`,
        ],
      };
    },
  };
}

function readDatasetPlan(action: DirectorStudioAction): CharacterDatasetGenerationPlan {
  const raw = action.parameters?.plan;
  if (!raw || typeof raw !== 'object') {
    throw new Error('Character dataset action requires a generation plan');
  }
  const plan = raw as CharacterDatasetGenerationPlan;
  if (
    plan.authority !== 'DIRECTOR_CHARACTER_DATASET_PLAN' ||
    !plan.id?.trim() ||
    !plan.projectId?.trim() ||
    !plan.characterId?.trim() ||
    !plan.continuityRef?.trim() ||
    !plan.canonicalAssetId?.trim() ||
    !Array.isArray(plan.tasks) ||
    !plan.tasks.length
  ) {
    throw new Error('Invalid character dataset generation plan');
  }
  if (plan.projectId !== action.projectId) {
    throw new Error('Character dataset plan project mismatch');
  }
  const declaredInputs = new Set(action.inputAssetIds);
  const requiredInputs = new Set([
    plan.canonicalAssetId,
    ...plan.tasks.flatMap(task => task.sourceAssetIds),
  ]);
  for (const assetId of requiredInputs) {
    if (!declaredInputs.has(assetId)) {
      throw new Error(`Character dataset action missing governed input asset: ${assetId}`);
    }
  }
  return plan;
}

function readTrainingInput(action: DirectorStudioAction): {
  trainingRequest: CharacterLoraTrainingRequest;
  checkpointPolicy: CharacterLoraCheckpointPolicy;
} {
  const rawRequest = action.parameters?.trainingRequest;
  const rawPolicy = action.parameters?.checkpointPolicy;
  if (!rawRequest || typeof rawRequest !== 'object') {
    throw new Error('LoRA training action requires a trainingRequest');
  }
  if (!rawPolicy || typeof rawPolicy !== 'object') {
    throw new Error('LoRA training action requires a checkpointPolicy');
  }
  const trainingRequest = rawRequest as CharacterLoraTrainingRequest;
  const errors = validateCharacterLoraTrainingRequest(trainingRequest);
  if (errors.length) {
    throw new Error(`Invalid Character LoRA training request: ${errors.join('; ')}`);
  }
  if (trainingRequest.projectId !== action.projectId) {
    throw new Error('Character LoRA training project mismatch');
  }
  if (!action.inputAssetIds.includes(trainingRequest.datasetId)) {
    throw new Error('Character LoRA training action missing governed dataset input');
  }
  const candidate = rawPolicy as Record<string, unknown>;
  const checkpointPolicy: CharacterLoraCheckpointPolicy = {
    minimumIdentityScore: readScore(candidate.minimumIdentityScore, 'minimumIdentityScore'),
    minimumQualityScore: readScore(candidate.minimumQualityScore, 'minimumQualityScore'),
    maximumOverfitScore: readScore(candidate.maximumOverfitScore, 'maximumOverfitScore'),
  };
  return { trainingRequest, checkpointPolicy };
}

function readUpscalePlan(action: DirectorStudioAction): VideoUpscalePlan {
  const raw = action.parameters?.plan;
  if (!raw || typeof raw !== 'object') throw new Error('Video upscale action requires a plan');
  const plan = raw as VideoUpscalePlan;
  const reasons = validateVideoUpscalePlan(plan);
  if (reasons.length) throw new Error(`Invalid video upscale plan: ${reasons.join('; ')}`);
  if (plan.projectId !== action.projectId) throw new Error('Video upscale plan project mismatch');
  if (!action.inputAssetIds.includes(plan.sourceAssetId)) {
    throw new Error('Video upscale action missing governed source asset');
  }
  return plan;
}

function loraTrainingResult(
  projectId: string,
  artifact: CharacterLoraTrainingArtifact,
  promotion: CharacterLoraPromotion,
) {
  return {
    capability: 'lora-train' as const,
    projectId,
    outputAssetIds: [
      artifact.artifactId,
      promotion.checkpoint.id,
      promotion.lora.id,
    ],
    evidenceIds: [
      ...artifact.evidenceIds,
      ...promotion.checkpoint.evidenceIds,
      `lora-training-provider:${artifact.provider}`,
      `lora-checkpoint:${promotion.checkpoint.id}`,
      `lora-candidate:${promotion.lora.id}`,
      `lora-base-model:${promotion.lora.baseModel}`,
    ],
  };
}

function readScore(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`Invalid LoRA checkpoint policy score: ${name}`);
  }
  return value;
}
