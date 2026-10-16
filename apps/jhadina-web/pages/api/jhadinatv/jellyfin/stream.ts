import type { NextApiRequest, NextApiResponse } from 'next';
import { getJellyfinProxyConfig } from '../../../../lib/jhadinatv/jellyfin-provider';
import { jellyfinAssetIsAccessible, jtvEvidenceFingerprint } from '../../../../lib/jhadinatv/jellyfin-access';
import { requireJtvOwner } from '../../../../lib/jhadinatv/server-viewer';
import { verifyJtvStreamCapability, type JtvStreamMode } from '../../../../lib/jhadinatv/stream-capability';
import { admittedHlsResource, rewriteJtvHlsPlaylist, verifyHlsResourceSignature } from '../../../../lib/jhadinatv/hls-proxy';

function single(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

function safePath(template: string, id: string): string {
  const path = template.replaceAll('{id}', encodeURIComponent(id));
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\r\n#]/.test(path)) {
    throw new Error('Unsafe Jellyfin stream path template.');
  }
  // A URL constructor normalizes dot segments. Reject them before normalization
  // so a configured subpath cannot silently become a different Jellyfin endpoint.
  const pathname = path.split('?')[0];
  if (pathname.split('/').some(segment => {
    const decoded = decodeURIComponent(segment);
    return decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\');
  })) throw new Error('Unsafe Jellyfin stream path traversal.');
  return path;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<NextApiResponse | void> {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const config = getJellyfinProxyConfig();
  const secret = process.env.JHADINA_TV_STREAM_SIGNING_SECRET ?? '';
  const ownerId = process.env.JHADINA_TV_OWNER_AUTH_USER_ID?.trim();
  if (!config || !ownerId || Buffer.byteLength(secret) < 32) {
    return res.status(503).json({ error: 'JhadinaTV secure playback is not commissioned.' });
  }

  const assetId = single(req.query.id);
  const mode = single(req.query.mode) as JtvStreamMode;
  const token = single(req.query.token);
  const resource = single(req.query.resource);
  const resourceSig = single(req.query.resourceSig);
  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(assetId) || (mode !== 'live' && mode !== 'vod')) {
    return res.status(400).json({ error: 'Invalid Jellyfin media identity.' });
  }
  const claims = verifyJtvStreamCapability(token, secret);
  if (!claims || claims.ownerId !== ownerId || claims.assetId !== assetId || claims.mode !== mode ||
      claims.rightsEvidence !== jtvEvidenceFingerprint(config.rightsEvidenceIds)) {
    return res.status(403).json({ error: 'Missing, expired, or invalid media capability.' });
  }
  const territory = process.env.JHADINA_TV_TERRITORY?.trim() ?? '';
  if (claims.territory !== territory || (config.territories?.length && !config.territories.includes(territory))) {
    return res.status(403).json({ error: 'Territory is not admitted.' });
  }
  if (!config.rights.includes('playback') ||
      (claims.audience === 'cast' && !config.rights.includes('casting'))) {
    return res.status(403).json({ error: 'Required media right is unavailable.' });
  }

  // Browser streams require the live owner session. TV receiver URLs carry their
  // own signed, expiring cast-scoped capability because receivers lack browser cookies.
  if (claims.audience === 'local' && !(await requireJtvOwner(req, res))) return;

  if (!(await jellyfinAssetIsAccessible(config, assetId, mode))) {
    return res.status(403).json({ error: 'Media is no longer available to this library.' });
  }

  let upstreamUrl: URL;
  try {
    const template = mode === 'live' ? config.liveStreamPathTemplate : config.vodStreamPathTemplate;
    const base = new URL(config.serverUrl);
    const prefix = base.pathname.replace(/\/$/, '');
    upstreamUrl = new URL(`${prefix}${safePath(template, assetId)}`, base.origin);
    if (upstreamUrl.origin !== base.origin || upstreamUrl.protocol !== 'https:' ||
        (prefix && !upstreamUrl.pathname.startsWith(prefix + '/'))) {
      throw new Error('Cross-origin or escaped Jellyfin media path.');
    }
    if (mode === 'vod' && !upstreamUrl.searchParams.has('static')) upstreamUrl.searchParams.set('static', 'true');
  } catch {
    return res.status(503).json({ error: 'Jellyfin media route is not configured securely.' });
  }

  const streamUrl = new URL(upstreamUrl);
  if (resource || resourceSig) {
    if (!resource || resource.length > 1600 || !verifyHlsResourceSignature(resource, token, resourceSig, secret)) {
      return res.status(403).json({ error: 'Invalid HLS subresource signature.' });
    }
    try {
      const parsed = admittedHlsResource(resource, streamUrl, streamUrl);
      if (parsed !== resource) throw new Error('Non-canonical HLS resource.');
      upstreamUrl = new URL(resource, streamUrl.origin);
    } catch {
      return res.status(403).json({ error: 'HLS resource is outside the authorized media scope.' });
    }
  }
  const controller = new AbortController();
  req.on('aborted', () => controller.abort());
  res.on('close', () => controller.abort());

  try {
    const headers: Record<string, string> = {
      'X-Emby-Token': config.apiKey,
      Accept: typeof req.headers.accept === 'string' ? req.headers.accept : '*/*',
    };
    if (typeof req.headers.range === 'string') headers.Range = req.headers.range;

    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'error',
    });
    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type') ?? '';
    const isHls = /(?:mpegurl|x-mpegurl)/i.test(contentType) || /\\.m3u8(?:$|\\?)/i.test(upstreamUrl.pathname);
    if (isHls) {
      if (req.method === 'HEAD') {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl'); return res.end();
      }
      if (!upstream.ok) return res.end();
      try {
        const manifest = await upstream.text();
        const publicOrigin = process.env.JHADINA_PUBLIC_ORIGIN?.trim() ||
          (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
        if (!publicOrigin || new URL(publicOrigin).protocol !== 'https:') throw new Error('No trusted public origin.');
        const proxy = new URL('/api/jhadinatv/jellyfin/stream', publicOrigin);
        proxy.searchParams.set('id', assetId);
        proxy.searchParams.set('mode', mode);
        proxy.searchParams.set('token', token);
        const rewritten = rewriteJtvHlsPlaylist(manifest, upstreamUrl, streamUrl, proxy, token, secret);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Content-Length', Buffer.byteLength(rewritten));
        return res.end(rewritten);
      } catch {
        return res.status(502).json({ error: 'HLS manifest contains an unsupported or unsafe subresource.' });
      }
    }
    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    if (req.method === 'HEAD' || !upstream.body) return res.end();
    const reader = upstream.body.getReader();
    while (!controller.signal.aborted) {
      const chunk = await reader.read();
      if (chunk.done) break;
      res.write(Buffer.from(chunk.value));
    }
    res.end();
  } catch {
    if (controller.signal.aborted) return;
    if (!res.headersSent) res.status(502).json({ error: 'Jellyfin stream is unavailable.' });
    else res.end();
  }
}
