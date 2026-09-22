import { afterEach, describe, expect, it, vi } from 'vitest';
import { HiggsfieldReferenceVideoProductionProvider } from './director-whole-video-providers';

const baseBrief = {
  jobId: 'job-1',
  projectId: 'project-1',
  prompt: 'A cinematic product reveal with the same recurring character.',
  creativeName: 'Reference ad',
  intent: {
    mode: 'short' as const,
    prompt: 'Create an 8 second short video',
    aspectRatio: '9:16' as const,
    targetDurationSeconds: 8,
    narration: false,
    captions: false,
    foley: true,
    commercialSafeOnly: true as const,
    providerPolicy: {
      localFreeFirst: true as const,
      allowPaidWithoutApproval: false as const,
    },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Higgsfield reference video provider', () => {
  it('submits combined character and product refs to Seedance reference-to-video', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://api.higgsfield.ai/bytedance/seedance-2.0/reference-to-video');
      expect(init?.method).toBe('POST');
      expect((init?.headers as Record<string,string>).authorization).toBe('Key key-id:key-secret');
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.duration).toBe(8);
      expect(body.aspect_ratio).toBe('9:16');
      expect(body.image_urls).toEqual(['https://private/character.jpg', 'https://private/product.jpg']);
      return new Response(JSON.stringify({
        status: 'queued',
        request_id: 'hf-request-1',
        status_url: 'https://api.higgsfield.ai/requests/hf-request-1/status',
        cancel_url: 'https://api.higgsfield.ai/requests/hf-request-1/cancel',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new HiggsfieldReferenceVideoProductionProvider({
      keyId: 'key-id',
      keySecret: 'key-secret',
      resolution: '720p',
    });
    const result = await provider.submit({
      ...baseBrief,
      character: {
        characterId: 'ela',
        continuityRef: 'character:ela:v1',
        appearanceVariantId: 'appearance:ela:base',
        referenceUris: ['https://private/character.jpg'],
        referenceSha256s: ['char-sha'],
      },
      product: {
        productId: 'zesta',
        productBibleId: 'product-bible:zesta:v1',
        canonicalVariantId: 'product-variant:zesta:base',
        referenceUris: ['https://private/product.jpg'],
        referenceSha256s: ['product-sha'],
        labelAuthorities: [{ text: 'ZESTA', surface: 'front' }],
      },
    });

    expect(result.providerJobId).toBe('hf-request-1');
    expect(result.status).toBe('queued');
    expect(result.metadata?.referenceCount).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps completed Higgsfield status into a ready Director result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      status: 'completed',
      request_id: 'hf-request-2',
      video: { url: 'https://cdn.example/final.mp4' },
    }), { status: 200, headers: { 'content-type': 'application/json' } })));

    const provider = new HiggsfieldReferenceVideoProductionProvider({
      keyId: 'key-id',
      keySecret: 'key-secret',
    });
    const result = await provider.status('hf-request-2');

    expect(result.status).toBe('ready');
    expect(result.resultUri).toBe('https://cdn.example/final.mp4');
  });

  it('refuses to pretend a >15 second request is one whole Higgsfield generation', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const provider = new HiggsfieldReferenceVideoProductionProvider({
      keyId: 'key-id',
      keySecret: 'key-secret',
    });

    await expect(provider.submit({
      ...baseBrief,
      intent: { ...baseBrief.intent, targetDurationSeconds: 30 },
    })).rejects.toThrow('DIRECTOR_HIGGSFIELD_WHOLE_VIDEO_DURATION_EXCEEDS_CLIP_LIMIT');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
