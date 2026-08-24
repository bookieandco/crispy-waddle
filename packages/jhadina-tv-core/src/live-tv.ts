export type LiveChannelKind = 'broadcast' | 'cable' | 'satellite' | 'iptv' | 'web';
export type LiveSourceProvenance = 'user-configured' | 'jellyfin' | 'public-free' | 'licensed' | 'unknown';

export interface LiveChannel {
  id: string;
  name: string;
  kind: LiveChannelKind;
  source: string;
  logoUrl?: string;
  group?: string;
  country?: string;
  language?: string;
  tvgId?: string;
  tvgName?: string;
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
