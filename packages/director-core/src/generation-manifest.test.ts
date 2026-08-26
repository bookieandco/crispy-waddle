import { describe, expect, it } from 'vitest';
import { generationCapabilitySources, referenceLoRAs, referenceModels, referenceProviders } from './generation-catalog';
import { validateWorkflowManifest, type GenerationWorkflowManifest } from './generation-manifest';

describe('generation workflow manifests', () => {
  it('accepts a versioned ComfyUI API manifest with unique exposed inputs', () => {
    const manifest: GenerationWorkflowManifest = {
      id: 'flux-t2i',
      name: 'FLUX text to image',
      version: '1.0.0',
      providerId: 'comfyui-local',
      modality: 'image',
      capabilities: ['text-to-image'],
      apiFormat: 'comfyui-api',
      workflow: { '1': { class_type: 'CheckpointLoaderSimple' } },
      exposedInputs: [
        { id: 'prompt', type: 'text', required: true },
        { id: 'steps', type: 'number', default: 28 },
      ],
    };

    expect(() => validateWorkflowManifest(manifest)).not.toThrow();
  });

  it('rejects duplicate exposed input ids', () => {
    const manifest: GenerationWorkflowManifest = {
      id: 'broken',
      name: 'Broken',
      version: '1.0.0',
      providerId: 'comfyui-local',
      modality: 'image',
      capabilities: ['text-to-image'],
      apiFormat: 'comfyui-api',
      workflow: {},
      exposedInputs: [
        { id: 'prompt', type: 'text' },
        { id: 'prompt', type: 'text' },
      ],
    };

    expect(() => validateWorkflowManifest(manifest)).toThrow(/duplicate/);
  });
});

describe('reference generation catalog', () => {
  it('keeps reference records non-installing and internally compatible', () => {
    expect(referenceProviders.map((provider) => provider.id)).toContain('comfyui-local');
    expect(referenceModels.every((model) => referenceProviders.some((provider) => provider.id === model.providerId))).toBe(true);
    expect(referenceLoRAs.every((lora) => lora.metadata?.status === 'reference-only')).toBe(true);
    expect(generationCapabilitySources.image).toContain('loras-dev');
  });
});
