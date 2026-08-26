export type DecodeRequest = {
  source: string;
  assetId: string;
  startSeconds?: number;
  endSeconds?: number;
  frameRate?: number;
  audioSampleRate?: number;
  signal?: AbortSignal;
};

export type DecodedFrame = {
  assetId: string;
  timestampSeconds: number;
  frameRef: string;
};

export type DecodedAudio = {
  assetId: string;
  startSeconds: number;
  endSeconds: number;
  audioRef: string;
};

export type MediaDecoderAdapter = {
  decodeFrames(request: DecodeRequest): AsyncIterable<DecodedFrame>;
  decodeAudio(request: DecodeRequest): AsyncIterable<DecodedAudio>;
};

export type FfmpegCommandFactory = (request: DecodeRequest, stream: 'video' | 'audio') => string[];

export function createFfmpegDecoderAdapter(factory: FfmpegCommandFactory): MediaDecoderAdapter {
  return {
    async *decodeFrames(request) {
      void factory(request, 'video');
    },
    async *decodeAudio(request) {
      void factory(request, 'audio');
    },
  };
}
