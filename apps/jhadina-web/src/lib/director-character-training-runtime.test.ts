import { describe, expect, it, vi } from 'vitest';
import {
  createConfiguredDirectorCharacterTrainingProviders,
  createDirectorCharacterTrainingWorkerClient,
  probeDirectorCharacterTrainingRuntime,
} from './director-character-training-runtime';

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Director character-training runtime composition', () => {
  it('sends governed worker requests with bearer auth', async () => {
    const fetchImpl = vi.fn(async () => response({ artifactId: 'a' }));
    const client = createDirectorCharacterTrainingWorkerClient({
      baseUrl: 'https://director-worker.example',
      token: 'secret-token',
      fetchImpl: fetchImpl as typeof fetch,
    });

    await client.post('/v1/character-dataset', { id: 'plan-1' });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://director-worker.example/v1/character-dataset',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer secret-token',
          'content-type': 'application/json',
        }),
      }),
    );
  });

  it('refuses contract-certification mode for production composition by default', async () => {
    const fetchImpl = vi.fn(async () => response({
      status: 'certification-ready',
      mode: 'contract-certification',
      backend: 'director-contract-certification',
      productionReady: false,
    }));

    await expect(probeDirectorCharacterTrainingRuntime({
      baseUrl: 'https://director-worker.example',
      token: 'token',
      fetchImpl: fetchImpl as typeof fetch,
    })).rejects.toThrow('DIRECTOR_CHARACTER_TRAINING_PRODUCTION_BACKEND_REQUIRED');
  });

  it('allows contract-certification only when explicitly requested', async () => {
    const fetchImpl = vi.fn(async () => response({
      status: 'certification-ready',
      mode: 'contract-certification',
      backend: 'director-contract-certification',
      productionReady: false,
    }));

    const health = await probeDirectorCharacterTrainingRuntime({
      baseUrl: 'https://director-worker.example',
      token: 'token',
      allowCertificationMode: true,
      fetchImpl: fetchImpl as typeof fetch,
    });
    expect(health.productionReady).toBe(false);
  });

  it('composes all three Studio providers only after a production-ready health proof', async () => {
    const fetchImpl = vi.fn(async () => response({
      status: 'ready',
      mode: 'production-proxy',
      backend: 'director-http-backend',
      productionReady: true,
    }));

    const providers = await createConfiguredDirectorCharacterTrainingProviders({
      baseUrl: 'https://director-worker.example',
      token: 'token',
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(providers.some(provider => provider.supports('character-dataset'))).toBe(true);
    expect(providers.some(provider => provider.supports('lora-train'))).toBe(true);
    expect(providers.some(provider => provider.supports('video-upscale'))).toBe(true);
  });

  it('fails closed on contradictory readiness metadata', async () => {
    const fetchImpl = vi.fn(async () => response({
      status: 'ready',
      mode: 'contract-certification',
      backend: 'bad',
      productionReady: true,
    }));

    await expect(probeDirectorCharacterTrainingRuntime({
      baseUrl: 'https://director-worker.example',
      token: 'token',
      fetchImpl: fetchImpl as typeof fetch,
    })).rejects.toThrow('DIRECTOR_CHARACTER_TRAINING_HEALTH_CONTRADICTORY');
  });
});
