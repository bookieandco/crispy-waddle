/** JhadinaTV domain contracts. Provider-specific details stay behind adapters. */
export type TVDeviceProtocol = 'bluetooth' | 'google-cast' | 'airplay' | 'dlna' | 'native';
export type TVDeviceKind = 'tv' | 'receiver' | 'speaker' | 'streaming-device';

export interface TVDeviceCapabilities {
  canPlayVideo: boolean;
  canPause: boolean;
  canSeek: boolean;
  canSetVolume: boolean;
  canPower: boolean;
}

export interface TVDevice {
  id: string;
  name: string;
  kind: TVDeviceKind;
  protocol: TVDeviceProtocol;
  connected: boolean;
  capabilities: TVDeviceCapabilities;
}

export interface MediaItem {
  id: string;
  title: string;
  type: 'movie' | 'episode' | 'live-channel' | 'video';
  description?: string;
  artworkUrl?: string;
  playbackUrl?: string;
  sourceId?: string;
  externalIds?: Record<string, string>;
}

export interface PlaybackState {
  mediaId?: string;
  deviceId?: string;
  status: 'idle' | 'connecting' | 'playing' | 'paused' | 'stopped' | 'error';
  positionSeconds: number;
  durationSeconds?: number;
  volume?: number;
  error?: string;
}

export interface TVSource {
  id: string;
  name: string;
  kind: 'iptv' | 'epg' | 'youtube' | 'metadata' | 'user-library';
  provenance: 'official' | 'public' | 'user-provided';
  enabled: boolean;
}

export interface TVDeviceAdapter {
  readonly protocol: TVDeviceProtocol;
  discover(): Promise<TVDevice[]>;
  connect(deviceId: string): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  play(deviceId: string, media: MediaItem): Promise<void>;
  pause(deviceId: string): Promise<void>;
  seek(deviceId: string, positionSeconds: number): Promise<void>;
  setVolume(deviceId: string, volume: number): Promise<void>;
}
