import type { ArtStyle } from '@/types/boutique';
import type { BackgroundMode } from '@/types/creative';
import { resolvePupsonCreativeProvider } from '@/lib/creative-provider';
import { backgroundRemovalConfigured } from '@/lib/background-removal';

/** No implicit purchases or external photo submissions just because a key
 * happens to exist in an inherited deployment environment. */
export function assertCreativeReady(
  style: ArtStyle,
  backgroundMode: BackgroundMode,
  env: NodeJS.ProcessEnv = process.env,
): { provider: string } {
  if (env.PUPSON_CREATIVE_JOBS_ENABLED !== 'true') {
    throw new Error('Private pet portrait generation is not activated on this deployment.');
  }
  const provider = resolvePupsonCreativeProvider(style);
  if (provider.id !== 'local' && env.PUPSON_REMOTE_CREATIVE_APPROVED !== 'true') {
    throw new Error('External image generation requires explicit owner approval.');
  }
  if (provider.id === 'openai' && !env.OPENAI_API_KEY?.trim()) {
    throw new Error('OpenAI image provider is not configured.');
  }
  if (provider.id === 'muapi' && !env.MUAPI_API_KEY?.trim()) {
    throw new Error('Muapi image provider is not configured.');
  }
  if (provider.id === 'unsloth' &&
      !(env.PUPSON_LOCAL_IMAGE_WORKER_URL && env.PUPSON_LOCAL_IMAGE_WORKER_TOKEN && env.PUPSON_LOCAL_IMAGE_MODEL)) {
    throw new Error('Private image worker is not configured.');
  }
  if ((backgroundMode === 'auto' || backgroundMode === 'transparent') &&
      !backgroundRemovalConfigured(env)) {
    throw new Error('Remove background requires a configured private background-removal service. Choose Keep or configure the service.');
  }
  if ((backgroundMode === 'auto' || backgroundMode === 'transparent') &&
      env.PUPSON_BACKGROUND_REMOVAL_APPROVED !== 'true') {
    throw new Error('Background removal requires explicit owner approval.');
  }
  return { provider: provider.id };
}
