import type { LiveChannel } from '@jhadina/tv-core';

export interface M3uChannelRecord {
  name: string;
  source: string;
  logoUrl?: string;
  group?: string;
  country?: string;
  language?: string;
  tvgId?: string;
  tvgName?: string;
}

const attributes = (line: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const re = /([\w-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line))) result[match[1]] = match[2];
  return result;
};

export function parseM3u(text: string): M3uChannelRecord[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const records: M3uChannelRecord[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const info = lines[i];
    if (!info.startsWith('#EXTINF:')) continue;
    const source = lines[i + 1];
    if (!source || source.startsWith('#')) continue;
    const attrs = attributes(info);
    const comma = info.indexOf(',');
    const name = (comma >= 0 ? info.slice(comma + 1).trim() : attrs['tvg-name'] ?? 'Unknown').trim();
    if (!name) continue;
    records.push({
      name,
      source,
      logoUrl: attrs['tvg-logo'],
      group: attrs['group-title'],
      country: attrs['tvg-country'],
      language: attrs['tvg-language'],
      tvgId: attrs['tvg-id'],
      tvgName: attrs['tvg-name'],
    });
  }
  return records;
}

export function m3uRecordsToChannels(records: M3uChannelRecord[], provenance: LiveChannel['provenance'] = 'public-free'): LiveChannel[] {
  return records.map((record, index) => ({
    id: record.tvgId || `${provenance}:${index}:${record.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name: record.name,
    kind: 'iptv',
    source: record.source,
    logoUrl: record.logoUrl,
    group: record.group,
    country: record.country,
    language: record.language,
    tvgId: record.tvgId,
    tvgName: record.tvgName,
    provenance,
  }));
}
