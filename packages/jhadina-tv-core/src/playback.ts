import type { MediaItem, MediaSessionSnapshot } from './media-domain';
import type { LocalPlaybackAdapter, UnifiedMediaSession } from './media-session';
import type { CastingManager } from './casting';

export type PlaybackAdapterKind = 'direct' | 'youtube' | 'remote';

export interface PlaybackAdapterContext {
  item: MediaItem;
  casting: CastingManager;
}

export interface PlaybackAdapter {
  readonly kind: PlaybackAdapterKind;
  readonly id: string;
  supports(item: MediaItem): boolean;
  create(context: PlaybackAdapterContext): Promise<LocalPlaybackAdapter>;
}

export interface DirectSourcePlaybackAdapter extends PlaybackAdapter {
  readonly kind: 'direct';
}

export interface YouTubePlaybackAdapter extends PlaybackAdapter {
  readonly kind: 'youtube';
}

export interface RemotePlaybackAdapter extends PlaybackAdapter {
  readonly kind: 'remote';
}

export interface PlaybackResolver {
  resolve(item: MediaItem): PlaybackAdapter | undefined;
  list(): PlaybackAdapter[];
}

export function createPlaybackResolver(adapters: PlaybackAdapter[]): PlaybackResolver {
  const registered = [...adapters];
  return {
    resolve(item) { return registered.find((adapter) => adapter.supports(item)); },
    list() { return [...registered]; },
  };
}

export interface ResolvedPlaybackSession {
  adapter: PlaybackAdapter;
  session: UnifiedMediaSession;
}

export interface PlaybackSessionFactory {
  create(item: MediaItem, context: PlaybackAdapterContext): Promise<ResolvedPlaybackSession>;
}

export type PlaybackSnapshot = MediaSessionSnapshot;
