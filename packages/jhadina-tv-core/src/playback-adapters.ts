import type { MediaItem } from './media-domain';
import type { PlaybackAdapter } from './playback';

/** Selects authorized provider playback before attempting direct source playback. */
export function resolvePlaybackAdapter(item: MediaItem, adapters: PlaybackAdapter[]): PlaybackAdapter | undefined {
  return adapters.find((adapter) => adapter.supports(item));
}

export function createDirectSourceAdapter(id = 'direct'): PlaybackAdapter {
  return {
    id,
    kind: 'direct',
    supports: (item) => Boolean(item.playbackUrl) && item.provider !== 'youtube',
    async create() {
      throw new Error('DirectSourceAdapter requires a browser playback implementation.');
    },
  };
}

export function createYouTubePlaybackAdapter(id = 'youtube'): PlaybackAdapter {
  return {
    id,
    kind: 'youtube',
    supports: (item) => item.provider === 'youtube',
    async create() {
      throw new Error('YouTubePlaybackAdapter requires an authorized YouTube player implementation.');
    },
  };
}
