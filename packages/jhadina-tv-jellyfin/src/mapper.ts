import type { MediaKind, MediaTitle } from '@jhadina/tv-core';
import type { JellyfinItem } from './types';

const TICKS_PER_MINUTE = 600_000_000;

export function mapJellyfinItemToMediaTitle(item: JellyfinItem): MediaTitle | null {
  if (!item.Id || !item.Name) return null;

  const kind = mapKind(item.Type);
  if (!kind) return null;

  return {
    id: item.Id,
    kind,
    title: item.Name,
    overview: item.Overview ?? '',
    year: item.ProductionYear ?? 0,
    runtimeMinutes: item.RunTimeTicks ? Math.round(item.RunTimeTicks / TICKS_PER_MINUTE) : undefined,
    genres: item.Genres ?? [],
    rating: item.CommunityRating,
    posterUrl: undefined,
    backdropUrl: undefined,
    availability: 'owned',
  };
}

function mapKind(type: string | undefined): MediaKind | null {
  if (type === 'Movie' || type === 'Series' || type === 'Episode') return type === 'Movie' ? 'movie' : 'tv';
  return null;
}
