import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReferenceCharacterVideoProductionProvider } from './director-whole-video-providers';

const intent = {
  mode: 'standard' as const,
  prompt: 'Create a full video',
  aspectRatio: '16:9' as const,
  targetDurationSeconds: 30,
  narration: true,
  captions: true,
  foley: true,
  commercialSafeOnly: true as const,
  providerPolicy: { localFreeFirst: true as const, allowPaidWithoutApproval: false as const },
};

afterEach(() => vi.restoreAllMocks());

describe('ReferenceCharacterVideoProductionProvider', () => {
  it('refuses submission if character references were lost before the provider boundary', async () => {
    const provider = new ReferenceCharacterVideoProductionProvider({ baseUrl: 'https://provider.example' });
    await expect(provider.submit({
      jobId: 'job-1',
      projectId: 'project-a',
      prompt: 'Make a video',
      intent,
      creativeName: 'Movie',
      character: {
        characterId: 'ela',
        continuityRef: 'character:ela:v1',
        appearanceVariantId: 'appearance:ela:base',
        referenceUris: [],
        referenceSha256s: ['sha-ref'],
      },
    }, 'idem-1')).rejects.toThrow('DIRECTOR_REFERENCE_VIDEO_CHARACTER_REQUIRED');
  });

  it('sends the exact locked character lineage and signed reference inputs', async () => {
    const fetchMock = vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({
      providerJobId: 'provider-job-1',
      status: 'queued',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const provider = new ReferenceCharacterVideoProductionProvider({
      baseUrl: 'https://provider.example/',
      token: 'secret-token',
    });
    await expect(provider.submit({
      jobId: 'job-1',
      projectId: 'project-a',
      prompt: 'Make a video',
      intent,
      creativeName: 'Movie',
      character: {
        characterId: 'ela',
        continuityRef: 'character:ela:v1',
        appearanceVariantId: 'appearance:ela:base',
        referenceUris: ['https://signed.example/ref.png'],
        referenceSha256s: ['sha-ref'],
      },
    }, 'idem-1')).resolves.toMatchObject({
      providerJobId: 'provider-job-1',
      status: 'queued',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://provider.example/jobs');
    expect(init?.headers).toMatchObject({
      'content-type': 'application/json',
      'idempotency-key': 'idem-1',
      authorization: 'Bearer secret-token',
    });
    const body = JSON.parse(String(init?.body));
    expect(body.character).toEqual({
      characterId: 'ela',
      continuityRef: 'character:ela:v1',
      appearanceVariantId: 'appearance:ela:base',
      referenceUris: ['https://signed.example/ref.png'],
      referenceSha256s: ['sha-ref'],
    });
  });
});
