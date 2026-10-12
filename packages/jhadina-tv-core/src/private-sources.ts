import { parseM3u, parseXmltvPrograms } from './live-ingest';

/** A viewing-access declaration, never a claim of permission to rebroadcast. */
export type PrivateAccessKind =
  | 'personal-file'
  | 'owner-approved-playlist'
  | 'verified-free-stream'
  | 'official-player'
  | 'subscription-link'
  | 'discovery-only';

export interface PrivateChannel {
  id: string;
  name: string;
  url: string;
  logoUrl?: string;
  group?: string;
  country?: string;
  language?: string;
  tvgId?: string;
  access: 'owner-approved-playlist';
  reviewedAt: string;
}

export interface PrivateProgram {
  channelId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
}

export interface PrivateImportResult {
  channels: PrivateChannel[];
  skipped: number;
  warnings: string[];
}

export function assertPrivateAccess(kind: PrivateAccessKind, action: 'play' | 'open-link'): void {
  if (action === 'play' && !['personal-file', 'owner-approved-playlist', 'verified-free-stream'].includes(kind)) {
    throw new Error('This entry is discovery/link-only, not an authorized JhadinaTV stream.');
  }
}

/** URLs must not contain inline credentials or an insecure/downloader-only scheme. */
export function safePrivateStreamUrl(value: string): string | null {
  try {
    if (value.length > 2048 || /[\u0000-\u001f]/.test(value)) return null;
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || !url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}
export function safePrivateArtworkUrl(value?: string): string | undefined {
  if (!value) return undefined;
  const url = safePrivateStreamUrl(value);
  return url && /\.(?:png|jpe?g|webp|gif)(?:\?|$)/i.test(url) ? url : undefined;
}

/** Non-security deterministic identity; not a cryptographic proof of source legitimacy. */
function stableId(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 'private-' + (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Owner imports locally; this function does NOT prove broadcaster rights or
 * availability. Approval is explicit and never applied to a third-party feed.
 */
export function importOwnerApprovedM3u(text: string, acknowledged: boolean, now = new Date()): PrivateImportResult {
  if (!acknowledged) throw new Error('Confirm that these sources are permitted for your personal viewing first.');
  if (text.length > 512_000) throw new Error('Playlist is too large (500 KiB maximum).');
  const records = parseM3u(text);
  const channels: PrivateChannel[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const record of records) {
    const url = safePrivateStreamUrl(record.source);
    if (!url || seen.has(url) || !record.name.trim() || record.name.length > 160 || channels.length >= 500) {
      skipped++;
      continue;
    }
    seen.add(url);
    channels.push({
      id: stableId(url),
      name: record.name.slice(0, 160),
      url,
      logoUrl: safePrivateArtworkUrl(record.logoUrl),
      group: record.group?.slice(0, 80),
      country: record.country?.split(';')[0]?.trim().toUpperCase().slice(0, 8),
      language: record.language?.split(';')[0]?.trim().toLowerCase().slice(0, 12),
      tvgId: record.tvgId?.slice(0, 160),
      access: 'owner-approved-playlist',
      reviewedAt: now.toISOString(),
    });
  }
  return {
    channels, skipped,
    warnings: [
      'Owner approval is not independent proof of stream rights or availability.',
      ...(skipped ? [`${skipped} invalid, duplicate, insecure or overflow channel(s) skipped.`] : []),
    ],
  };
}

export function buildPrivateNowGuide(channels: readonly PrivateChannel[], xml: string, now = new Date()): Map<string, PrivateProgram> {
  if (xml.length > 2_000_000) throw new Error('Guide is too large (2 MB maximum).');
  const programs = parseXmltvPrograms(xml);
  const byId = new Map<string, PrivateProgram>();
  const ids = new Map(channels.filter(c => c.tvgId).map(c => [c.tvgId!, c.id]));
  const ts = now.getTime();
  for (const row of programs) {
    const channelId = ids.get(row.channelId);
    const start = Date.parse(row.start);
    const end = Date.parse(row.stop);
    if (!channelId || !Number.isFinite(start) || !Number.isFinite(end) || !(start <= ts && ts < end)) continue;
    const old = byId.get(channelId);
    if (!old || start > Date.parse(old.startTime)) {
      byId.set(channelId, { channelId, title: row.title, description: row.description, startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString() });
    }
  }
  return byId;
}
