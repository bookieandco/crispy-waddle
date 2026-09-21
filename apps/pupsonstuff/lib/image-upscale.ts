import { toFile } from 'openai';
import sharp from 'sharp';

export interface UpscaleResult {
  bytes: Buffer;
  mimeType: string;
  provider: 'generic' | 'knockout' | 'none';
  model?: string;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
}

async function dimensions(bytes: Buffer) {
  const metadata = await sharp(bytes, { failOn: 'error' }).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) throw new Error('Image dimensions are unavailable.');
  return { width, height };
}

function endpoint(env: NodeJS.ProcessEnv): { url: string; provider: 'generic' | 'knockout' } | null {
  const explicit = env.PUPSON_UPSCALER_URL?.trim();
  if (explicit) return { url: explicit, provider: 'generic' };
  if (env.KNOCKOUT_TOKEN?.trim()) {
    return {
      url: 'https://useknockout--api.modal.run/upscale',
      provider: 'knockout',
    };
  }
  return null;
}

/**
 * Ensures the source artwork has enough real pixels for the requested
 * printed footprint. It never treats Sharp interpolation as new detail.
 *
 * The generic endpoint follows the self-hostable Knockout multipart shape:
 * file + scale + model + format and returns the image body.
 */
export async function ensureSourceResolution(input: {
  bytes: Buffer;
  mimeType: string;
  requiredWidth: number;
  requiredHeight: number;
  env?: NodeJS.ProcessEnv;
}): Promise<UpscaleResult> {
  const env = input.env ?? process.env;
  const original = await dimensions(input.bytes);
  if (original.width >= input.requiredWidth && original.height >= input.requiredHeight) {
    return {
      bytes: input.bytes,
      mimeType: input.mimeType,
      provider: 'none',
      originalWidth: original.width,
      originalHeight: original.height,
      width: original.width,
      height: original.height,
    };
  }

  const target = endpoint(env);
  if (!target) {
    throw new Error(
      `Artwork needs at least ${Math.ceil(input.requiredWidth)}×${Math.ceil(input.requiredHeight)} source pixels for this placement. Configure PUPSON_UPSCALER_URL or KNOCKOUT_TOKEN, or make the artwork smaller.`
    );
  }

  const scaleNeeded = Math.max(
    input.requiredWidth / original.width,
    input.requiredHeight / original.height
  );
  const scale = scaleNeeded <= 2 ? 2 : 4;
  if (scaleNeeded > 4) {
    throw new Error(
      'This placement would require more than 4× AI upscaling. Use a higher-resolution generation or reduce the artwork size.'
    );
  }

  const form = new FormData();
  form.append('file', await toFile(input.bytes, 'generated-artwork', { type: input.mimeType }));
  form.append('scale', String(scale));
  form.append('model', env.PUPSON_UPSCALER_MODEL?.trim() || 'swin2sr');
  form.append('format', 'png');

  const headers: Record<string, string> = {};
  const token =
    env.PUPSON_UPSCALER_TOKEN?.trim() ||
    (target.provider === 'knockout' ? env.KNOCKOUT_TOKEN?.trim() : undefined);
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(target.url, { method: 'POST', headers, body: form });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI upscaler failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const upscaled = await dimensions(bytes);
  if (upscaled.width < input.requiredWidth || upscaled.height < input.requiredHeight) {
    throw new Error(
      `AI upscaler returned ${upscaled.width}×${upscaled.height}, below the required ${Math.ceil(input.requiredWidth)}×${Math.ceil(input.requiredHeight)}.`
    );
  }
  return {
    bytes,
    mimeType: response.headers.get('content-type')?.split(';')[0] || 'image/png',
    provider: target.provider,
    model: env.PUPSON_UPSCALER_MODEL?.trim() || 'swin2sr',
    originalWidth: original.width,
    originalHeight: original.height,
    width: upscaled.width,
    height: upscaled.height,
  };
}

export function upscalerConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return endpoint(env) !== null;
}
