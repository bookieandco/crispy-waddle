import { describe, expect, it, vi } from 'vitest';
import { createDirectorGenerationRuntimeConfig } from './director-generation-provider-factory';

describe('director generation provider factory', () => {
  const model = {
    id: 'flux-test',
    providerId: 'comfyui-local',
    name: 'Test model',
    version: '1.0.0',
    modalities: ['image'] as const,
    capabilities: ['text-to-image'] as const,
  };

  it('constructs a registry and provider from explicit configuration', () => {
    const runtime = createDirectorGenerationRuntimeConfig({
      comfyUi: {
        id: 'comfyui-local',
        name: 'ComfyUI local',
        baseUrl: 'http://comfyui:8188',
        models: [model],
      },
    });

    expect(runtime.providers.size).toBe(1);
    expect(runtime.providers.get('comfyui-local')?.descriptor.endpoint).toBe('http://comfyui:8188');
    expect(runtime.registry.getProvider('comfyui-local')?.kind).toBe('comfyui');
    expect(runtime.registry.getModel('flux-test')?.providerId).toBe('comfyui-local');
  });

  it('fails closed when no provider is configured', () => {
    expect(() => createDirectorGenerationRuntimeConfig({})).toThrow(
      'DIRECTOR_GENERATION_PROVIDER_NOT_CONFIGURED',
    );
  });

  it('rejects models bound to a different provider', () => {
    expect(() =>
      createDirectorGenerationRuntimeConfig({
        comfyUi: {
          id: 'comfyui-local',
          baseUrl: 'http://comfyui:8188',
          models: [{ ...model, providerId: 'other-provider' }],
        },
      }),
    ).toThrow('DIRECTOR_MODEL_PROVIDER_MISMATCH:flux-test');
  });

  it('does not construct a provider from catalog metadata', () => {
    vi.stubEnv('DIRECTOR_COMFYUI_URL', '');
    vi.stubEnv('DIRECTOR_COMFYUI_MODELS_JSON', '');
    expect(() => createDirectorGenerationRuntimeConfig()).toThrow(
      'DIRECTOR_GENERATION_PROVIDER_NOT_CONFIGURED',
    );
    vi.unstubAllEnvs();
  });
});
