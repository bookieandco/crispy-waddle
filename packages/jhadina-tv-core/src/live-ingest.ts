import type { LiveProgram } from './live-tv';

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

export interface XmltvProgram {
  channelId: string;
  start: string;
  stop: string;
  title: string;
  description?: string;
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

function parseXmltvDate(value: string): string {
  const match = value.trim().match(/^(\d{14})(?:\s+([+-]\d{4}))?/);
  if (!match) throw new Error(`Invalid XMLTV date: ${value}`);
  const raw = match[1];
  const offset = match[2];
  const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}`;
  return offset ? `${iso}${offset.slice(0, 3)}:${offset.slice(3)}` : `${iso}Z`;
}

function tagText(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  return match?.[1]?.replace(/<[^>]+>/g, '').trim() || undefined;
}

export function parseXmltvPrograms(xml: string): XmltvProgram[] {
  const programs: XmltvProgram[] = [];
  const matches = xml.match(/<programme\b[\s\S]*?<\/programme>/gi) ?? [];
  for (const block of matches) {
    const channelId = block.match(/\bchannel=["']([^"']+)["']/i)?.[1];
    const start = block.match(/\bstart=["']([^"']+)["']/i)?.[1];
    const stop = block.match(/\bstop=["']([^"']+)["']/i)?.[1];
    const title = tagText(block, 'title');
    if (!channelId || !start || !stop || !title) continue;
    programs.push({
      channelId,
      start: parseXmltvDate(start),
      stop: parseXmltvDate(stop),
      title,
      description: tagText(block, 'desc'),
    });
  }
  return programs;
}

export function mapXmltvProgram(program: XmltvProgram, channelId = program.channelId): LiveProgram {
  return {
    id: `${channelId}:${program.start}:${program.title}`,
    channelId,
    title: program.title,
    description: program.description,
    startTime: program.start,
    endTime: program.stop,
  };
}
