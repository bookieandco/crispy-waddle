import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateWithLocalImageWorker, localImageWorkerConfig } from '../lib/local-image-worker';
import { resolvePupsonCreativeProvider } from '../lib/creative-provider';

const fetchMock = vi.fn();
const samplePng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const reference = { bytes: samplePng, mimeType: 'image/png' };

function goodResponse(model = 'qwen-image-edit-pinned') {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({
      schema: 'pupson.local-image-edit-result.v1',
      engine: 'unsloth',
      model,
      image_base64: samplePng.toString('base64'),
    }),
  };
}

beforeEach(() => {
  vi.stubEnv('PUPSON_LOCAL_IMAGE_WORKER_URL', 'https://trusted-image.example/v1/pupson/image/edit');
  vi.stubEnv('PUPSON_LOCAL_IMAGE_WORKER_TOKEN', 'x'.repeat(40));
  vi.stubEnv('PUPSON_LOCAL_IMAGE_MODEL', 'qwen-image-edit-pinned');
  vi.stubEnv('PUPSON_OPENAI_STYLE_BACKEND', 'openai');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Pupson local image generation boundary', () => {
  it('retains OpenAI by default, routing to Unsloth only on explicit opt-in', () => {
    expect(resolvePupsonCreativeProvider('ascii-art').id).toBe('local');
    // Any non-Muapi, non-ASCII artistic style uses the configured generic provider.
    const art = 'watercolor' as Parameters<typeof resolvePupsonCreativeProvider>[0];
    expect(resolvePupsonCreativeProvider(art).id).toBe('openai');
    vi.stubEnv('PUPSON_OPENAI_STYLE_BACKEND', 'local_worker');
    expect(resolvePupsonCreativeProvider(art).id).toBe('unsloth');
  });

  it('sends up to three reference bytes to an authenticated protocol gateway', async () => {
    fetchMock.mockResolvedValue(goodResponse());
    await expect(generateWithLocalImageWorker({
      prompt: 'Preserve this pet marking',
      references: [reference, reference, reference],
    })).resolves.toEqual({ model: 'qwen-image-edit-pinned', imageBase64: samplePng.toString('base64') });
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://trusted-image.example/v1/pupson/image/edit');
    expect(options.headers.Authorization).toBe(`Bearer ${'x'.repeat(40)}`);
    expect(options.redirect).toBe('error');
    const sent = JSON.parse(options.body);
    expect(sent.reference_images).toHaveLength(3);
    expect(sent.engine).toBe('unsloth');
    expect(sent.schema).toBe('pupson.local-image-edit.v1');
  });

  it('blocks accidental local or anonymous calls in production', () => {
    vi.stubEnv('PUPSON_LOCAL_IMAGE_WORKER_URL', 'http://localhost:8000/v1/pupson/image/edit');
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => localImageWorkerConfig()).toThrow(/HTTPS/);
    vi.stubEnv('PUPSON_LOCAL_IMAGE_WORKER_URL', 'https://trusted-image.example/v1/pupson/image/edit');
    vi.stubEnv('PUPSON_LOCAL_IMAGE_WORKER_TOKEN', '');
    expect(() => localImageWorkerConfig()).toThrow(/configured/);
  });

  it('rejects invalid reference counts before calling the host', async () => {
    await expect(generateWithLocalImageWorker({ prompt: 'pet', references: [] })).rejects.toThrow(/one to three/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects model drift and unsupported response bytes', async () => {
    fetchMock.mockResolvedValueOnce(goodResponse('unexpected-model'));
    await expect(generateWithLocalImageWorker({ prompt: 'pet', references: [reference] }))
      .rejects.toThrow(/protocol\/model/);
    fetchMock.mockResolvedValueOnce({
      ...goodResponse(),
      json: async () => ({
        schema: 'pupson.local-image-edit-result.v1',
        engine: 'unsloth',
        model: 'qwen-image-edit-pinned',
        image_base64: Buffer.from('not-an-image').toString('base64'),
      }),
    });
    await expect(generateWithLocalImageWorker({ prompt: 'pet', references: [reference] }))
      .rejects.toThrow(/unsupported image/);
  });

  it('never surfaces a remote error body that may contain the pet prompt', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, headers: { get: () => null } });
    await expect(generateWithLocalImageWorker({ prompt: 'sensitive description', references: [reference] }))
      .rejects.toThrow('Local image worker failed with HTTP 502.');
  });
});
