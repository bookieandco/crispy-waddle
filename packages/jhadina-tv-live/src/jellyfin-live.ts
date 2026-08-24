import type { LiveChannel, LiveChannelProvider, LiveProgram } from '@jhadina/tv-core';

export interface JellyfinLiveTvClient {
  getLiveTvChannels(request: { userId: string; limit?: number; startIndex?: number }): Promise<unknown>;
  getLiveTvPrograms(request: { userId: string; channelIds?: string[]; minStartDate?: string; maxEndDate?: string; limit?: number }): Promise<unknown>;
}

export interface JellyfinLiveTvConfig {
  client: JellyfinLiveTvClient;
  userId: string;
  serverUrl: string;
  channelUrlFactory?: (channelId: string) => string;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function channelUrl(serverUrl: string, channelId: string, factory?: (channelId: string) => string): string {
  return factory?.(channelId) ?? `${serverUrl.replace(/\/$/, '')}/LiveTv/Channels/${encodeURIComponent(channelId)}/stream`;
}

export class JellyfinLiveTVProvider implements LiveChannelProvider {
  readonly id = 'jellyfin-live-tv';
  readonly name = 'Jellyfin Live TV';

  constructor(private readonly config: JellyfinLiveTvConfig) {}

  async listChannels(): Promise<LiveChannel[]> {
    const response = asRecord(await this.config.client.getLiveTvChannels({ userId: this.config.userId }));
    const channels = Array.isArray(response.Items) ? response.Items : [];

    return channels
      .filter((channel) => channel?.Id && channel?.Name)
      .map((channel): LiveChannel => ({
        id: `jellyfin:${channel.Id}`,
        name: channel.Name,
        kind: 'broadcast',
        source: channelUrl(this.config.serverUrl, channel.Id, this.config.channelUrlFactory),
        logoUrl: channel.ImageTags?.Primary
          ? `${this.config.serverUrl.replace(/\/$/, '')}/Items/${encodeURIComponent(channel.Id)}/Images/Primary`
          : undefined,
        group: channel.ChannelType,
        country: channel.Country,
        language: channel.Language,
        tvgId: channel.Id,
        tvgName: channel.Name,
        provenance: 'jellyfin',
      }));
  }

  async getPrograms(channelId: string, from?: string, to?: string): Promise<LiveProgram[]> {
    const rawChannelId = channelId.replace(/^jellyfin:/, '');
    const response = asRecord(await this.config.client.getLiveTvPrograms({
      userId: this.config.userId,
      channelIds: [rawChannelId],
      ...(from ? { minStartDate: from } : {}),
      ...(to ? { maxEndDate: to } : {}),
    }));
    const programs = Array.isArray(response.Items) ? response.Items : [];

    return programs
      .filter((program) => program?.Id && program?.Name && program?.StartDate && program?.EndDate)
      .map((program): LiveProgram => ({
        id: `jellyfin:${program.Id}`,
        channelId: `jellyfin:${program.ChannelId ?? rawChannelId}`,
        title: program.Name,
        description: program.Overview,
        startTime: program.StartDate,
        endTime: program.EndDate,
        episodeTitle: program.SeriesName ? program.Name : undefined,
        category: program.Genres?.[0],
      }));
  }
}
