import type { MediaRenderer, RenderRequest, RenderResult } from './media-renderer.js';
import { buildFfmpegCommand } from './ffmpeg-command-builder.js';
import { runFfmpeg, type FfmpegRunnerOptions } from './ffmpeg-runner.js';

export type FfmpegRendererOptions = FfmpegRunnerOptions & {
  validateOutput?: (outputPath: string) => Promise<{ durationSeconds?: number; metadata?: Record<string, unknown> }>;
};

/** Provider implementation that turns a precompiled FFmpeg plan into a local render. */
export class FfmpegRenderer implements MediaRenderer {
  readonly id = 'ffmpeg-local';

  constructor(private readonly options: FfmpegRendererOptions) {}

  async render(request: RenderRequest): Promise<RenderResult> {
    const command = buildFfmpegCommand(request.timeline, request.outputPath, {
      videoCodec: request.videoCodec,
      audioCodec: request.audioCodec,
      container: request.container,
    });

    const result = await runFfmpeg({
      executablePath: this.options.executablePath,
      args: command.args,
      signal: this.options.signal,
      onProgress: this.options.onProgress,
    });

    if (result.exitCode !== 0) {
      throw new Error(`FFmpeg render failed with code ${result.exitCode}: ${result.stderr}`);
    }

    const validation = this.options.validateOutput
      ? await this.options.validateOutput(request.outputPath)
      : {};

    return {
      rendererId: this.id,
      outputPath: request.outputPath,
      durationSeconds: validation.durationSeconds,
      metadata: {
        ...validation.metadata,
        ffmpegExitCode: result.exitCode,
      },
    };
  }
}
