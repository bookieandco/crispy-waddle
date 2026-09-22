import { spawn, type ChildProcess } from 'node:child_process';
import type { DecodeRequest, DecodedAudio, DecodedFrame, MediaDecoderAdapter } from './media-decoder-adapter.js';

export type FfmpegProcessFactory = (args: string[]) => ChildProcess;

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

async function* decodeFrameStream(
  request: DecodeRequest,
  factory: FfmpegProcessFactory,
): AsyncIterable<DecodedFrame> {
  const frameRate = request.frameRate ?? 2;
  const child = factory([
    '-hide_banner',
    '-loglevel', 'error',
    '-ss', String(request.startSeconds ?? 0),
    ...(durationArgs(request)),
    '-i', request.source,
    '-an',
    '-vf', `fps=${frameRate}`,
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    'pipe:1',
  ]);
  const exit = createExitPromise(child, request.signal);
  const detach = attachCancellation(child, request.signal);

  try {
    let timestamp = request.startSeconds ?? 0;
    let buffer = Buffer.alloc(0);

    for await (const chunk of child.stdout ?? []) {
      if (request.signal?.aborted) return;
      buffer = Buffer.concat([buffer, Buffer.from(chunk)]);

      while (true) {
        const start = findJpegStart(buffer);
        if (start < 0) {
          if (buffer.length > 1) buffer = buffer.subarray(buffer.length - 1);
          break;
        }
        const end = findJpegEnd(buffer, start + 2);
        if (end < 0) {
          if (start > 0) buffer = buffer.subarray(start);
          break;
        }

        const frame = buffer.subarray(start, end + 2);
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
  const child = factory([
    '-hide_banner',
    '-loglevel', 'error',
    '-ss', String(request.startSeconds ?? 0),
    ...(durationArgs(request)),
    '-i', request.source,
    '-vn',
    '-ac', '1',
    '-ar', String(sampleRate),
    '-f', 's16le',
    'pipe:1',
  ]);
  const exit = createExitPromise(child, request.signal);
  const detach = attachCancellation(child, request.signal);

  try {
    const windowSeconds = 2;
    let timestamp = request.startSeconds ?? 0;
    const bytesPerWindow = Math.max(1, Math.floor(sampleRate * 2 * windowSeconds));
    let buffer = Buffer.alloc(0);

    for await (const chunk of child.stdout ?? []) {
      if (request.signal?.aborted) return;
      buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
      while (buffer.length >= bytesPerWindow) {
        if (request.signal?.aborted) return;
        const window = buffer.subarray(0, bytesPerWindow);
        buffer = buffer.subarray(bytesPerWindow);
        const requestedEnd = request.endSeconds ?? Number.POSITIVE_INFINITY;
        const endSeconds = Math.min(timestamp + windowSeconds, requestedEnd);
        yield {
          assetId: request.assetId,
          startSeconds: timestamp,
          endSeconds,
          audioRef: `ffmpeg:${request.assetId}:audio:${timestamp.toFixed(3)}:${window.toString('base64')}`,
        };
        timestamp += windowSeconds;
      }
    }

    if (buffer.length > 0 && !request.signal?.aborted) {
      const seconds = buffer.length / (sampleRate * 2);
      yield {
        assetId: request.assetId,
        startSeconds: timestamp,
        endSeconds: Math.min(timestamp + seconds, request.endSeconds ?? Number.POSITIVE_INFINITY),
        audioRef: `ffmpeg:${request.assetId}:audio:${timestamp.toFixed(3)}:${buffer.toString('base64')}`,
      };
    }

    await exit;
  } finally {
    detach();
  }
}

function durationArgs(request: DecodeRequest): string[] {
  if (request.endSeconds === undefined) return [];
  const start = request.startSeconds ?? 0;
  const duration = request.endSeconds - start;
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('DIRECTOR_FFMPEG_RANGE_INVALID');
  return ['-t', String(duration)];
}

function findJpegStart(buffer: Buffer): number {
  for (let i = 0; i < buffer.length - 1; i += 1) {
    if (buffer[i] === 0xff && buffer[i + 1] === 0xd8) return i;
  }
  return -1;
}

function findJpegEnd(buffer: Buffer, from: number): number {
  for (let i = from; i < buffer.length - 1; i += 1) {
    if (buffer[i] === 0xff && buffer[i + 1] === 0xd9) return i;
  }
  return -1;
}

function attachCancellation(child: ChildProcess, signal?: AbortSignal): () => void {
  if (!signal) return () => {};
  const onAbort = () => {
    if (!child.killed) child.kill('SIGTERM');
  };
  if (signal.aborted) onAbort();
  else signal.addEventListener('abort', onAbort, { once: true });
  return () => signal.removeEventListener('abort', onAbort);
}

/**
 * Attach process completion listeners immediately after spawn so a fast exit or
 * cancellation cannot occur before the close listener exists.
 */
function createExitPromise(child: ChildProcess, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => {
      if (signal?.aborted) resolve();
      else if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}
