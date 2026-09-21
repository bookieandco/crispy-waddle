import { toFile } from 'openai';

export type BackgroundMode = 'auto' | 'transparent' | 'keep' | 'generate';
export type BackgroundRemovalProvider = 'backgroundremover' | 'knockout';

export interface BackgroundRemovalResult {
  bytes: Buffer;
  mimeType: 'image/png' | string;
  provider: BackgroundRemovalProvider | 'none';
  model?: string;
}

function configuredProvider(env: NodeJS.ProcessEnv = process.env): BackgroundRemovalProvider | null {
  const explicit = env.PUPSON_BACKGROUND_REMOVER_PROVIDER?.trim();
  if (explicit === 'backgroundremover' || explicit === 'knockout') return explicit;
  if (env.PUPSON_BACKGROUND_REMOVER_URL?.trim()) return 'backgroundremover';
  if (env.KNOCKOUT_TOKEN?.trim()) return 'knockout';
  return null;
}

function contentType(response: Response): string {
  return response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';
}

async function removeWithBackgroundRemover(
  bytes: Buffer,
  mimeType: string,
  env: NodeJS.ProcessEnv
): Promise<BackgroundRemovalResult> {
  const baseUrl = env.PUPSON_BACKGROUND_REMOVER_URL?.replace(/\/$/, '');
  if (!baseUrl) throw new Error('PUPSON_BACKGROUND_REMOVER_URL is not configured.');
  const url = new URL(baseUrl);
  url.searchParams.set('model', env.PUPSON_BACKGROUND_REMOVER_MODEL?.trim() || 'u2net');
  url.searchParams.set('a', 'true');
  url.searchParams.set('ae', env.PUPSON_BACKGROUND_REMOVER_ERODE?.trim() || '12');

  const form = new FormData();
  form.append('file', await toFile(bytes, 'pet-input', { type: mimeType }));
  const headers: Record<string, string> = {};
  if (env.PUPSON_BACKGROUND_REMOVER_TOKEN?.trim()) {
    headers.Authorization = `Bearer ${env.PUPSON_BACKGROUND_REMOVER_TOKEN.trim()}`;
  }
  const response = await fetch(url, { method: 'POST', headers, body: form });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`BackgroundRemover failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const out = Buffer.from(await response.arrayBuffer());
  if (!out.length) throw new Error('BackgroundRemover returned an empty image.');
  return {
    bytes: out,
    mimeType: contentType(response),
    provider: 'backgroundremover',
    model: env.PUPSON_BACKGROUND_REMOVER_MODEL?.trim() || 'u2net',
  };
}

async function removeWithKnockout(
  bytes: Buffer,
  mimeType: string,
  env: NodeJS.ProcessEnv
): Promise<BackgroundRemovalResult> {
  const token = env.KNOCKOUT_TOKEN?.trim();
  if (!token) throw new Error('KNOCKOUT_TOKEN is not configured.');
  const endpoint =
    env.PUPSON_KNOCKOUT_URL?.trim() || 'https://useknockout--api.modal.run/remove';
  const form = new FormData();
  form.append('file', await toFile(bytes, 'pet-input', { type: mimeType }));
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Knockout background removal failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const out = Buffer.from(await response.arrayBuffer());
  if (!out.length) throw new Error('Knockout returned an empty image.');
  return { bytes: out, mimeType: contentType(response), provider: 'knockout', model: 'BiRefNet' };
}

/**
 * Privacy-first background-removal boundary.
 *
 * Nothing is uploaded to a remover unless the shopper selected the default
 * removal behavior and an explicit provider is configured. "keep" is the
 * only mode that bypasses preprocessing.
 */
export async function removeBackground(
  bytes: Buffer,
  mimeType: string,
  mode: BackgroundMode,
  env: NodeJS.ProcessEnv = process.env
): Promise<BackgroundRemovalResult> {
  if (mode === 'keep' || mode === 'generate') {
    return { bytes, mimeType, provider: 'none' };
  }
  const provider = configuredProvider(env);
  if (!provider) {
    throw new Error(
      'Background removal is the default for PupsonStuff, but no background-removal provider is configured.'
    );
  }
  return provider === 'knockout'
    ? removeWithKnockout(bytes, mimeType, env)
    : removeWithBackgroundRemover(bytes, mimeType, env);
}

export function backgroundRemovalConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return configuredProvider(env) !== null;
}
