export type DecodeRequest = {
  source: string;
  assetId: string;
  startSeconds?: number;
  endSeconds?: number;
  frameRate?: number;
  audioSampleRate?: number;
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
  // Process execution is deliberately injected. This keeps Director Core portable
  // across local workers, containers, and server runtimes while FFmpeg remains the
  // media-decoding implementation underneath.
  return {
    async *decodeFrames(request) {
      void factory(request, 'video');
      // A runtime worker supplies decoded frame references from the FFmpeg process.
      // This adapter defines the contract without pretending to execute FFmpeg here.
    },
    async *decodeAudio(request) {
      void factory(request, 'audio');
      // A runtime worker supplies decoded audio references from the FFmpeg process.
    },
  };
}
