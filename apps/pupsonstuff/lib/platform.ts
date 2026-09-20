import { createHash, randomBytes } from 'node:crypto';

export const OWNER_COOKIE = 'pupson_owner';

export interface PlatformConfig {
  url: string;
  serviceKey: string;
}

export function getPlatformConfig(): PlatformConfig | null {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceKey ? { url, serviceKey } : null;
}

export function requirePlatformConfig(): PlatformConfig {
  const config = getPlatformConfig();
  if (!config) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }
  return config;
}

export function newOwnerToken(): string {
  return randomBytes(32).toString('base64url');
}

export function ownerTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const config = requirePlatformConfig();
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function uploadPrivateAsset(params: {
  bucket: string;
  path: string;
  bytes: Buffer;
  contentType: string;
}): Promise<void> {
  const config = requirePlatformConfig();
  const response = await fetch(`${config.url}/storage/v1/object/${params.bucket}/${params.path}`, {
    method: 'POST',
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      'Content-Type': params.contentType,
      'x-upsert': 'false',
    },
    body: new Uint8Array(params.bytes),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase Storage upload failed (${response.status}): ${detail.slice(0, 500)}`);
  }
}

export async function createSignedAssetUrl(
  bucket: string,
  path: string,
  expiresIn = 600
): Promise<string> {
  const config = requirePlatformConfig();
  const response = await fetch(`${config.url}/storage/v1/object/sign/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn }),
  });
  if (!response.ok) throw new Error(`Could not sign private asset (${response.status}).`);
  const body = (await response.json()) as { signedURL?: string; signedUrl?: string };
  const signedPath = body.signedURL ?? body.signedUrl;
  if (!signedPath) throw new Error('Supabase Storage did not return a signed URL.');
  return signedPath.startsWith('http') ? signedPath : `${config.url}/storage/v1${signedPath}`;
}
