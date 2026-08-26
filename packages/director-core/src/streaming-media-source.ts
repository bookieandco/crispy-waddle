export type StreamingSourceKind = 'youtube' | 'hls' | 'dash' | 'file';

export type MediaSample = {
  assetId: string;
  timestampSeconds: number;
  frameRef?: string;
  audioRef?: string;
};

export type StreamingMediaSource = {
  kind: StreamingSourceKind;
  url: string;
  samples(): AsyncIterable<MediaSample>;
};

export function isSupportedStudyUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'file:' || parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
