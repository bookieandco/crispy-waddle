import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { MediaProcessorPort, MediaProcessRequest, MediaProcessResult } from "./media-processor-port";

const execFileAsync = promisify(execFile);

export interface FFmpegMediaProcessorOptions {
  command?: string;
}

/** Host adapter for deterministic media transforms; keeps ffmpeg outside command-core contracts. */
export class FFmpegMediaProcessorAdapter implements MediaProcessorPort {
  constructor(private readonly options: FFmpegMediaProcessorOptions = {}) {}

  async process(request: MediaProcessRequest): Promise<MediaProcessResult> {
    const outputPath = request.outputPath ?? `${request.sourcePath}.jhadina.${request.operation}.wav`;
    const filter = request.operation === "bass_reduce"
      ? "equalizer=f=120:t=q:w=1:g=-6"
      : "highpass=f=120,lowpass=f=12000,acompressor";

    await execFileAsync(this.options.command ?? "ffmpeg", [
      "-y", "-i", request.sourcePath, "-af", filter, outputPath,
    ]);

    return { outputPath, operation: request.operation };
  }
}
