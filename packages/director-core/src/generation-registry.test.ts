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

  it('routes referenced image requests through image-to-image capability', async () => {
    const registry = new GenerationRegistry();
    registry.registerProvider({
      id: 'image-provider',
      name: 'Image Provider',
      kind: 'local',
      capabilities: ['image-to-image'],
      models: [],
      health: 'healthy',
    });
    registry.registerModel({
      id: 'image-edit',
      providerId: 'image-provider',
      name: 'Image Edit',
      version: '1',
      modalities: ['image'],
      capabilities: ['image-to-image'],
    });
    let submitted = false;
    const provider: GenerationProvider = {
      descriptor: registry.getProvider('image-provider')!,
      submit: async (request) => {
        submitted = true;
        return {
          requestId: request.requestId,
          providerId: 'image-provider',
          status: 'queued',
          assetIds: [],
          providerJobId: 'image-job',
        };
      },
      status: async () => ({
        requestId: 'image-job',
        providerId: 'image-provider',
        status: 'running',
        assetIds: [],
        providerJobId: 'image-job',
      }),
      cancel: async () => undefined,
    };

    const service = new GenerationService(
      registry,
      new Map([['image-provider', provider]])
    );
    await service.submit({
      requestId: 'image-request',
      projectId: 'project',
      modality: 'image',
      prompt: 'preserve the pet identity',
      model: registry.getModel('image-edit')!,
      references: [{ assetId: 'pet-1', role: 'image', uri: 'asset://pet-1' }],
      parameters: {},
    });

    expect(submitted).toBe(true);
  });

  it('treats a black-video voice reference as audio transport, not visual video-to-video control', async () => {
    const registry = new GenerationRegistry();
    registry.registerProvider({
      id: 'dialogue-provider',
      name: 'Dialogue Video Provider',
      kind: 'local',
      capabilities: ['text-to-video'],
      models: [],
      health: 'healthy',
    });
    registry.registerModel({
      id: 'dialogue-model',
      providerId: 'dialogue-provider',
      name: 'Dialogue Model',
      version: '1',
      modalities: ['video'],
      capabilities: ['text-to-video'],
    });
    let submitted = false;
    const provider: GenerationProvider = {
      descriptor: registry.getProvider('dialogue-provider')!,
      submit: async (request) => {
        submitted = true;
        return {
          requestId: request.requestId,
          providerId: 'dialogue-provider',
          status: 'queued',
          assetIds: [],
          providerJobId: 'dialogue-job',
        };
      },
      status: async () => ({
        requestId: 'dialogue-job',
        providerId: 'dialogue-provider',
        status: 'running',
        assetIds: [],
        providerJobId: 'dialogue-job',
      }),
      cancel: async () => undefined,
    };

    const service = new GenerationService(registry, new Map([['dialogue-provider', provider]]));
    await service.submit({
      requestId: 'dialogue-request',
      projectId: 'project',
      modality: 'video',
      prompt: 'speak with the locked voice',
      model: registry.getModel('dialogue-model')!,
      references: [{
        assetId: 'voice:mary:black-video',
        role: 'audio',
        media: 'video',
        uri: 'asset://mary-voice-black.mp4',
      }],
      parameters: {},
    });

    expect(submitted).toBe(true);
  });

  it('routes greybox video references through video-to-video capability', async () => {
    const registry = new GenerationRegistry();
    registry.registerProvider({
      id: 'video-control-provider',
      name: 'Video Control Provider',
      kind: 'local',
      capabilities: ['video-to-video'],
      models: [],
      health: 'healthy',
    });
    registry.registerModel({
      id: 'video-control-model',
      providerId: 'video-control-provider',
      name: 'Video Control Model',
      version: '1',
      modalities: ['video'],
      capabilities: ['video-to-video'],
    });
    let submitted = false;
    const provider: GenerationProvider = {
      descriptor: registry.getProvider('video-control-provider')!,
      submit: async (request) => {
        submitted = true;
        return {
          requestId: request.requestId,
          providerId: 'video-control-provider',
          status: 'queued',
          assetIds: [],
          providerJobId: 'video-job',
        };
      },
      status: async () => ({
        requestId: 'video-job',
        providerId: 'video-control-provider',
        status: 'running',
        assetIds: [],
        providerJobId: 'video-job',
      }),
      cancel: async () => undefined,
    };
    const service = new GenerationService(registry, new Map([['video-control-provider', provider]]));

    await service.submit({
      requestId: 'video-control-request',
      projectId: 'project',
      modality: 'video',
      prompt: 'follow the authored blocking and camera timing',
      model: registry.getModel('video-control-model')!,
      references: [{
        assetId: 'greybox:shot-1',
        role: 'motion',
        media: 'video',
        uri: 'asset://greybox-shot-1.mp4',
      }],
      parameters: {},
    });

    expect(submitted).toBe(true);
  });

  it('rejects a referenced image request when the model is text-only', async () => {
    const registry = new GenerationRegistry();
    registry.registerProvider({
      id: 'image-provider',
      name: 'Image Provider',
      kind: 'local',
      capabilities: ['text-to-image', 'image-to-image'],
      models: [],
      health: 'healthy',
    });
    registry.registerModel({
      id: 'text-only',
      providerId: 'image-provider',
      name: 'Text Only',
      version: '1',
      modalities: ['image'],
      capabilities: ['text-to-image'],
    });
    const provider: GenerationProvider = {
      descriptor: registry.getProvider('image-provider')!,
      submit: async (request) => ({
        requestId: request.requestId,
        providerId: 'image-provider',
        status: 'queued',
        assetIds: [],
        providerJobId: 'image-job',
      }),
      status: async () => ({
        requestId: 'image-job',
        providerId: 'image-provider',
        status: 'running',
        assetIds: [],
        providerJobId: 'image-job',
      }),
      cancel: async () => undefined,
    };
    const service = new GenerationService(
      registry,
      new Map([['image-provider', provider]])
    );

    await expect(
      service.submit({
        requestId: 'image-request',
        projectId: 'project',
        modality: 'image',
        prompt: 'edit this image',
        model: registry.getModel('text-only')!,
        references: [{ assetId: 'pet-1', role: 'image', uri: 'asset://pet-1' }],
        parameters: {},
      })
    ).rejects.toThrow('Model text-only does not support capability: image-to-image');
  });

});
