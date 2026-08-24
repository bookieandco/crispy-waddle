import type { LiveChannel, LiveChannelProvider, LiveProgram } from '@jhadina/tv-core';

export interface JellyfinLiveTvClient {
  getLiveTvChannels(request: { userId: string; limit?: number; startIndex?: number }): Promise<any>;
  getLiveTvPrograms(request: { userId: string; channelIds?: string[]; minStartDate?: string; maxEndDate?: string; limit?: number }): Promise<any>;
}

export interface JellyfinLiveTvConfig {
  client: JellyfinLiveTvClient;
  userId: string;
  serverUrl: string;
  channelUrlFactory?: (channelId: string) => string;
}

function channelKind(channel: any): LiveChannel['kind'] {
  return channel.ChannelType === 'TvChannel' ? 'live' : 'live';
}

function channelUrl(serverUrl: string, channelId: string, factory?: (channelId: string) => string): string {
  return factory?.(channelId) ?? `${serverUrl.replace(/\/$/, '')}/LiveTv/Channels/${encodeURIComponent(channelId)}/stream`;
}

export class JellyfinLiveTVProvider implements LiveChannelProvider {
  readonly id = 'jellyfin-live-tv';
  readonly name = 'Jellyfin Live TV';
  readonly provenance = 'jellyfin' as const;

  constructor(private readonly config: JellyfinLiveTvConfig) {}

  async listChannels(): Promise<LiveChannel[]> {
    const response = await this.config.client.getLiveTvChannels({ userId: this.config.userId });
    const channels = response?.Items ?? response?.items ?? [];

    return channels
      .filter((channel: any) => channel?.Id && channel?.Name)
      .map((channel: any): LiveChannel => ({
        id: `jellyfin:${channel.Id}`,
        providerId: this.id,
        kind: channelKind(channel),
        name: channel.Name,
        logoUrl: channel.ImageTags?.Primary
          ? `${this.config.serverUrl.replace(/\/$/, '')}/Items/${encodeURIComponent(channel.Id)}/Images/Primary`
          : undefined,
        group: channel.ChannelType,
        country: channel.Country,
        language: channel.Language,
        sourceUrl: channelUrl(this.config.serverUrl, channel.Id, this.config.channelUrlFactory),
        provenance: this.provenance,
      }));
  }

  async listPrograms(channelId?: string, window?: { from?: string; to?: string }): Promise<LiveProgram[]> {
    const rawChannelId = channelId?.replace(/^jellyfin:/, '');
    const response = await this.config.client.getLiveTvPrograms({
      userId: this.config.userId,
      ...(rawChannelId ? { channelIds: [rawChannelId] } : {}),
      ...(window?.from ? { minStartDate: window.from } : {}),
      ...(window?.to ? { maxEndDate: window.to } : {}),
    });
    const programs = response?.Items ?? response?.items ?? [];

    return programs
      .filter((program: any) => program?.Id && program?.Name && program?.StartDate)
      .map((program: any): LiveProgram => ({
        id: `jellyfin:${program.Id}`,
        channelId: `jellyfin:${program.ChannelId}`,
        title: program.Name,
        description: program.Overview,
        startsAt: program.StartDate,
        endsAt: program.EndDate,
      }));
  }
}
