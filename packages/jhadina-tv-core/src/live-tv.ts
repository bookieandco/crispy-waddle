export type LiveChannelKind = 'broadcast' | 'cable' | 'satellite' | 'iptv' | 'web';
export type LiveSourceProvenance = 'user-configured' | 'jellyfin' | 'public-free' | 'licensed' | 'unknown';

export interface LiveChannel {
  /** Stable channel identity inside JhadinaTV. */
  id: string;
  /** Catalog provider that owns playback resolution for this channel. */
  providerId: string;
  /** Provider-native channel identity; never treated as a playable URL. */
  providerChannelId: string;
  /** Canonical media id used by the existing watch/playback route. */
  mediaId: string;
  name: string;
  kind: LiveChannelKind;
  logoUrl?: string;
  group?: string;
  country?: string;
  language?: string;
  tvgId?: string;
  tvgName?: string;
  channelNumber?: string;
  provenance: LiveSourceProvenance;
}

export interface LiveProgram {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  episodeTitle?: string;
  category?: string;
}

export interface LiveChannelProvider {
  readonly id: string;
  readonly name: string;
  listChannels(): Promise<LiveChannel[]>;
  getPrograms?(channelId: string, from?: string, to?: string): Promise<LiveProgram[]>;
}

export function assertLiveChannel(channel: LiveChannel): LiveChannel {
  if (!channel.id.trim() || !channel.providerId.trim() || !channel.providerChannelId.trim() || !channel.mediaId.trim() || !channel.name.trim()) {
    throw new Error('JhadinaTV live channel identity fields are required.');
  }
  return channel;
}
