import type { NextApiRequest, NextApiResponse } from 'next';
import { requireJtvOwner } from '../../../../lib/jhadinatv/server-viewer';

/**
 * Metadata-only international TV directory. Fixed upstream, no caller URL,
 * no playback streams, credentials, EPG scraping, redirects or auto-admission.
 * Data: https://github.com/iptv-org/api (channel origin isn't a license).
 */
interface WorldChannel {
  id: string;
  name: string;
  country: string;
  categories: string[];
  website?: string;
  access: 'discovery-only';
}
type UpstreamChannel = { id?: unknown; name?: unknown; country?: unknown; categories?: unknown;
  website?: unknown; is_nsfw?: unknown; closed?: unknown };
const upstream = 'https://iptv-org.github.io/api/channels.json';
let cached: { loadedAt: number; rows: UpstreamChannel[] } | null = null;

function safeWebsite(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 500) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    return url.toString();
  } catch { return undefined; }
}
async function channelData(): Promise<UpstreamChannel[]> {
  if (cached && Date.now() - cached.loadedAt < 6 * 60 * 60_000) return cached.rows;
  const resp = await fetch(upstream, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12_000),
    headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error('World channel directory is temporarily unavailable.');
  const length = Number(resp.headers.get('content-length') ?? 0);
  if (length > 12_000_000) throw new Error('Directory exceeds size budget.');
  // Do not proxy arbitrary user-supplied URLs or stream URLs.
  const body = await resp.text();
  if (body.length > 12_000_000) throw new Error('Directory exceeds size budget.');
  const json = JSON.parse(body) as unknown;
  if (!Array.isArray(json)) throw new Error('Invalid channel directory data.');
  cached = { loadedAt: Date.now(), rows: json as UpstreamChannel[] };
  return cached.rows;
}
function single(v: unknown): string { return typeof v === 'string' ? v.trim() : ''; }

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  res.setHeader('Cache-Control', 'private, max-age=180');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!(await requireJtvOwner(req, res))) return;
  const country = single(req.query.country).toUpperCase().slice(0, 2);
  const q = single(req.query.q).toLowerCase().slice(0, 90);
  if (country && !/^[A-Z]{2}$/.test(country)) { res.status(400).json({ error: 'Invalid country' }); return; }
  try {
    const raw = await channelData();
    const rows: WorldChannel[] = [];
    for (const item of raw) {
      if (item.is_nsfw || item.closed || typeof item.id !== 'string' || typeof item.name !== 'string' ||
          typeof item.country !== 'string' || !item.name || item.name.length > 180 || !/^[A-Z]{2}$/.test(item.country)) continue;
      if (country && item.country !== country) continue;
      if (q && !(`${item.name} ${item.id} ${Array.isArray(item.categories) ? item.categories.join(' ') : ''}`).toLowerCase().includes(q)) continue;
      rows.push({
        id: item.id.slice(0, 180), name: item.name, country: item.country,
        categories: (Array.isArray(item.categories) ? item.categories : []).filter((v): v is string => typeof v === 'string').slice(0, 5),
        website: safeWebsite(item.website), access: 'discovery-only',
      });
      if (rows.length === 80) break;
    }
    res.status(200).json({ channels: rows, shown: rows.length, catalogTotal: raw.length,
      note: 'Directory metadata only. Listings are not guaranteed to be available or licensed for embedded playback.' });
  } catch {
    res.status(502).json({ error: 'World channel metadata could not be loaded. Your personal playlist is unaffected.' });
  }
}
