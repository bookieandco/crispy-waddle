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

    return (response.MediaSources ?? [])
      .map((source) => this.toMediaSource(titleId, source))
      .filter((source): source is MediaSource => source !== null)
      .map(assertPlayableSource);
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

    return (response.MediaSources ?? [])
      .map((source) => this.toMediaSource(titleId, source))
      .filter((source): source is MediaSource => source !== null)
      .map(assertPlayableSource);
  }

  private toMediaSource(titleId: string, source: JellyfinMediaSource): MediaSource | null {
    if (!source.Id) return null;

    const url = this.resolvePlayableUrl(titleId, source);
    if (!url) return null;

    const subtitles = (source.MediaStreams ?? [])
      .filter((stream) => stream.Type?.toLowerCase() === 'subtitle' && stream.Index !== undefined)
      .map((stream) => ({
        label: stream.DisplayTitle ?? stream.Language ?? `Subtitle ${stream.Index}`,
        language: stream.Language ?? 'und',
        url: this.buildSubtitleUrl(titleId, stream.Index as number),
      }));

    return {
      id: source.Id,
      titleId,
      kind: source.TranscodingUrl ? 'hls' : 'external',
      url,
      label: source.Name,
      subtitles,
      playback: {
        directPlay: source.SupportsDirectPlay === true,
        directStream: source.SupportsDirectStream === true,
        transcoding: source.SupportsTranscoding === true,
        durationSeconds: source.RunTimeTicks ? source.RunTimeTicks / 10_000_000 : undefined,
        bitrate: source.Bitrate,
      },
    };
  }

  private resolvePlayableUrl(titleId: string, source: JellyfinMediaSource): string | null {
    if (source.TranscodingUrl?.startsWith('https://')) return source.TranscodingUrl;
    if (!this.config.serverUrl.startsWith('https://')) return null;

    const base = this.config.serverUrl.replace(/\/+$/, '');
    const url = new URL(`${base}/Videos/${encodeURIComponent(titleId)}/stream`);
    url.searchParams.set('static', 'true');
    url.searchParams.set('mediaSourceId', source.Id ?? '');
    return url.toString();
  }

  private buildSubtitleUrl(titleId: string, streamIndex: number): string {
    const base = this.config.serverUrl.replace(/\/+$/, '');
    return `${base}/Videos/${encodeURIComponent(titleId)}/${streamIndex}/Subtitles/stream.vtt`;
  }
}
