import type { MediaTitle } from './index';

export interface MediaSourcePlaybackCapabilities {
  directPlay: boolean;
  directStream: boolean;
  transcoding: boolean;
  durationSeconds?: number;
  bitrate?: number;
}

export interface MediaSource {
  id: string;
  titleId: string;
  kind: 'hls' | 'dash' | 'external';
  url: string;
  label?: string;
  subtitles?: Array<{ label: string; language: string; url: string }>;
  playback?: MediaSourcePlaybackCapabilities;
}

export interface MediaSourceAdapter {
  readonly id: string;
  readonly name: string;
  search(query: string): Promise<MediaTitle[]>;
  getSources(titleId: string): Promise<MediaSource[]>;
}

export function assertPlayableSource(source: MediaSource): MediaSource {
  if (!source.url.startsWith('https://')) {
    throw new Error('JhadinaTV sources must use HTTPS URLs.');
  }
  return source;
}
