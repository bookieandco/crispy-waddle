import type { NextApiRequest, NextApiResponse } from 'next';
import { getJellyfinProxyConfig } from '../../../../lib/jhadinatv/jellyfin-provider';

function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function safePath(template: string, id: string): string {
  const path = template.replaceAll('{id}', encodeURIComponent(id));
  if (!path.startsWith('/')) throw new Error('Jellyfin stream path template must start with /.');
  return path;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const config = getJellyfinProxyConfig();
  if (!config) return res.status(503).json({ error: 'Jellyfin provider is not admitted.' });

  const id = single(req.query.id).trim();
  const mode = single(req.query.mode) === 'live' ? 'live' : 'vod';
  if (!id || !/^[A-Za-z0-9._:-]+$/.test(id)) return res.status(400).json({ error: 'Invalid Jellyfin media id.' });

  const template = mode === 'live' ? config.liveStreamPathTemplate : config.vodStreamPathTemplate;
  const upstreamUrl = new URL(safePath(template, id), config.serverUrl);
  if (mode === 'vod' && !upstreamUrl.searchParams.has('static')) upstreamUrl.searchParams.set('static', 'true');

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    const headers: Record<string, string> = {
      'X-Emby-Token': config.apiKey,
      Accept: req.headers.accept ?? '*/*',
    };
    if (typeof req.headers.range === 'string') headers.Range = req.headers.range;

    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      signal: controller.signal,
      cache: 'no-store',
    });

    res.status(upstream.status);
    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control', 'etag', 'last-modified']) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.method === 'HEAD' || !upstream.body) return res.end();

    const reader = upstream.body.getReader();
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      res.write(Buffer.from(chunk.value));
    }
    res.end();
  } catch (cause) {
    if (controller.signal.aborted) return;
    if (!res.headersSent) res.status(502).json({ error: cause instanceof Error ? cause.message : 'Jellyfin stream proxy failed.' });
    else res.end();
  }
}
