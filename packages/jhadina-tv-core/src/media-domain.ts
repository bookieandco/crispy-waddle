export type MediaEntityKind =
  | 'movie'
  | 'show'
  | 'season'
  | 'episode'
  | 'video'
  | 'track'
  | 'album'
  | 'artist'
  | 'podcast'
  | 'live-event'
  | 'sports-event'
  | 'generated-asset';

export type MediaProviderKind =
  | 'youtube'
  | 'jhadina-library'
  | 'local'
  | 'jhadinatv'
  | 'licensed'
  | 'other';

export type MediaCapability =
  | 'play'
  | 'pause'
  | 'seek'
  | 'queue'
  | 'cast'
  | 'download'
  | 'edit'
  | 'export';

export interface MediaItem {
  id: string;
  providerId: string;
  provider: MediaProviderKind;
  kind: MediaEntityKind;
  title: string;
  subtitle?: string;
  description?: string;
  artworkUrl?: string;
  backdropUrl?: string;
  durationMs?: number;
  canonicalUrl?: string;
  playbackUrl?: string;
  capabilities: MediaCapability[];
  metadata?: Record<string, string | number | boolean | null>;
}

export interface MediaQueue {
  items: MediaItem[];
  currentIndex: number;
  shuffle: boolean;
  repeat: 'off' | 'one' | 'all';
}

export interface MediaPlaybackState {
  status: 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error';
  positionMs: number;
  durationMs?: number;
  volume: number;
  rate: number;
  error?: string;
}

export interface MediaSessionSnapshot {
  item?: MediaItem;
  queue: MediaQueue;
  playback: MediaPlaybackState;
  targetId?: string;
}

export interface MediaSourceReference {
  providerId: string;
  itemId: string;
  url: string;
  type: 'hls' | 'dash' | 'progressive' | 'external';
}

export interface MediaProviderCapabilities {
  kinds: MediaEntityKind[];
  supportsSearch: boolean;
  supportsBrowse: boolean;
  supportsSourceResolution: boolean;
}

export interface MediaProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: MediaProviderCapabilities;
  search(query: string): Promise<MediaItem[]>;
  get?(id: string): Promise<MediaItem | undefined>;
  resolveSources?(id: string): Promise<MediaSourceReference[]>;
  health?(): Promise<{ ok: boolean; message?: string }>;
}
