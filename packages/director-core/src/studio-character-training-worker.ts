import type {
  CharacterDatasetExecutionAdapter,
  CharacterDatasetExecutionArtifact,
  CharacterLoraTrainingAdapter,
  CharacterLoraTrainingArtifact,
  VideoUpscaleExecutionAdapter,
  VideoUpscaleExecutionArtifact,
} from './studio-character-training.js';
import type {
  CharacterDatasetGenerationPlan,
  CharacterLoraCheckpoint,
  CharacterLoraTrainingRequest,
} from './character-training-pipeline.js';
import type { VideoUpscalePlan, VideoUpscaleResult } from './video-upscale-finishing.js';

export interface CharacterTrainingWorkerClient {
  post(path: string, body: unknown): Promise<unknown>;
}

export function createCharacterDatasetWorkerAdapter(
  client: CharacterTrainingWorkerClient,
  endpoint = '/v1/character-dataset',
): CharacterDatasetExecutionAdapter {
  return {
    name: 'character-dataset-worker',
    async generate(plan: CharacterDatasetGenerationPlan): Promise<CharacterDatasetExecutionArtifact> {
      const raw = await client.post(endpoint, plan);
      const record = object(raw, 'Character dataset worker returned invalid response');
      const candidateAssetIds = stringArray(record.candidateAssetIds, 'candidateAssetIds');
      const evidenceIds = stringArray(record.evidenceIds, 'evidenceIds');
      const artifactId = stringValue(record.artifactId, 'artifactId');
      const planId = stringValue(record.planId, 'planId');
      if (planId !== plan.id) throw new Error('Character dataset worker changed planId');
      if (!candidateAssetIds.length || !evidenceIds.length) {
        throw new Error('Character dataset worker returned incomplete output/evidence');
      }
      return {
        artifactId,
        planId,
        candidateAssetIds,
        provider: stringValue(record.provider, 'provider'),
        evidenceIds,
      };
    },
  };
}

export function createCharacterLoraTrainingWorkerAdapter(
  client: CharacterTrainingWorkerClient,
  endpoint = '/v1/character-lora/train',
): CharacterLoraTrainingAdapter {
  return {
    name: 'character-lora-worker',
    async train(request: CharacterLoraTrainingRequest): Promise<CharacterLoraTrainingArtifact> {
      const raw = await client.post(endpoint, request);
      const record = object(raw, 'Character LoRA worker returned invalid response');
      const trainingRequestId = stringValue(record.trainingRequestId, 'trainingRequestId');
      if (trainingRequestId !== request.id) {
        throw new Error('Character LoRA worker changed trainingRequestId');
      }
      const checkpointsRaw = Array.isArray(record.checkpoints) ? record.checkpoints : [];
      const checkpoints = checkpointsRaw.map((value, index) => readCheckpoint(value, request.id, index));
      const evidenceIds = stringArray(record.evidenceIds, 'evidenceIds');
      if (!checkpoints.length || !evidenceIds.length) {
        throw new Error('Character LoRA worker returned incomplete checkpoint/evidence data');
      }
      return {
        artifactId: stringValue(record.artifactId, 'artifactId'),
        trainingRequestId,
        checkpoints,
        provider: stringValue(record.provider, 'provider'),
        evidenceIds,
      };
    },
  };
}

export function createVideoUpscaleWorkerAdapter(
  client: CharacterTrainingWorkerClient,
  endpoint = '/v1/video-upscale',
): VideoUpscaleExecutionAdapter {
  return {
    name: 'video-upscale-worker',
    async upscale(plan: VideoUpscalePlan): Promise<VideoUpscaleExecutionArtifact> {
      const raw = await client.post(endpoint, plan);
      const record = object(raw, 'Video upscale worker returned invalid response');
      const result = readUpscaleResult(record.result);
      if (result.planId !== plan.id) throw new Error('Video upscale worker changed planId');
      const evidenceIds = stringArray(record.evidenceIds, 'evidenceIds');
      if (!evidenceIds.length) throw new Error('Video upscale worker returned no evidence');
      return {
        artifactId: stringValue(record.artifactId, 'artifactId'),
        provider: stringValue(record.provider, 'provider'),
        result,
        evidenceIds,
      };
    },
  };
}

function readCheckpoint(value: unknown, trainingRequestId: string, index: number): CharacterLoraCheckpoint {
  const record = object(value, `Invalid LoRA checkpoint at index ${index}`);
  const checkpoint: CharacterLoraCheckpoint = {
    id: stringValue(record.id, 'checkpoint.id'),
    trainingRequestId: stringValue(record.trainingRequestId, 'checkpoint.trainingRequestId'),
    step: numberValue(record.step, 'checkpoint.step'),
    assetUri: stringValue(record.assetUri, 'checkpoint.assetUri'),
    sha256: stringValue(record.sha256, 'checkpoint.sha256'),
    sampleIdentityScore: numberValue(record.sampleIdentityScore, 'checkpoint.sampleIdentityScore'),
    sampleQualityScore: numberValue(record.sampleQualityScore, 'checkpoint.sampleQualityScore'),
    overfitScore: numberValue(record.overfitScore, 'checkpoint.overfitScore'),
    evidenceIds: stringArray(record.evidenceIds, 'checkpoint.evidenceIds'),
  };
  if (checkpoint.trainingRequestId !== trainingRequestId) {
    throw new Error(`LoRA checkpoint ${checkpoint.id} changed training request lineage`);
  }
  if (!Number.isInteger(checkpoint.step) || checkpoint.step <= 0 || !checkpoint.evidenceIds.length) {
    throw new Error(`LoRA checkpoint ${checkpoint.id} is incomplete`);
  }
  return checkpoint;
}

function readUpscaleResult(value: unknown): VideoUpscaleResult {
  const record = object(value, 'Video upscale worker result missing');
  return {
    planId: stringValue(record.planId, 'result.planId'),
    outputAssetId: stringValue(record.outputAssetId, 'result.outputAssetId'),
    width: numberValue(record.width, 'result.width'),
    height: numberValue(record.height, 'result.height'),
    fps: numberValue(record.fps, 'result.fps'),
    frameCount: numberValue(record.frameCount, 'result.frameCount'),
    audioPreserved: booleanValue(record.audioPreserved, 'result.audioPreserved'),
    chunkArtifactIds: stringArray(record.chunkArtifactIds, 'result.chunkArtifactIds'),
    evidenceIds: stringArray(record.evidenceIds, 'result.evidenceIds'),
  };
}

function object(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid worker field: ${name}`);
  return value;
}

function numberValue(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid worker field: ${name}`);
  return value;
}

function booleanValue(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Invalid worker field: ${name}`);
  return value;
}

function stringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string' && item.trim())) {
    throw new Error(`Invalid worker field: ${name}`);
  }
  return [...value];
}
