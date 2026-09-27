import { describe, expect, it } from 'vitest';
import {
  directorFoleyComputeDraft,
  directorGenerationComputeDraft,
  directorLoraTrainingComputeDraft,
  directorRenderComputeDraft,
  directorSpeechComputeDraft,
} from './compute-workload.js';
import type { GenerationTask } from './generation-task.js';

const generationTask: GenerationTask = {
  id: 'generation-1',
  projectId: 'movie-1',
  idempotencyKey: 'idem-generation-1',
  status: 'queued',
  createdAt: '2026-09-27T01:00:00.000Z',
  updatedAt: '2026-09-27T01:00:00.000Z',
  request: {
    requestId: 'generation-1',
    projectId: 'movie-1',
    modality: 'video',
    prompt: 'A coherent shot',
    model: {
      id: 'video-model-1',
      providerId: 'comfy-local',
      name: 'Video',
      version: '1',
      modalities: ['video'],
      capabilities: ['text-to-video'],
    },
    loras: [{
      lora: {
        id: 'character-lora-1',
        name: 'Character',
        version: '1',
        baseModel: 'video-model-1',
        modalities: ['video'],
        weight: { min: 0, max: 2 },
      },
    }],
    references: [{ assetId: 'scene-ref-1', role: 'image' }],
    parameters: {},
  },
};

const binding = {
  profileId: 'director.media.local',
  authority: {
    system: 'director-studio-action',
    jobId: 'action-1',
    idempotencyKey: 'action-1',
    projectId: 'movie-1',
  },
  createdAt: '2026-09-27T01:00:00.000Z',
};

describe('Director compute workload adapters', () => {
  it('binds a durable generation task without inventing cloud burst', () => {
    const draft = directorGenerationComputeDraft(generationTask, {
      profileId: 'director.video.default',
    });
    expect(draft.kind).toBe('video-generation');
    expect(draft.authority).toEqual({
      system: 'director-generation',
      jobId: 'generation-1',
      idempotencyKey: 'idem-generation-1',
      projectId: 'movie-1',
    });
    expect(draft.constraints).toEqual({ sensitiveData: true });
    expect(draft.dataLocalityKeys).toEqual([
      'model:video-model-1',
      'asset:scene-ref-1',
      'lora:character-lora-1',
    ]);
  });

  it('preserves render input locality', () => {
    const draft = directorRenderComputeDraft({
      sourceAssetId: 'source',
      compositeAssetId: 'composite',
      voiceSyncArtifactId: 'voice',
      animationAssetId: 'animation',
      physicsAssetId: 'physics',
      frameStart: 0,
      frameEnd: 240,
      continuityRef: 'scene-10',
    }, 'movie-1', binding);
    expect(draft.kind).toBe('render');
    expect(draft.dataLocalityKeys).toContain('asset:voice');
    expect(draft.dataLocalityKeys).toContain('continuity:scene-10');
  });

  it('maps Foley to a dedicated audio workload with source-video locality', () => {
    const draft = directorFoleyComputeDraft({
      id: 'foley-1',
      projectId: 'movie-1',
      sourceVideoAssetId: 'shot-1',
      sourceVideoSha256: 'abc',
      startSeconds: 0,
      endSeconds: 2,
      prompt: 'footsteps',
      evidenceIds: ['e1'],
      referenceAudioAssetId: 'ref-audio',
    }, binding);
    expect(draft.kind).toBe('foley-generation');
    expect(draft.dataLocalityKeys).toEqual(['asset:shot-1', 'asset:ref-audio']);
  });

  it('maps speech plans to voice identity locality', () => {
    const draft = directorSpeechComputeDraft({
      id: 'speech-1',
      projectId: 'movie-1',
      characterId: 'mike',
      voiceIdentityId: 'mike-voice',
      voiceVariantId: 'neutral',
      language: 'en-US',
      text: 'Hello.',
      sceneId: 'scene-1',
      lineId: 'line-1',
      speed: 1,
      pitchSemitones: 0,
      toneSpans: [],
      pauses: [],
      evidenceIds: ['e1'],
      authority: 'DIRECTOR_SPEECH_PERFORMANCE',
    }, binding);
    expect(draft.kind).toBe('voice-generation');
    expect(draft.dataLocalityKeys).toContain('voice:mike-voice');
  });

  it('maps LoRA training to background training work without changing target authority', () => {
    const draft = directorLoraTrainingComputeDraft({
      id: 'train-1',
      projectId: 'movie-1',
      characterId: 'mike',
      continuityRef: 'mike-v1',
      datasetId: 'dataset-1',
      triggerWord: 'mikechar',
      baseModel: 'base-1',
      modalities: ['image'],
      executionTarget: 'local',
      maxTrainingResolution: 1024,
      saveEverySteps: 100,
      sampleEverySteps: 100,
      samplePrompts: ['portrait'],
      evidenceIds: ['e1'],
    }, binding);
    expect(draft.kind).toBe('training');
    expect(draft.authority.system).toBe('director-studio-action');
    expect(draft.dataLocalityKeys).toEqual([
      'dataset:dataset-1',
      'model:base-1',
      'character:mike',
    ]);
  });

  it('rejects a compute binding from another Director project', () => {
    expect(() =>
      directorRenderComputeDraft({
        sourceAssetId: 'source',
        compositeAssetId: 'composite',
        voiceSyncArtifactId: 'voice',
        animationAssetId: 'animation',
        physicsAssetId: 'physics',
        frameStart: 0,
        frameEnd: 10,
      }, 'movie-2', binding),
    ).toThrow('DIRECTOR_COMPUTE_AUTHORITY_PROJECT_MISMATCH');
  });
});
