import { describe, expect, it } from 'vitest';
import { GenerationRegistry } from './generation-registry';
import type { GenerationProvider, GenerationRequest, GenerationResult } from './generation-provider';
import { GenerationService } from './generation-service';
import { InMemoryGeneratedAssetRepository } from './generated-asset-resolver';

describe('GenerationService end-to-end', () => {
  it('submits, refreshes, and persists a completed generated asset', async () => {
    const registry = new GenerationRegistry();
    registry.registerProvider({
      id: 'comfy-local', name: 'ComfyUI', kind: 'comfyui',
      endpoint: 'http://comfyui.test',
      capabilities: ['text-to-image', 'text-to-video', 'image-to-video'],
      models: ['test-model'], health: 'healthy',
    });
    registry.registerModel({
      id: 'test-model', providerId: 'comfy-local', name: 'Test Model', version: '1',
      modalities: ['image', 'video'], capabilities: ['text-to-image', 'text-to-video'], baseModel: 'test-base',
    });

    let statusCalls = 0;
    const provider: GenerationProvider = {
      descriptor: registry.getProvider('comfy-local')!,
      async submit(request: GenerationRequest): Promise<GenerationResult> {
        return { requestId: request.requestId, providerId: 'comfy-local', status: 'queued', assetIds: [], providerJobId: 'provider-job-1' };
      },
      async status(providerJobId: string): Promise<GenerationResult> {
        statusCalls += 1;
        return {
          requestId: 'generation-1', providerId: 'comfy-local', status: 'completed', assetIds: [], providerJobId,
          metadata: { outputs: [{ uri: 'http://comfyui.test/view?filename=shot.png&type=output', mediaType: 'image', mimeType: 'image/png' }] },
        };
      },
      async cancel(): Promise<void> {},
    };

    const assets = new InMemoryGeneratedAssetRepository();
    const service = new GenerationService(registry, new Map([['comfy-local', provider]]), assets);
    const job = await service.submit({
      requestId: 'generation-1', projectId: 'project-1', modality: 'image', prompt: 'cinematic test shot',
      model: registry.getModel('test-model')!, parameters: {},
    });

    expect(job.status).toBe('queued');
    const completed = await service.refresh(job.id);
    expect(completed.status).toBe('completed');
    expect(statusCalls).toBe(1);

    const stored = await assets.listByGenerationJob('generation-1');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      projectId: 'project-1', providerId: 'comfy-local', mediaType: 'image',
      uri: 'http://comfyui.test/view?filename=shot.png&type=output',
      mimeType: 'image/png', prompt: 'cinematic test shot', modelId: 'test-model',
    });
  });
});
