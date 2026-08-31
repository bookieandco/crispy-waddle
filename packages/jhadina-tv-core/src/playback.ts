import type { MediaItem, MediaSessionSnapshot } from './media-domain';
import type { LocalPlaybackAdapter, UnifiedMediaSession } from './media-session';
import type { CastingManager } from './casting';

export type PlaybackAdapterKind = 'direct' | 'youtube' | 'remote';

export interface PlaybackHost {
  play(): Promise<void>;
  pause(): void;
  seek(positionSeconds: number): void;
  setVolume(value: number): void;
  getState(): LocalPlaybackAdapter['getState'] extends () => infer T ? T : never;
  onStateChange(listener: (state: ReturnType<LocalPlaybackAdapter['getState']>) => void): () => void;
  destroy?(): void;
}

export interface PlaybackAdapterContext {
  item: MediaItem;
  casting: CastingManager;
  host?: PlaybackHost;
}

export interface PlaybackAdapter {
  readonly kind: PlaybackAdapterKind;
  readonly id: string;
  supports(item: MediaItem): boolean;
  create(context: PlaybackAdapterContext): Promise<LocalPlaybackAdapter>;
}

export interface DirectSourcePlaybackAdapter extends PlaybackAdapter { readonly kind: 'direct'; }
export interface YouTubePlaybackAdapter extends PlaybackAdapter { readonly kind: 'youtube'; }
export interface RemotePlaybackAdapter extends PlaybackAdapter { readonly kind: 'remote'; }

export interface PlaybackResolver {
  resolve(item: MediaItem): PlaybackAdapter | undefined;
  list(): PlaybackAdapter[];
}

export function createPlaybackResolver(adapters: PlaybackAdapter[]): PlaybackResolver {
  const registered = [...adapters];
  return { resolve(item) { return registered.find((adapter) => adapter.supports(item)); }, list() { return [...registered]; } };
}

export interface ResolvedPlaybackSession { adapter: PlaybackAdapter; session: UnifiedMediaSession; }
export interface PlaybackSessionFactory { create(item: MediaItem, context: PlaybackAdapterContext): Promise<ResolvedPlaybackSession>; }
export type PlaybackSnapshot = MediaSessionSnapshot;
