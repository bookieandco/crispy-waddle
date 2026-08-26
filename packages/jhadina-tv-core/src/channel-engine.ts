import type { MediaTitle } from './index';

export interface JhadinaChannelDefinition {
  id: string;
  name: string;
  description?: string;
  genres?: string[];
  channelNumber?: number;
  durationMinutes?: number;
}

export interface JhadinaScheduledItem {
  id: string;
  channelId: string;
  titleId: string;
  title: string;
  startTime: string;
  endTime: string;
}

export interface JhadinaChannelSchedule {
  channel: JhadinaChannelDefinition;
  items: JhadinaScheduledItem[];
}

export interface JhadinaChannelEngine {
  generateSchedule(channel: JhadinaChannelDefinition, catalog: MediaTitle[], from: string, to: string): JhadinaChannelSchedule;
}

const normalize = (value: string) => value.trim().toLowerCase();

function overlapsGenre(title: MediaTitle, genres: string[]): boolean {
  if (!genres?.length) return true;
  const wanted = new Set(genres.map(normalize));
  return title.genres.some((genre) => wanted.has(normalize(genre)));
}

export function createJhadinaChannelEngine(): JhadinaChannelEngine {
  return {
    generateSchedule(channel, catalog, from, to) {
      const start = new Date(from);
      const end = new Date(to);
      const duration = Math.max(1, channel.durationMinutes ?? 120);
      const candidates = catalog.filter((title) => overlapsGenre(title, channel.genres ?? []));
      if (!candidates.length || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        return { channel, items: [] };
      }

      const items: JhadinaScheduledItem[] = [];
      let cursor = start.getTime();
      let index = 0;
      while (cursor < end.getTime()) {
        const title = candidates[index % candidates.length];
        const itemStart = new Date(cursor);
        const itemEnd = new Date(Math.min(cursor + duration * 60_000, end.getTime()));
        items.push({
          id: `${channel.id}:${title.id}:${itemStart.toISOString()}`,
          channelId: channel.id,
          titleId: title.id,
          title: title.title,
          startTime: itemStart.toISOString(),
          endTime: itemEnd.toISOString(),
        });
        cursor = itemEnd.getTime();
        index += 1;
      }
      return { channel, items };
    },
  };
}
