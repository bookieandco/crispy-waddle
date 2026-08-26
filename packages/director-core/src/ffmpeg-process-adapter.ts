import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { DecodeRequest, DecodedAudio, DecodedFrame, MediaDecoderAdapter } from './media-decoder-adapter.js';

export type FfmpegProcessFactory = (args: string[]) => ChildProcessWithoutNullStreams;

export function createNodeFfmpegDecoder(factory: FfmpegProcessFactory = args => spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] })): MediaDecoderAdapter {
  return {
    decodeFrames(request: DecodeRequest): AsyncIterable<DecodedFrame> {
      return decodeStream(request, factory, 'video');
    },
    decodeAudio(request: DecodeRequest): AsyncIterable<DecodedAudio> {
      return decodeAudioStream(request, factory);
    },
  };
}

async function* decodeStream(request: DecodeRequest, factory: FfmpegProcessFactory, mode: 'video'): AsyncIterable<DecodedFrame> {
  const args = ['-hide_banner', '-loglevel', 'error', '-ss', String(request.startSeconds ?? 0), '-i', request.source, '-an', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-r', String(request.frameRate ?? 2), 'pipe:1'];
  const child = factory(args);
  let timestamp = request.startSeconds ?? 0;
  for await (const chunk of child.stdout) {
    yield { assetId: request.assetId, timestampSeconds: timestamp, frameRef: `ffmpeg:${request.assetId}:frame:${timestamp.toFixed(3)}:${Buffer.from(chunk).toString('base64')}` };
    timestamp += 1 / (request.frameRate ?? 2);
  }
  await waitForExit(child);
  void mode;
}

async function* decodeAudioStream(request: DecodeRequest, factory: FfmpegProcessFactory): AsyncIterable<DecodedAudio> {
  const args = ['-hide_banner', '-loglevel', 'error', '-ss', String(request.startSeconds ?? 0), '-i', request.source, '-vn', '-ac', '1', '-ar', String(request.audioSampleRate ?? 16000), '-f', 's16le', 'pipe:1'];
  const child = factory(args);
  const windowSeconds = 2;
  let timestamp = request.startSeconds ?? 0;
  const bytesPerWindow = Math.max(1, Math.floor((request.audioSampleRate ?? 16000) * 2 * windowSeconds));
  let buffer = Buffer.alloc(0);
  for await (const chunk of child.stdout) {
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
    while (buffer.length >= bytesPerWindow) {
      const window = buffer.subarray(0, bytesPerWindow);
      buffer = buffer.subarray(bytesPerWindow);
      yield { assetId: request.assetId, startSeconds: timestamp, endSeconds: timestamp + windowSeconds, audioRef: `ffmpeg:${request.assetId}:audio:${timestamp.toFixed(3)}:${window.toString('base64')}` };
      timestamp += windowSeconds;
    }
  }
  await waitForExit(child);
}

function waitForExit(child: ChildProcessWithoutNullStreams): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`)));
  });
}
