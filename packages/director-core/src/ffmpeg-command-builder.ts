import type { FFmpegRenderPlan } from './ffmpeg-render-plan.js';

export type FFmpegCommandOptions = {
  ffmpegPath?: string;
  hardwareAcceleration?: 'auto' | 'none' | 'videotoolbox';
  overwrite?: boolean;
};

export function buildFFmpegCommand(
  plan: FFmpegRenderPlan,
  options: FFmpegCommandOptions = {},
): string[] {
  const args: string[] = [];
  if (options.overwrite !== false) args.push('-y');
  if (options.hardwareAcceleration && options.hardwareAcceleration !== 'none') {
    args.push('-hwaccel', options.hardwareAcceleration);
  }

  for (const input of plan.inputs) {
    args.push('-i', input.path);
  }

  if (plan.filterComplex) args.push('-filter_complex', plan.filterComplex);
  for (const mapping of plan.maps) args.push('-map', mapping);

  args.push('-c:v', plan.videoCodec ?? 'libx264');
  args.push('-c:a', plan.audioCodec ?? 'aac');
  args.push(plan.outputPath);
  return args;
}

export function ffmpegExecutable(options: FFmpegCommandOptions = {}): string {
  return options.ffmpegPath ?? 'ffmpeg';
}
