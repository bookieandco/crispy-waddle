import { describe, expect, it } from 'vitest';
import { GenerationPlanAdapter } from './generation-plan-adapter';
import { GenerationRegistry } from './generation-registry';
import { GenerationService } from './generation-service';
import type { GenerationProvider } from './generation-provider';
import type { GenerationRequest } from './generation-provider';
import type { GenerationResult } from './generation-provider';

describe('GenerationPlanAdapter', () => {
  it('turns a directing take into a provider-neutral generation request', async () => {
    const registry = new GenerationRegistry();
    registry.registerProvider({
      id: 'comfy-local',
      name: 'ComfyUI Local',
      kind: 'comfyui',
      capabilities: ['text-to-video', 'image-to-video'],
      models: ['video-model'],
      health: 'healthy',
    });
    registry.registerModel({
      id: 'video-model',
      providerId: 'comfy-local',
      name: 'Video Model',
      version: '1',
      modalities: ['video'],
      capabilities: ['text-to-video', 'image-to-video'],
      baseModel: 'video-base',
    });
    registry.registerLoRA({
      id: 'character-maya',
      name: 'Maya',
      version: '1',
      baseModel: 'video-base',
      modalities: ['video'],
      weight: { min: 0, max: 1.5, recommended: 0.8 },
    });

    let submitted: GenerationRequest | undefined;
    const provider: GenerationProvider = {
      descriptor: registry.getProvider('comfy-local')!,
      async submit(request) {
        submitted = request;
        return { requestId: request.requestId, providerId: 'comfy-local', status: 'queued', assetIds: [], providerJobId: 'p1' };
      },
      async status(providerJobId): Promise<GenerationResult> {
        return { requestId: providerJobId, providerId: 'comfy-local', status: 'completed', assetIds: [] };
      },
      async cancel() {},
    };

    const service = new GenerationService(registry, new Map([['comfy-local', provider]]));
    const adapter = new GenerationPlanAdapter(service, registry);

    const job = await adapter.submitTake({
      projectId: 'p',
      sceneId: 's1',
      prompt: 'Maya walks home after the argument',
      locked: ['character', 'location', 'performance'],
      referenceCharacterIds: ['maya'],
      referenceAssetIds: ['apartment'],
      targetRuntimeSeconds: 8,
    }, {
      modelId: 'video-model',
      modality: 'video',
      loras: [{ loraId: 'character-maya', weight: 0.9 }],
      parameters: { seed: 42 },
    });

    expect(job.status).toBe('queued');
    expect(submitted?.model.id).toBe('video-model');
    expect(submitted?.loras?.[0].lora.id).toBe('character-maya');
    expect(submitted?.loras?.[0].weight).toBe(0.9);
    expect(submitted?.references).toEqual([
      { assetId: 'maya', role: 'character' },
      { assetId: 'apartment', role: 'image' },
    ]);
    expect(submitted?.parameters).toMatchObject({
      seed: 42,
      targetRuntimeSeconds: 8,
      continuityLocks: ['character', 'location', 'performance'],
    });
  });
});
