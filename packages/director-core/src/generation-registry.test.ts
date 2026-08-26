import { describe, expect, it } from 'vitest';
import { GenerationRegistry } from './generation-registry';
import { GenerationService } from './generation-service';
import type { GenerationProvider } from './generation-provider';

describe('GenerationRegistry', () => {
  it('registers providers, models, and compatible LoRAs', () => {
    const registry = new GenerationRegistry();
    registry.registerProvider({
      id: 'comfy-local', name: 'ComfyUI Local', kind: 'comfyui',
      capabilities: ['text-to-video', 'image-to-video'], models: [], health: 'healthy',
    });
    registry.registerModel({
      id: 'video-model-v1', providerId: 'comfy-local', name: 'Video Model', version: '1',
      modalities: ['video'], capabilities: ['text-to-video', 'image-to-video'], baseModel: 'base-v1',
    });
    registry.registerLoRA({
      id: 'character-ava', name: 'Ava Character', version: '1', baseModel: 'base-v1',
      modalities: ['video'], weight: { min: 0, max: 1.5, recommended: 0.8 },
    });

    expect(registry.compatibleLoRAs('video-model-v1').map((lora) => lora.id)).toEqual(['character-ava']);
  });
});

describe('GenerationService', () => {
  it('rejects an unregistered LoRA', async () => {
    const registry = new GenerationRegistry();
    registry.registerProvider({ id: 'p', name: 'Provider', kind: 'local', capabilities: ['text-to-video'], models: [], health: 'healthy' });
    registry.registerModel({ id: 'm', providerId: 'p', name: 'Model', version: '1', modalities: ['video'], capabilities: ['text-to-video'] });

    const provider: GenerationProvider = {
      descriptor: registry.getProvider('p')!,
      submit: async () => ({ requestId: 'x', providerId: 'p', status: 'queued', assetIds: [], providerJobId: 'job' }),
      status: async () => ({ requestId: 'x', providerId: 'p', status: 'running', assetIds: [], providerJobId: 'job' }),
      cancel: async () => undefined,
    };
    const service = new GenerationService(registry, new Map([['p', provider]]));

    await expect(service.submit({
      requestId: 'x', projectId: 'project', modality: 'video', prompt: 'test',
      model: registry.getModel('m')!,
      loras: [{ lora: { id: 'missing', name: '', version: '', baseModel: '', modalities: ['video'], weight: { min: 0, max: 1 } } }],
      parameters: {},
    })).rejects.toThrow('LoRA is not registered: missing');
  });
});
