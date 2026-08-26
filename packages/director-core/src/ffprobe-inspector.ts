export type MediaStreamInfo = {
  index: number;
  codecType?: 'video' | 'audio' | 'subtitle' | 'data' | string;
  codecName?: string;
  durationSeconds?: number;
  sampleRate?: number;
  channels?: number;
  width?: number;
  height?: number;
  frameRate?: string;
};

export type MediaProbeResult = {
  path: string;
  format?: string;
  durationSeconds?: number;
  streams: MediaStreamInfo[];
};

export type ProcessRunner = (command: string, args: string[]) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

export async function probeMedia(path: string, ffprobePath: string, run: ProcessRunner): Promise<MediaProbeResult> {
  const result = await run(ffprobePath, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path]);
  if (result.exitCode !== 0) throw new Error(`ffprobe exited with code ${result.exitCode}: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout) as { format?: { format_name?: string; duration?: string }; streams?: Array<Record<string, unknown>> };
  return {
    path,
    format: parsed.format?.format_name,
    durationSeconds: parsed.format?.duration ? Number(parsed.format.duration) : undefined,
    streams: (parsed.streams ?? []).map(stream => ({
      index: Number(stream.index),
      codecType: stream.codec_type as MediaStreamInfo['codecType'],
      codecName: stream.codec_name as string | undefined,
      durationSeconds: stream.duration ? Number(stream.duration) : undefined,
      sampleRate: stream.sample_rate ? Number(stream.sample_rate) : undefined,
      channels: stream.channels ? Number(stream.channels) : undefined,
      width: stream.width as number | undefined,
      height: stream.height as number | undefined,
      frameRate: stream.r_frame_rate as string | undefined,
    })),
  };
}
