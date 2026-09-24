import { describe, expect, it, vi } from 'vitest';
import { planCharacterDatasetGeneration } from './character-training-pipeline.js';
import {
  createCharacterDatasetExecutionProvider,
  createCharacterLoraTrainingProvider,
  createVideoUpscaleExecutionProvider,
} from './studio-character-training.js';
import {
  createCharacterDatasetWorkerAdapter,
  createCharacterLoraTrainingWorkerAdapter,
  createVideoUpscaleWorkerAdapter,
} from './studio-character-training-worker.js';
import { planChunkedVideoUpscale } from './video-upscale-finishing.js';
import type { DirectorStudioAction } from './studio-governed-action.js';

function datasetPlan() {
  return planCharacterDatasetGeneration({
    id: 'dataset-plan:mary',
    projectId: 'movie-1',
    characterId: 'mary',
    continuityRef: 'character:mary:v1',
    canonicalAssetId: 'asset:mary-face',
    triggerWord: 'MARYX7',
    targetViews: ['front', 'profile-left'],
    expressions: ['smile'],
    poseReferences: [{
      id: 'pose:walk',
      assetId: 'asset:pose-walk',
      label: 'walking',
      evidenceIds: ['pose:evidence'],
    }],
    evidenceIds: ['character:approved'],
  });
}

function trainingRequest() {
  return {
    id: 'train:mary',
    projectId: 'movie-1',
    characterId: 'mary',
    continuityRef: 'character:mary:v1',
    datasetId: 'dataset:mary:v1',
    triggerWord: 'MARYX7',
    baseModel: 'video-base-2.1',
    modalities: ['image', 'video'] as const,
    executionTarget: 'remote-gpu' as const,
    maxTrainingResolution: 512,
    saveEverySteps: 500,
    sampleEverySteps: 500,
    samplePrompts: ['MARYX7 portrait', 'MARYX7 walking'],
    evidenceIds: ['dataset:approved'],
  };
}

function upscalePlan() {
  return planChunkedVideoUpscale({
    id: 'upscale:shot-1',
    projectId: 'movie-1',
    sourceAssetId: 'render:1080p',
    sourceWidth: 1920,
    sourceHeight: 1080,
    targetWidth: 3840,
    targetHeight: 2160,
    fps: 24,
    frameCount: 120,
    maxFramesPerChunk: 30,
  });
}

describe('governed character training Studio providers', () => {
  it('executes a dataset plan only when all governed reference inputs are declared', async () => {
    const plan = datasetPlan();
    const generate = vi.fn(async () => ({
      artifactId: 'artifact:dataset',
      planId: plan.id,
      candidateAssetIds: ['candidate:1', 'candidate:2'],
      provider: 'local-comfy',
      evidenceIds: ['worker:receipt'],
    }));
    const provider = createCharacterDatasetExecutionProvider({ name: 'dataset', generate });
    const action: DirectorStudioAction = {
      projectId: 'movie-1',
      capability: 'character-dataset',
      inputAssetIds: ['asset:mary-face', 'asset:pose-walk'],
      parameters: { plan },
    };

    const result = await provider.execute(action, {} as any);
    expect(result.outputAssetIds).toEqual(['artifact:dataset', 'candidate:1', 'candidate:2']);
    expect(result.evidenceIds).toEqual(expect.arrayContaining([
      'character-dataset-provider:local-comfy',
      'character-dataset-plan:dataset-plan:mary',
      'continuity:character:mary:v1',
    ]));
    expect(generate).toHaveBeenCalledWith(plan);
  });

  it('fails closed if a pose/wardrobe reference is omitted from governed inputs', async () => {
    const plan = datasetPlan();
    const provider = createCharacterDatasetExecutionProvider({
      name: 'dataset',
      generate: vi.fn(),
    });
    await expect(provider.execute({
      projectId: 'movie-1',
      capability: 'character-dataset',
      inputAssetIds: ['asset:mary-face'],
      parameters: { plan },
    }, {} as any)).rejects.toThrow('asset:pose-walk');
  });

  it('selects an admissible intermediate LoRA checkpoint instead of auto-promoting the latest', async () => {
    const request = trainingRequest();
    const provider = createCharacterLoraTrainingProvider({
      name: 'trainer',
      train: vi.fn(async () => ({
        artifactId: 'artifact:train',
        trainingRequestId: request.id,
        provider: 'remote-gpu',
        evidenceIds: ['training:receipt'],
        checkpoints: [
          {
            id: 'step-500',
            trainingRequestId: request.id,
            step: 500,
            assetUri: 'asset://step-500.safetensors',
            sha256: 'sha-500',
            sampleIdentityScore: 0.92,
            sampleQualityScore: 0.9,
            overfitScore: 0.08,
            evidenceIds: ['sample:500'],
          },
          {
            id: 'step-1000',
            trainingRequestId: request.id,
            step: 1000,
            assetUri: 'asset://step-1000.safetensors',
            sha256: 'sha-1000',
            sampleIdentityScore: 0.98,
            sampleQualityScore: 0.95,
            overfitScore: 0.42,
            evidenceIds: ['sample:1000'],
          },
        ],
      })),
    });

    const result = await provider.execute({
      projectId: 'movie-1',
      capability: 'lora-train',
      inputAssetIds: [request.datasetId],
      parameters: {
        trainingRequest: request,
        checkpointPolicy: {
          minimumIdentityScore: 0.85,
          minimumQualityScore: 0.8,
          maximumOverfitScore: 0.2,
        },
      },
    }, {} as any);

    expect(result.outputAssetIds).toEqual(expect.arrayContaining([
      'artifact:train',
      'step-500',
      'character:mary:lora:step-500',
    ]));
    expect(result.outputAssetIds).not.toContain('step-1000');
    expect(result.evidenceIds).toContain('lora-checkpoint:step-500');
  });

  it('rejects a LoRA trainer that changes training-request lineage', async () => {
    const request = trainingRequest();
    const provider = createCharacterLoraTrainingProvider({
      name: 'trainer',
      train: vi.fn(async () => ({
        artifactId: 'artifact:train',
        trainingRequestId: 'train:someone-else',
        provider: 'remote-gpu',
        evidenceIds: ['training:receipt'],
        checkpoints: [],
      })),
    });

    await expect(provider.execute({
      projectId: 'movie-1',
      capability: 'lora-train',
      inputAssetIds: [request.datasetId],
      parameters: {
        trainingRequest: request,
        checkpointPolicy: {
          minimumIdentityScore: 0.85,
          minimumQualityScore: 0.8,
          maximumOverfitScore: 0.2,
        },
      },
    }, {} as any)).rejects.toThrow('changed governed training request identity');
  });

  it('rejects a 4K worker result that changes governed frame timing', async () => {
    const plan = upscalePlan();
    const provider = createVideoUpscaleExecutionProvider({
      name: 'upscale',
      upscale: vi.fn(async () => ({
        artifactId: 'artifact:upscale',
        provider: 'upscale-worker',
        evidenceIds: ['upscale:receipt'],
        result: {
          planId: plan.id,
          outputAssetId: 'render:4k',
          width: 3840,
          height: 2160,
          fps: 24,
          frameCount: 119,
          audioPreserved: true,
          chunkArtifactIds: plan.chunks.map(chunk => `artifact:${chunk.id}`),
          evidenceIds: ['probe:4k'],
        },
      })),
    });

    await expect(provider.execute({
      projectId: 'movie-1',
      capability: 'video-upscale',
      inputAssetIds: [plan.sourceAssetId],
      parameters: { plan },
    }, {} as any)).rejects.toThrow('DIRECTOR_UPSCALE_RESULT_FRAME_COUNT_MISMATCH');
  });
});

describe('character training worker adapters', () => {
  it('forwards the exact dataset plan and rejects a changed plan id', async () => {
    const plan = datasetPlan();
    const post = vi.fn(async () => ({
      artifactId: 'artifact:dataset',
      planId: 'wrong-plan',
      candidateAssetIds: ['candidate:1'],
      provider: 'worker',
      evidenceIds: ['receipt'],
    }));
    const adapter = createCharacterDatasetWorkerAdapter({ post });
    await expect(adapter.generate(plan)).rejects.toThrow('changed planId');
    expect(post).toHaveBeenCalledWith('/v1/character-dataset', plan);
  });

  it('rejects checkpoints that belong to another training request', async () => {
    const request = trainingRequest();
    const adapter = createCharacterLoraTrainingWorkerAdapter({
      post: vi.fn(async () => ({
        artifactId: 'artifact:train',
        trainingRequestId: request.id,
        provider: 'worker',
        evidenceIds: ['receipt'],
        checkpoints: [{
          id: 'step-500',
          trainingRequestId: 'train:other',
          step: 500,
          assetUri: 'asset://step-500',
          sha256: 'sha',
          sampleIdentityScore: 0.9,
          sampleQualityScore: 0.9,
          overfitScore: 0.1,
          evidenceIds: ['sample'],
        }],
      })),
    });
    await expect(adapter.train(request)).rejects.toThrow('changed training request lineage');
  });

  it('preserves the exact upscale plan identity through the worker', async () => {
    const plan = upscalePlan();
    const post = vi.fn(async () => ({
      artifactId: 'artifact:upscale',
      provider: 'worker',
      evidenceIds: ['receipt'],
      result: {
        planId: plan.id,
        outputAssetId: 'render:4k',
        width: plan.targetWidth,
        height: plan.targetHeight,
        fps: plan.fps,
        frameCount: plan.frameCount,
        audioPreserved: true,
        chunkArtifactIds: plan.chunks.map(chunk => `artifact:${chunk.id}`),
        evidenceIds: ['probe'],
      },
    }));
    const adapter = createVideoUpscaleWorkerAdapter({ post });
    const artifact = await adapter.upscale(plan);
    expect(artifact.result.frameCount).toBe(plan.frameCount);
    expect(post).toHaveBeenCalledWith('/v1/video-upscale', plan);
  });
});
