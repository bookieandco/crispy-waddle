import type { DecodeRequest, DecodedAudio, DecodedFrame, MediaDecoderAdapter } from './media-decoder-adapter.js';

export function withCancellation(decoder: MediaDecoderAdapter, signal: AbortSignal): MediaDecoderAdapter {
  return {
    decodeFrames(request: DecodeRequest): AsyncIterable<DecodedFrame> {
      return guard(decoder.decodeFrames(request), signal);
    },
    decodeAudio(request: DecodeRequest): AsyncIterable<DecodedAudio> {
      return guard(decoder.decodeAudio(request), signal);
    },
  };
}

async function* guard<T>(source: AsyncIterable<T>, signal: AbortSignal): AsyncIterable<T> {
  if (signal.aborted) return;
  for await (const value of source) {
    if (signal.aborted) return;
    yield value;
  }
}
