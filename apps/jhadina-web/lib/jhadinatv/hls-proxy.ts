import { createHmac, timingSafeEqual } from 'node:crypto';

/** Bind an HLS subresource path to the exact owner/cast media capability. */
export function hlsResourceSignature(path: string, rootToken: string, secret: string): string {
  return createHmac('sha256', secret).update('jtv-hls-v1\n').update(rootToken).update('\n').update(path).digest('base64url');
}
export function verifyHlsResourceSignature(path: string, token: string, signature: string, secret: string): boolean {
  if (!signature || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return false;
  const expected = Buffer.from(hlsResourceSignature(path, token, secret), 'base64url');
  const candidate = Buffer.from(signature, 'base64url');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/**
 * No redirects or third-party fetching. Only descendants of the initial media
 * stream directory can be rewritten, preserving asset scope.
 */
export function admittedHlsResource(value: string, playlistUrl: URL, streamUrl: URL): string {
  if (value.length > 1500 || /[\u0000-\u001f]/.test(value)) throw new Error('Invalid HLS resource.');
  const url = new URL(value, playlistUrl);
  const directory = streamUrl.pathname.slice(0, streamUrl.pathname.lastIndexOf('/') + 1);
  if (url.protocol !== 'https:' || url.origin !== streamUrl.origin ||
      url.username || url.password || url.hash || !url.pathname.startsWith(directory)) {
    throw new Error('HLS resource is outside the admitted media stream directory.');
  }
  // Provider bearer strings must never appear inside browser-visible segment URLs.
  for (const encoded of url.pathname.split('/')) {
    const segment = decodeURIComponent(encoded);
    if (segment === '.' || segment === '..' || segment.includes('/') ||
        segment.includes('\\') || segment.includes('%') || segment.includes('\0')) {
      throw new Error('Unsafe HLS path encoding.');
    }
  }
  for (const key of url.searchParams.keys()) {
    if (/^(?:api[_-]?key|token|access[_-]?token|authorization|password|secret|auth)$/i.test(key)) {
      throw new Error('Credential-bearing HLS subresource is not admitted.');
    }
  }
  return url.pathname + url.search;
}

export function rewriteJtvHlsPlaylist(
  original: string,
  playlistUrl: URL,
  streamUrl: URL,
  publicProxy: URL,
  rootToken: string,
  secret: string,
): string {
  if (original.length > 1_500_000) throw new Error('HLS manifest exceeds safety limit.');
  const link = (raw: string): string => {
    const path = admittedHlsResource(raw, playlistUrl, streamUrl);
    const url = new URL(publicProxy);
    url.searchParams.set('resource', path);
    url.searchParams.set('resourceSig', hlsResourceSignature(path, rootToken, secret));
    return url.toString();
  };
  return original.split(/\r?\n/).map(line => {
    if (!line.trim()) return line;
    if (line.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => `URI="${link(uri)}"`);
    }
    return link(line.trim());
  }).join('\n');
}

/** Stop collecting untrusted provider manifests before they exceed the limit. */
export async function readBoundedHlsManifest(
  body: ReadableStream<Uint8Array> | null, maxBytes = 1_500_000,
): Promise<string> {
  if (!body || !Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error('Missing or invalid HLS manifest body.');
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error('HLS manifest exceeds safety limit.');
      chunks.push(value);
    }
    const full = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { full.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder('utf-8', { fatal: true }).decode(full);
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}
