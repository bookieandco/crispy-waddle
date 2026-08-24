import type { LiveProgram } from '@jhadina/tv-core';

export interface XmltvProgram {
  channelId: string;
  start: string;
  stop?: string;
  title: string;
  description?: string;
}

function parseDate(value: string): string {
  const match = value.trim().match(/^(\d{14})(?:\s+([+-]\d{4}))?/);
  if (!match) throw new Error(`Invalid XMLTV date: ${value}`);
  const raw = match[1];
  const offset = match[2];
  const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}`;
  return offset ? `${iso}${offset.slice(0, 3)}:${offset.slice(3)}` : `${iso}Z`;
}

function text(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  return match?.[1]?.replace(/<[^>]+>/g, '').trim() || undefined;
}

export function parseXmltvPrograms(xml: string): XmltvProgram[] {
  const programs: XmltvProgram[] = [];
  const matches = xml.match(/<programme\b[\s\S]*?<\/programme>/gi) ?? [];

  for (const block of matches) {
    const channel = block.match(/\bchannel=["']([^"']+)["']/i)?.[1];
    const start = block.match(/\bstart=["']([^"']+)["']/i)?.[1];
    const stop = block.match(/\bstop=["']([^"']+)["']/i)?.[1];
    const title = text(block, 'title');
    if (!channel || !start || !title) continue;

    programs.push({
      channelId: channel,
      start: parseDate(start),
      ...(stop ? { stop: parseDate(stop) } : {}),
      title,
      ...(text(block, 'desc') ? { description: text(block, 'desc') } : {}),
    });
  }

  return programs;
}

export function mapXmltvProgramToLiveProgram(program: XmltvProgram): LiveProgram {
  return {
    id: `${program.channelId}:${program.start}:${program.title}`,
    channelId: program.channelId,
    title: program.title,
    description: program.description,
    startsAt: program.start,
    endsAt: program.stop,
  };
}
