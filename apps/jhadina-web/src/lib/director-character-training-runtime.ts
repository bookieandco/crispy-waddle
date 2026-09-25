import {
  createCharacterDatasetExecutionProvider,
  createCharacterLoraTrainingProvider,
  createVideoUpscaleExecutionProvider,
} from '@jhadina/director-core/studio-character-training';
import type { DirectorStudioCapabilityProvider } from '@jhadina/director-core/studio-governed-action';
import {
  createCharacterDatasetWorkerAdapter,
  createCharacterLoraTrainingWorkerAdapter,
  createVideoUpscaleWorkerAdapter,
  type CharacterTrainingWorkerClient,
} from '@jhadina/director-core/studio-character-training-worker';

export type DirectorCharacterTrainingRuntimeHealth = {
  status: 'ready' | 'certification-ready';
  mode: 'production-proxy' | 'contract-certification';
  backend: string;
  productionReady: boolean;
};

export type DirectorCharacterTrainingRuntimeConfig = {
  baseUrl?: string;
  token?: string;
  allowCertificationMode?: boolean;
  fetchImpl?: typeof fetch;
};

function resolveConfig(input: DirectorCharacterTrainingRuntimeConfig = {}) {
  const baseUrl = (input.baseUrl ?? process.env.DIRECTOR_CHARACTER_TRAINING_WORKER_URL ?? '').trim().replace(/\/$/, '');
  const token = (input.token ?? process.env.DIRECTOR_CHARACTER_TRAINING_TOKEN ?? '').trim();
  if (!baseUrl) throw new Error('DIRECTOR_CHARACTER_TRAINING_WORKER_URL_REQUIRED');
  if (!/^https?:\/\//i.test(baseUrl)) throw new Error('DIRECTOR_CHARACTER_TRAINING_WORKER_URL_INVALID');
  if (!token) throw new Error('DIRECTOR_CHARACTER_TRAINING_TOKEN_REQUIRED');
  return {
    baseUrl,
    token,
    allowCertificationMode: input.allowCertificationMode ?? false,
    fetchImpl: input.fetchImpl ?? fetch,
  };
}

export function createDirectorCharacterTrainingWorkerClient(
  input: DirectorCharacterTrainingRuntimeConfig = {},
): CharacterTrainingWorkerClient {
  const config = resolveConfig(input);
  return {
    async post(path: string, body: unknown): Promise<unknown> {
      if (!path.startsWith('/v1/')) throw new Error('DIRECTOR_CHARACTER_TRAINING_WORKER_PATH_INVALID');
      const response = await config.fetchImpl(`${config.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify(body),
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`DIRECTOR_CHARACTER_TRAINING_WORKER_HTTP_${response.status}`);
      }
      return response.json();
    },
  };
}

export async function probeDirectorCharacterTrainingRuntime(
  input: DirectorCharacterTrainingRuntimeConfig = {},
): Promise<DirectorCharacterTrainingRuntimeHealth> {
  const config = resolveConfig(input);
  const response = await config.fetchImpl(`${config.baseUrl}/health`, {
    method: 'GET',
    headers: { authorization: `Bearer ${config.token}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`DIRECTOR_CHARACTER_TRAINING_HEALTH_HTTP_${response.status}`);
  const raw = await response.json() as Record<string, unknown>;
  if (
    (raw.status !== 'ready' && raw.status !== 'certification-ready') ||
    (raw.mode !== 'production-proxy' && raw.mode !== 'contract-certification') ||
    typeof raw.backend !== 'string' ||
    !raw.backend ||
    typeof raw.productionReady !== 'boolean'
  ) {
    throw new Error('DIRECTOR_CHARACTER_TRAINING_HEALTH_INVALID');
  }
  const health = raw as DirectorCharacterTrainingRuntimeHealth;
  if (!health.productionReady && !config.allowCertificationMode) {
    throw new Error('DIRECTOR_CHARACTER_TRAINING_PRODUCTION_BACKEND_REQUIRED');
  }
  if (health.productionReady && health.mode !== 'production-proxy') {
    throw new Error('DIRECTOR_CHARACTER_TRAINING_HEALTH_CONTRADICTORY');
  }
  return health;
}

export async function createConfiguredDirectorCharacterTrainingProviders(
  input: DirectorCharacterTrainingRuntimeConfig = {},
): Promise<readonly DirectorStudioCapabilityProvider[]> {
  await probeDirectorCharacterTrainingRuntime(input);
  const client = createDirectorCharacterTrainingWorkerClient(input);
  return Object.freeze([
    createCharacterDatasetExecutionProvider(createCharacterDatasetWorkerAdapter(client)),
    createCharacterLoraTrainingProvider(createCharacterLoraTrainingWorkerAdapter(client)),
    createVideoUpscaleExecutionProvider(createVideoUpscaleWorkerAdapter(client)),
  ]);
}
