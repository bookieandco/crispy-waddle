/**
 * Optional, authenticated image-editing bridge for a privately hosted Unsloth
 * diffusion worker. This is a PUPSON protocol, NOT a claim that Unsloth Studio
 * natively implements this HTTP endpoint.
 *
 * The host must expose POST /v1/pupson/image/edit and translate this payload
 * to a supported Unsloth reference/edit workflow. Never send pet images to a
 * general-purpose public image URL.
 */
export interface LocalImageReference {
  bytes: Buffer;
  mimeType: string;
}
export interface LocalImageRequest {
  prompt: string;
  references: readonly LocalImageReference[];
}
export interface LocalImageResult {
  model: string;
  imageBase64: string;
}
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 90_000;

export function localImageWorkerConfig(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.PUPSON_LOCAL_IMAGE_WORKER_URL?.trim();
  const token = env.PUPSON_LOCAL_IMAGE_WORKER_TOKEN?.trim();
  const model = env.PUPSON_LOCAL_IMAGE_MODEL?.trim();
  if (!raw || !token || !model) {
    throw new Error('Local image worker URL, token and model must all be configured.');
  }
  if (token.length < 32) throw new Error('Local image worker token must be at least 32 characters.');
  const url = new URL(raw);
  const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  const allowedLocal = env.NODE_ENV !== 'production' && loopback && url.protocol === 'http:';
  if (!(url.protocol === 'https:' || allowedLocal) ||
      url.username || url.password || url.search || url.hash ||
      url.pathname !== '/v1/pupson/image/edit') {
    throw new Error('Local image worker requires a clean HTTPS /v1/pupson/image/edit URL (loopback HTTP only in development).');
  }
  if (model.length > 200) throw new Error('Local image model identifier is too long.');
  return { url: url.toString(), token, model };
}

function assertImageBase64(encoded: string): string {
  if (!encoded || encoded.length > Math.ceil(MAX_OUTPUT_BYTES * 4 / 3) + 8 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error('Local image worker returned invalid or oversized image data.');
  }
  const bytes = Buffer.from(encoded, 'base64');
  const png = bytes.length >= 8 && bytes.subarray(0, 8).equals(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  );
  const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!bytes.length || bytes.length > MAX_OUTPUT_BYTES || !(png || jpeg || webp)) {
    throw new Error('Local image worker returned unsupported image bytes.');
  }
  return encoded;
}

export async function generateWithLocalImageWorker(
  request: LocalImageRequest,
  env: NodeJS.ProcessEnv = process.env
): Promise<LocalImageResult> {
  const { url, token, model } = localImageWorkerConfig(env);
  if (request.references.length < 1 || request.references.length > 3) {
    throw new Error('Local image worker requires one to three pet references.');
  }
  for (const ref of request.references) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(ref.mimeType) ||
        ref.bytes.length < 1 || ref.bytes.length > MAX_REFERENCE_BYTES) {
      throw new Error('Local image worker received an invalid pet reference.');
    }
  }
  if (!request.prompt.trim() || request.prompt.length > 8_000) {
    throw new Error('Local image worker requires a bounded image prompt.');
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      schema: 'pupson.local-image-edit.v1',
      engine: 'unsloth',
      model,
      prompt: request.prompt,
      reference_images: request.references.map((ref) => ({
        mime_type: ref.mimeType,
        image_base64: ref.bytes.toString('base64'),
      })),
    }),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    // Do not propagate arbitrary provider bodies: they may echo customer input.
    throw new Error(`Local image worker failed with HTTP ${response.status}.`);
  }
  if (Number(response.headers.get('content-length') || 0) > 30 * 1024 * 1024) {
    throw new Error('Local image worker response exceeded the size limit.');
  }
  const payload = await response.json() as Record<string, unknown>;
  if (payload.schema !== 'pupson.local-image-edit-result.v1' ||
      payload.model !== model || payload.engine !== 'unsloth' ||
      typeof payload.image_base64 !== 'string') {
    throw new Error('Local image worker response did not match the certified protocol/model.');
  }
  return { model, imageBase64: assertImageBase64(payload.image_base64) };
}
