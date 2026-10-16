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
