import type { MediaItem } from './media-domain';
import type { LocalPlaybackAdapter } from './media-session';
import type { PlaybackAdapter, PlaybackAdapterContext, PlaybackHost } from './playback';

function requireHost(context: PlaybackAdapterContext, adapterId: string): PlaybackHost {
  if (!context.host) throw new Error(`${adapterId} requires a browser playback host.`);
  return context.host;
}

export function resolvePlaybackAdapter(item: MediaItem, adapters: PlaybackAdapter[]): PlaybackAdapter | undefined {
  return adapters.find((adapter) => adapter.supports(item));
}

function hostAdapter(context: PlaybackAdapterContext, kind: 'direct' | 'youtube', id: string): LocalPlaybackAdapter {
  const host = requireHost(context, id);
  return {
    getState: () => host.getState(),
    async apply(command) {
      if (command.type === 'play') await host.play();
      else if (command.type === 'pause') host.pause();
      else if (command.type === 'seek') host.seek(command.value ?? 0);
      else if (command.type === 'set-volume') host.setVolume(command.value ?? 1);
    },
    onStateChange: host.onStateChange,
    destroy: () => host.destroy?.(),
  };
}

export function createDirectSourceAdapter(id = 'direct'): PlaybackAdapter {
  return {
    id, kind: 'direct',
    supports: (item) => Boolean(item.playbackUrl) && item.provider !== 'youtube',
    async create(context) { return hostAdapter(context, 'direct', id); },
  };
}

export function createYouTubePlaybackAdapter(id = 'youtube'): PlaybackAdapter {
  return {
    id, kind: 'youtube',
    supports: (item) => item.provider === 'youtube',
    async create(context) { return hostAdapter(context, 'youtube', id); },
  };
}
