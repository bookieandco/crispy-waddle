import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import type { DecodeRequest, DecodedAudio, DecodedFrame, MediaDecoderAdapter } from './media-decoder-adapter.js';

export type FfmpegChildProcess = ChildProcessByStdio<null, Readable, Readable>;
export type FfmpegProcessFactory = (args: string[]) => FfmpegChildProcess;

export function createNodeFfmpegDecoder(
  factory: FfmpegProcessFactory = args => spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] }),
): MediaDecoderAdapter {
  return {
    decodeFrames(request: DecodeRequest): AsyncIterable<DecodedFrame> {
      return decodeFrameStream(request, factory);
    },
    decodeAudio(request: DecodeRequest): AsyncIterable<DecodedAudio> {
      return decodeAudioStream(request, factory);
    },
  };
}

function rangeArgs(request: DecodeRequest): string[] {
  const start = Math.max(0, request.startSeconds ?? 0);
  const args = ['-ss', String(start), '-i', request.source];
  if (request.endSeconds !== undefined) {
    if (!Number.isFinite(request.endSeconds) || request.endSeconds <= start) {
      throw new Error('FFMPEG_DECODE_RANGE_INVALID');
    }
    args.push('-t', String(request.endSeconds - start));
  }
  return args;
}

async function* decodeFrameStream(
  request: DecodeRequest,
  factory: FfmpegProcessFactory,
): AsyncIterable<DecodedFrame> {
  const frameRate = request.frameRate ?? 2;
  if (!Number.isFinite(frameRate) || frameRate <= 0) throw new Error('FFMPEG_FRAME_RATE_INVALID');

  const child = factory([
    '-hide_banner',
    '-loglevel', 'error',
    ...rangeArgs(request),
    '-an',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-r', String(frameRate),
    'pipe:1',
  ]);
  const detach = attachCancellation(child, request.signal);
  const exit = waitForExit(child, request.signal);

  try {
    let timestamp = request.startSeconds ?? 0;
    let buffer = Buffer.alloc(0);

    for await (const chunk of child.stdout) {
      if (request.signal?.aborted) return;
      buffer = Buffer.concat([buffer, Buffer.from(chunk)]);

      while (buffer.length >= 4) {
        const start = buffer.indexOf(Buffer.from([0xff, 0xd8]));
        if (start < 0) {
          buffer = buffer.subarray(Math.max(0, buffer.length - 1));
          break;
        }
        if (start > 0) buffer = buffer.subarray(start);

        const end = buffer.indexOf(Buffer.from([0xff, 0xd9]), 2);
        if (end < 0) break;

        const frame = buffer.subarray(0, end + 2);
        buffer = buffer.subarray(end + 2);

        yield {
          assetId: request.assetId,
          timestampSeconds: timestamp,
          frameRef: `ffmpeg:${request.assetId}:frame:${timestamp.toFixed(3)}:${frame.toString('base64')}`,
        };
        timestamp += 1 / frameRate;
      }
    }
    await exit;
  } finally {
    detach();
  }
}

async function* decodeAudioStream(
  request: DecodeRequest,
  factory: FfmpegProcessFactory,
): AsyncIterable<DecodedAudio> {
  const sampleRate = request.audioSampleRate ?? 16000;
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error('FFMPEG_AUDIO_SAMPLE_RATE_INVALID');

  const child = factory([
    '-hide_banner',
    '-loglevel', 'error',
    ...rangeArgs(request),
    '-vn',
    '-ac', '1',
    '-ar', String(sampleRate),
    '-f', 's16le',
    'pipe:1',
  ]);
  const detach = attachCancellation(child, request.signal);
  const exit = waitForExit(child, request.signal);

  try {
    const windowSeconds = 2;
    const bytesPerSecond = sampleRate * 2;
    const bytesPerWindow = Math.max(1, Math.floor(bytesPerSecond * windowSeconds));
    let timestamp = request.startSeconds ?? 0;
    let buffer = Buffer.alloc(0);

    for await (const chunk of child.stdout) {
      if (request.signal?.aborted) return;
      buffer = Buffer.concat([buffer, Buffer.from(chunk)]);

      while (buffer.length >= bytesPerWindow) {
        if (request.signal?.aborted) return;
        const window = buffer.subarray(0, bytesPerWindow);
        buffer = buffer.subarray(bytesPerWindow);
        yield {
          assetId: request.assetId,
          startSeconds: timestamp,
          endSeconds: timestamp + windowSeconds,
          audioRef: `ffmpeg:${request.assetId}:audio:${timestamp.toFixed(3)}:${window.toString('base64')}`,
        };
        timestamp += windowSeconds;
      }
    }

    if (buffer.length > 0 && !request.signal?.aborted) {
      const durationSeconds = buffer.length / bytesPerSecond;
      yield {
        assetId: request.assetId,
        startSeconds: timestamp,
        endSeconds: timestamp + durationSeconds,
        audioRef: `ffmpeg:${request.assetId}:audio:${timestamp.toFixed(3)}:${buffer.toString('base64')}`,
      };
    }

    await exit;
  } finally {
    detach();
  }
}

function attachCancellation(child: FfmpegChildProcess, signal?: AbortSignal): () => void {
  if (!signal) return () => {};
  const onAbort = () => { if (!child.killed) child.kill('SIGTERM'); };
  if (signal.aborted) onAbort();
  else signal.addEventListener('abort', onAbort, { once: true });
  return () => signal.removeEventListener('abort', onAbort);
}

function waitForExit(child: FfmpegChildProcess, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => { if (!child.killed) child.kill('SIGTERM'); };
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });

    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    child.once('error', error => {
      cleanup();
      reject(error);
    });
    child.once('close', code => {
      cleanup();
      if (signal?.aborted) resolve();
      else if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}
