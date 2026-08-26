export type FfmpegProgress = {
  frame?: number;
  fps?: number;
  outTimeMs?: number;
  speed?: number;
  progress: 'continue' | 'end';
};

export type FfmpegProcess = {
  exitCode: Promise<number>;
  stdout: AsyncIterable<string>;
  stderr: AsyncIterable<string>;
  kill: (signal?: string) => void;
};

export type FfmpegRunnerOptions = {
  spawn: (executable: string, args: string[]) => FfmpegProcess;
};

export type FfmpegRunRequest = {
  executablePath: string;
  args: string[];
  onProgress?: (progress: FfmpegProgress) => void;
};

export type FfmpegRunResult = {
  exitCode: number;
  cancelled: boolean;
};

/** Runs FFmpeg without shell interpolation and consumes its machine-readable -progress stream. */
export async function runFfmpeg(
  options: FfmpegRunnerOptions,
  request: FfmpegRunRequest,
  signal?: AbortSignal,
): Promise<FfmpegRunResult> {
  const process = options.spawn(request.executablePath, request.args);
  let cancelled = false;

  const abort = () => {
    cancelled = true;
    process.kill('SIGTERM');
  };
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });

  try {
    for await (const line of process.stdout) {
      const parsed = parseProgressLine(line);
      if (parsed) request.onProgress?.(parsed);
    }
    const exitCode = await process.exitCode;
    if (exitCode !== 0 && !cancelled) throw new Error(`FFmpeg exited with code ${exitCode}`);
    return { exitCode, cancelled };
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}

export function parseProgressLine(line: string): FfmpegProgress | null {
  const value = line.trim();
  if (!value || !value.includes('=')) return null;
  const [key, raw] = value.split('=', 2);
  if (key === 'progress' && (raw === 'continue' || raw === 'end')) return { progress: raw };
  if (key === 'frame') return { frame: Number(raw), progress: 'continue' };
  if (key === 'fps') return { fps: Number(raw), progress: 'continue' };
  if (key === 'out_time_ms') return { outTimeMs: Number(raw), progress: 'continue' };
  if (key === 'speed') return { speed: Number.parseFloat(raw.replace(/x$/, '')), progress: 'continue' };
  return null;
}
