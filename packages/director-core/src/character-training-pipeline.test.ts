import { describe, expect, it } from 'vitest';
import { GenerationRegistry } from './generation-registry.js';
import {
  curateCharacterDataset,
  planCharacterDatasetGeneration,
  promoteCharacterLora,
  selectCharacterLoraCheckpoint,
  validateCharacterLoraTrainingRequest,
  validateCharacterTrainingDataset,
  type CharacterDatasetCandidate,
  type CharacterTrainingDataset,
} from './character-training-pipeline.js';

const policy = {
  minimumItems: 4,
  maximumItems: 24,
  minimumIdentityScore: 0.85,
  minimumAnatomyScore: 0.8,
  minimumQualityScore: 0.8,
  minimumUpscaleIdentitySimilarity: 0.9,
  minimumUpscaleQualityScore: 0.85,
  requireViews: ['front', 'profile-left', 'profile-right', 'full-body'] as const,
  requireKinds: ['angle', 'expression', 'pose'] as const,
  maximumPerDuplicateGroup: 2,
};

function candidate(
  id: string,
  overrides: Partial<CharacterDatasetCandidate> = {},
): CharacterDatasetCandidate {
  return {
    id,
    characterId: 'mary',
    assetId: `asset:${id}`,
    sha256: `sha:${id}`,
    kind: 'angle',
    view: 'front',
    parentAssetIds: ['asset:mary-canonical'],
    identityScore: 0.95,
    anatomyScore: 0.92,
    qualityScore: 0.9,
    evidenceIds: [`qa:${id}`],
    ...overrides,
  };
}

function dataset(): CharacterTrainingDataset {
  const items = [
    candidate('front', { view: 'front', duplicateGroup: 'front' }),
    candidate('left', { view: 'profile-left' }),
    candidate('right', { view: 'profile-right' }),
    candidate('body', { view: 'full-body', kind: 'pose' }),
    candidate('smile', { kind: 'expression', expression: 'smile' }),
  ];

  return {
    id: 'dataset:mary:v1',
    projectId: 'movie-1',
    characterId: 'mary',
    continuityRef: 'character:mary:v1',
    triggerWord: 'MARYX7',
    sourceReferenceAssetIds: ['asset:mary-canonical'],
    items,
    captions: items.map((item) => ({
      datasetItemId: item.id,
      triggerWord: 'MARYX7',
      caption: `MARYX7, ${item.kind}, ${item.view ?? 'close portrait'}`,
      evidenceIds: [`caption:${item.id}`],
    })),
    upscales: items.map((item) => ({
      datasetItemId: item.id,
      sourceAssetId: item.assetId,
      upscaledAssetId: `upscaled:${item.id}`,
      sourceSha256: item.sha256,
      upscaledSha256: `upscaled-sha:${item.id}`,
      scaleFactor: 2,
      identitySimilarity: 0.95,
      qualityScore: 0.93,
      fidelityBias: 0.9,
      evidenceIds: [`upscale:${item.id}`],
    })),
    rejectedItemIds: ['candidate:bad-hands'],
    authority: 'DIRECTOR_CHARACTER_DATASET',
  };
}

describe('character training pipeline', () => {
  it('plans multi-view, expression, pose-transfer, wardrobe and environment coverage from one canonical asset', () => {
    const plan = planCharacterDatasetGeneration({
      id: 'dataset-plan:mary',
      projectId: 'movie-1',
      characterId: 'mary',
      continuityRef: 'character:mary:v1',
      canonicalAssetId: 'asset:mary-face',
      triggerWord: 'MARYX7',
      targetViews: ['front', 'profile-left', 'profile-right', 'full-body'],
      expressions: ['smile', 'surprised'],
      poseReferences: [{
        id: 'pose:walk',
        assetId: 'asset:pose-walk',
        label: 'walking profile',
        evidenceIds: ['pose:source'],
      }],
      wardrobeReferences: [{
        id: 'wardrobe:winter',
        assetId: 'asset:winter-coat',
        label: 'gray winter coat',
        evidenceIds: ['wardrobe:source'],
      }],
      styleIntent: 'cinematic photorealism',
      includeEnvironmentProbes: true,
      evidenceIds: ['character:approved'],
    });

    expect(plan.stages).toEqual([
      'generate',
      'curate',
      'caption',
      'upscale',
      'optional-train-lora',
    ]);
    expect(plan.tasks.map((task) => task.kind)).toEqual(expect.arrayContaining([
      'angle',
      'expression',
      'pose',
      'wardrobe',
      'environment',
    ]));
    const pose = plan.tasks.find((task) => task.kind === 'pose');
    const wardrobe = plan.tasks.find((task) => task.kind === 'wardrobe');
    expect(pose?.sourceAssetIds).toEqual(['asset:mary-face', 'asset:pose-walk']);
    expect(wardrobe?.sourceAssetIds).toEqual(['asset:mary-face', 'asset:winter-coat']);
    expect(plan.authority).toBe('DIRECTOR_CHARACTER_DATASET_PLAN');
  });

  it('fails dataset planning when pose references have no provenance', () => {
    expect(() => planCharacterDatasetGeneration({
      id: 'dataset-plan:invalid',
      projectId: 'movie-1',
      characterId: 'mary',
      continuityRef: 'character:mary:v1',
      canonicalAssetId: 'asset:mary-face',
      triggerWord: 'MARYX7',
      targetViews: ['front'],
      expressions: [],
      poseReferences: [{
        id: 'pose:bad',
        assetId: 'asset:pose-bad',
        label: 'bad pose',
        evidenceIds: [],
      }],
      evidenceIds: ['character:approved'],
    })).toThrow('DIRECTOR_CHARACTER_DATASET_POSE_REFERENCE_INVALID:pose:bad');
  });

  it('validates a curated multi-view, pose and expression dataset with captions/upscales', () => {
    expect(validateCharacterTrainingDataset(dataset(), policy)).toEqual([]);
  });

  it('rejects accepted images when the trigger word is missing from captions', () => {
    const invalid = dataset();
    invalid.captions = invalid.captions.map((caption) =>
      caption.datasetItemId === 'left'
        ? { ...caption, caption: 'profile portrait with neutral light' }
        : caption,
    );
    expect(validateCharacterTrainingDataset(invalid, policy)).toContain(
      'DIRECTOR_CHARACTER_DATASET_TRIGGER_WORD_MISSING:left',
    );
  });

  it('rejects identity drift introduced by upscaling', () => {
    const invalid = dataset();
    invalid.upscales = invalid.upscales.map((upscale) =>
      upscale.datasetItemId === 'right'
        ? { ...upscale, identitySimilarity: 0.6 }
        : upscale,
    );
    expect(validateCharacterTrainingDataset(invalid, policy)).toContain(
      'DIRECTOR_CHARACTER_DATASET_UPSCALE_IDENTITY_LOW:right',
    );
  });

  it('curates weird and duplicate-heavy candidates before training', () => {
    const candidates = [
      candidate('front-a', { duplicateGroup: 'front-close' }),
      candidate('front-b', { duplicateGroup: 'front-close', identityScore: 0.94 }),
      candidate('front-c', { duplicateGroup: 'front-close', identityScore: 0.93 }),
      candidate('bad-hands', { anatomyScore: 0.4 }),
      candidate('side', { view: 'profile-left' }),
    ];
    const result = curateCharacterDataset(candidates, policy);
    expect(result.accepted.map((item) => item.id)).toEqual(expect.arrayContaining(['front-a', 'front-b', 'side']));
    expect(result.rejected.map((item) => item.id)).toEqual(expect.arrayContaining(['front-c', 'bad-hands']));
  });

  it('does not assume the final training checkpoint is the best checkpoint', () => {
    const selected = selectCharacterLoraCheckpoint([
      {
        id: 'step-500',
        trainingRequestId: 'train:mary',
        step: 500,
        assetUri: 'asset://mary-500.safetensors',
        sha256: 'sha-500',
        sampleIdentityScore: 0.9,
        sampleQualityScore: 0.88,
        overfitScore: 0.08,
        evidenceIds: ['sample:500'],
      },
      {
        id: 'step-1000',
        trainingRequestId: 'train:mary',
        step: 1000,
        assetUri: 'asset://mary-1000.safetensors',
        sha256: 'sha-1000',
        sampleIdentityScore: 0.96,
        sampleQualityScore: 0.94,
        overfitScore: 0.38,
        evidenceIds: ['sample:1000'],
      },
    ], {
      minimumIdentityScore: 0.85,
      minimumQualityScore: 0.8,
      maximumOverfitScore: 0.2,
    });

    expect(selected?.id).toBe('step-500');
  });

  it('promotes an approved checkpoint into the existing LoRA registry contract', () => {
    const request = {
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
      samplePrompts: ['MARYX7 holding coffee', 'MARYX7 walking through a hangar'],
      evidenceIds: ['dataset:approved', 'training-config:approved'],
    };
    expect(validateCharacterLoraTrainingRequest(request)).toEqual([]);

    const checkpoint = {
      id: 'step-1000',
      trainingRequestId: request.id,
      step: 1000,
      assetUri: 'asset://mary-1000.safetensors',
      sha256: 'sha-1000',
      sampleIdentityScore: 0.95,
      sampleQualityScore: 0.93,
      overfitScore: 0.1,
      evidenceIds: ['samples:1000'],
    };

    const promoted = promoteCharacterLora(request, checkpoint);
    const registry = new GenerationRegistry();
    registry.registerProvider({
      id: 'local',
      name: 'Local',
      kind: 'local',
      capabilities: ['text-to-image', 'text-to-video'],
      models: [],
      health: 'healthy',
    });
    registry.registerModel({
      id: 'video-base',
      providerId: 'local',
      name: 'Video Base',
      version: '2.1',
      modalities: ['image', 'video'],
      capabilities: ['text-to-image', 'text-to-video'],
      baseModel: 'video-base-2.1',
    });
    registry.registerLoRA(promoted.lora);

    expect(registry.compatibleLoRAs('video-base').map((lora) => lora.id)).toContain(promoted.lora.id);
    expect(promoted.lora.triggerWords).toEqual(['MARYX7']);
    expect(promoted.authority).toBe('DIRECTOR_CHARACTER_LORA_PROMOTION');
  });
});
