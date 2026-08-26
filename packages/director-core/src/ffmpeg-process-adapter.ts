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
  const child = factory(['-hide_banner', '-loglevel', 'error', '-ss', String(request.startSeconds ?? 0), '-i', request.source, '-an', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-r', String(request.frameRate ?? 2), 'pipe:1']);
  const detach = attachCancellation(child, request.signal);
  try {
    let timestamp = request.startSeconds ?? 0;
    for await (const chunk of child.stdout) {
      if (request.signal?.aborted) return;
      yield { assetId: request.assetId, timestampSeconds: timestamp, frameRef: `ffmpeg:${request.assetId}:frame:${timestamp.toFixed(3)}:${Buffer.from(chunk).toString('base64')}` };
      timestamp += 1 / (request.frameRate ?? 2);
    }
    await waitForExit(child, request.signal);
  } finally { detach(); }
  void mode;
}

async function* decodeAudioStream(request: DecodeRequest, factory: FfmpegProcessFactory): AsyncIterable<DecodedAudio> {
  const child = factory(['-hide_banner', '-loglevel', 'error', '-ss', String(request.startSeconds ?? 0), '-i', request.source, '-vn', '-ac', '1', '-ar', String(request.audioSampleRate ?? 16000), '-f', 's16le', 'pipe:1']);
  const detach = attachCancellation(child, request.signal);
  try {
    const windowSeconds = 2;
    let timestamp = request.startSeconds ?? 0;
    const bytesPerWindow = Math.max(1, Math.floor((request.audioSampleRate ?? 16000) * 2 * windowSeconds));
    let buffer = Buffer.alloc(0);
    for await (const chunk of child.stdout) {
      if (request.signal?.aborted) return;
      buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
      while (buffer.length >= bytesPerWindow) {
        if (request.signal?.aborted) return;
        const window = buffer.subarray(0, bytesPerWindow);
        buffer = buffer.subarray(bytesPerWindow);
        yield { assetId: request.assetId, startSeconds: timestamp, endSeconds: timestamp + windowSeconds, audioRef: `ffmpeg:${request.assetId}:audio:${timestamp.toFixed(3)}:${window.toString('base64')}` };
        timestamp += windowSeconds;
      }
    }
    await waitForExit(child, request.signal);
  } finally { detach(); }
}

function attachCancellation(child: ChildProcessWithoutNullStreams, signal?: AbortSignal): () => void {
  if (!signal) return () => {};
  const onAbort = () => { if (!child.killed) child.kill('SIGTERM'); };
  if (signal.aborted) onAbort();
  else signal.addEventListener('abort', onAbort, { once: true });
  return () => signal.removeEventListener('abort', onAbort);
}

function waitForExit(child: ChildProcessWithoutNullStreams, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => { if (!child.killed) child.kill('SIGTERM'); };
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });
    child.once('error', reject);
    child.once('close', code => {
      signal?.removeEventListener('abort', onAbort);
      if (signal?.aborted) resolve();
      else if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}
