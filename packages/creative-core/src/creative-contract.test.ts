import { describe, expect, it } from 'vitest';
import type { GenerationJob, GenerationRequest } from '@jhadina/director-core';
import { DirectorCreativeEngine, type CreativeIntent } from './creative-contract';

const model: GenerationRequest['model'] = {
  id: 'test-image-model',
  providerId: 'test-provider',
  modalities: ['image'],
} as GenerationRequest['model'];

function job(request: GenerationRequest, status: GenerationJob['status'] = 'queued'): GenerationJob {
  return {
    id: request.requestId,
    request,
    providerId: request.model.providerId,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('DirectorCreativeEngine', () => {
  it('translates product intent into a governed generation request', async () => {
    const submitted: GenerationRequest[] = [];
    const generation = {
      submit: async (request: GenerationRequest) => {
        submitted.push(request);
        return job(request, 'completed');
      },
    };
    const engine = new DirectorCreativeEngine(generation, () => model);
    const intent: CreativeIntent = {
      id: 'intent:pet-hoodie',
      source: 'image',
      destination: 'product',
      prompt: 'A vintage portrait of this dog as a space explorer',
      productContext: { productType: 'hoodie', printArea: 'front' },
      brandContext: { brand: 'PupsonStuff' },
      audienceContext: { segment: 'pet-lovers' },
      constraints: { transparentBackground: true },
      references: [{ assetId: 'pet-1', uri: 'supabase://pet-1', role: 'image' }],
    };

    const result = await engine.create(intent);

    expect(result.status).toBe('completed');
    expect(submitted).toHaveLength(1);
    expect(submitted[0].modality).toBe('image');
    expect(submitted[0].prompt).toContain('space explorer');
    expect(submitted[0].parameters.destination).toBe('product');
    expect(submitted[0].parameters.productContext).toEqual(intent.productContext);
    expect(submitted[0].references?.[0]).toEqual({
      assetId: 'pet-1',
      role: 'image',
      uri: 'supabase://pet-1',
    });
  });

  it('does not expose a provider/model implementation in the creative intent', async () => {
    const generation = { submit: async (request: GenerationRequest) => job(request, 'queued') };
    let resolvedFor: CreativeIntent | undefined;
    const engine = new DirectorCreativeEngine(generation, (intent) => {
      resolvedFor = intent;
      return model;
    });

    const intent: CreativeIntent = {
      id: 'intent:generic',
      source: 'text',
      destination: 'general',
      prompt: 'A bold graphic',
    };

    await engine.create(intent);

    expect(resolvedFor).toBe(intent);
    expect(intent).not.toHaveProperty('metadata.model');
  });
});
