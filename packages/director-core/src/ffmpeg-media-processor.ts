import type { MediaProcessRequest, MediaProcessResult, MediaProcessor } from './media-processor';

export type FfmpegRunner = (args: string[]) => Promise<{ exitCode: number; stderr?: string }>;

/** Provider boundary for a local Mac/CPU FFmpeg installation. */
export class FfmpegMediaProcessor implements MediaProcessor {
  readonly id = 'ffmpeg-local';

  constructor(private readonly run: FfmpegRunner) {}

  async process(request: MediaProcessRequest): Promise<MediaProcessResult> {
    const result = await this.run(['-y', '-i', request.inputUri, ...request.args, request.outputUri]);
    if (result.exitCode !== 0) {
      return { requestId: request.requestId, status: 'failed', error: result.stderr ?? `FFmpeg exited with code ${result.exitCode}` };
    }
    return { requestId: request.requestId, status: 'completed', outputUri: request.outputUri };
  }
}
