import type { MediaSource, MediaSourceAdapter, MediaTitle } from '@jhadina/tv-core';
import { assertPlayableSource } from '@jhadina/tv-core';
import type { JellyfinApiTransport, JellyfinConnectionConfig, JellyfinItem, JellyfinMediaSource, JellyfinPlaybackInfoResponse } from './types';
import { mapJellyfinItemToMediaTitle } from './mapper';

export interface JellyfinPlaybackRequest {
  maxStreamingBitrate?: number;
  startTimeTicks?: number;
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
  maxAudioChannels?: number;
}

export class JellyfinSourceAdapter implements MediaSourceAdapter {
  readonly id = 'jellyfin';
  readonly name = 'Jellyfin';

  constructor(
    private readonly transport: JellyfinApiTransport,
    private readonly config: JellyfinConnectionConfig,
  ) {}

  async search(query: string): Promise<MediaTitle[]> {
    const response = await this.transport.get<{ Items?: JellyfinItem[] }>('/Items', {
      UserId: this.config.userId,
      SearchTerm: query,
      IncludeItemTypes: 'Movie,Series,Episode',
      Recursive: true,
      EnableUserData: true,
      Fields: 'Overview,Genres,ProductionYear,RunTimeTicks',
      Limit: 100,
    });

    return (response.Items ?? [])
      .map(mapJellyfinItemToMediaTitle)
      .filter((title): title is MediaTitle => title !== null);
  }

  async getSources(titleId: string): Promise<MediaSource[]> {
    const response = await this.transport.get<JellyfinPlaybackInfoResponse>(`/Items/${encodeURIComponent(titleId)}/PlaybackInfo`, {
      UserId: this.config.userId,
    });

    return this.mapSources(titleId, response.MediaSources ?? []);
  }

  async getSourcesForPlayback(titleId: string, request: JellyfinPlaybackRequest = {}): Promise<MediaSource[]> {
    const response = await this.transport.post<JellyfinPlaybackInfoResponse>(
      `/Items/${encodeURIComponent(titleId)}/PlaybackInfo`,
      {
        UserId: this.config.userId,
        MaxStreamingBitrate: request.maxStreamingBitrate,
        StartTimeTicks: request.startTimeTicks,
        AudioStreamIndex: request.audioStreamIndex,
        SubtitleStreamIndex: request.subtitleStreamIndex,
        MaxAudioChannels: request.maxAudioChannels,
        EnableDirectPlay: true,
        EnableDirectStream: true,
        EnableTranscoding: true,
        AllowVideoStreamCopy: true,
        AllowAudioStreamCopy: true,
      },
    );

    return this.mapSources(titleId, response.MediaSources ?? []);
  }

  private mapSources(titleId: string, sources: JellyfinMediaSource[]): MediaSource[] {
    return sources
      .map((source) => this.toMediaSource(titleId, source))
      .filter((source): source is MediaSource => source !== null)
      .map(assertPlayableSource);
  }

  private toMediaSource(titleId: string, source: JellyfinMediaSource): MediaSource | null {
    if (!source.Id || !this.config.playbackUrlFactory) return null;

    const url = this.config.playbackUrlFactory({
      itemId: titleId,
      mediaSourceId: source.Id,
      transcodingUrl: source.TranscodingUrl,
    });
    if (!url) return null;

    return {
      id: source.Id,
      titleId,
      kind: source.TranscodingUrl ? 'hls' : 'external',
      url,
      label: source.Name,
      playback: {
        directPlay: source.SupportsDirectPlay === true,
        directStream: source.SupportsDirectStream === true,
        transcoding: source.SupportsTranscoding === true,
        durationSeconds: source.RunTimeTicks ? source.RunTimeTicks / 10_000_000 : undefined,
        bitrate: source.Bitrate,
      },
    };
  }
}
