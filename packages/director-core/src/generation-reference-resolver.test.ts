import { describe, expect, it } from 'vitest';
import type { GenerationProvider, GenerationRequest, GenerationResult } from './generation-provider';
import {
  ReferenceResolvingGenerationProvider,
  type GenerationReferenceUriResolver,
} from './generation-reference-resolver';
import { bindComfyUIWorkflowReferences } from './comfyui-reference-workflow';

function provider(submitted: GenerationRequest[]): GenerationProvider {
  return {
    descriptor: {
      id: 'comfy',
      name: 'Comfy',
      kind: 'comfyui',
      capabilities: ['image-to-video'],
      models: ['model'],
      health: 'healthy',
    },
    submissionGuarantee: 'strong-idempotent',
    async submit(request): Promise<GenerationResult> {
      submitted.push(request);
      return {
        requestId: request.requestId,
        providerId: 'comfy',
        status: 'queued',
        assetIds: [],
        providerJobId: 'job-1',
      };
    },
    async status(providerJobId) {
      return { requestId: providerJobId, providerId: 'comfy', status: 'running', assetIds: [], providerJobId };
    },
    async cancel() {},
  };
}

function request(): GenerationRequest {
  return {
    requestId: 'request-1',
    projectId: 'project-1',
    modality: 'video',
    prompt: 'Animate the same character',
    model: {
      id: 'model',
      providerId: 'comfy',
      name: 'Model',
      version: '1',
      modalities: ['video'],
      capabilities: ['image-to-video'],
    },
    parameters: {},
    references: [
      { assetId: 'character-ref', role: 'character' },
      { assetId: 'background-ref', role: 'image' },
    ],
  };
}

describe('generation reference submission boundary', () => {
  it('resolves a fresh character URI at every real provider submission', async () => {
    const submitted: GenerationRequest[] = [];
    let revision = 0;
    const resolver: GenerationReferenceUriResolver = {
      async resolve(input) {
        if (input.assetId !== 'character-ref') return undefined;
        revision += 1;
        return {
          assetId: input.assetId,
          uri: `https://signed.example/character.png?revision=${revision}`,
          sha256: 'character-sha',
        };
      },
    };
    const wrapped = new ReferenceResolvingGenerationProvider(provider(submitted), resolver);

    await wrapped.submit(request());
    await wrapped.submit(request());

    expect(submitted[0]?.references?.[0]?.uri).toContain('revision=1');
    expect(submitted[1]?.references?.[0]?.uri).toContain('revision=2');
    expect(request().references?.[0]?.uri).toBeUndefined();
  });

  it('fails closed when a character reference cannot be resolved', async () => {
    const wrapped = new ReferenceResolvingGenerationProvider(provider([]), {
      async resolve() { return undefined; },
    });

    await expect(wrapped.submit(request()))
      .rejects.toThrow('DIRECTOR_CHARACTER_REFERENCE_URI_UNRESOLVED:character-ref');
  });

  it('binds exact reference URI tokens into the ComfyUI workflow', () => {
    const result = bindComfyUIWorkflowReferences({
      '10': {
        class_type: 'LoadImage',
        inputs: { image: '{{director.reference.character.0.uri}}' },
      },
      '11': {
        class_type: 'Note',
        inputs: { text: '{{director.reference.character.0.assetId}}' },
      },
    }, [{
      assetId: 'character-ref',
      role: 'character',
      uri: 'https://signed.example/character.png',
    }]);

    expect(result.workflow).toMatchObject({
      '10': { inputs: { image: 'https://signed.example/character.png' } },
      '11': { inputs: { text: 'character-ref' } },
    });
    expect(result.boundCharacterAssetIds).toEqual(['character-ref']);
  });

  it('rejects a workflow that claims a character reference but never consumes its URI', () => {
    expect(() => bindComfyUIWorkflowReferences({
      '10': { class_type: 'EmptyLatentImage', inputs: {} },
    }, [{
      assetId: 'character-ref',
      role: 'character',
      uri: 'https://signed.example/character.png',
    }])).toThrow('DIRECTOR_COMFYUI_CHARACTER_REFERENCE_NOT_BOUND:character-ref');
  });

  it('rejects a character workflow before graph submission when no URI exists', () => {
    expect(() => bindComfyUIWorkflowReferences({
      '10': {
        class_type: 'LoadImage',
        inputs: { image: '{{director.reference.character.0.uri}}' },
      },
    }, [{
      assetId: 'character-ref',
      role: 'character',
    }])).toThrow('DIRECTOR_COMFYUI_CHARACTER_REFERENCE_URI_REQUIRED:character-ref');
  });
});
