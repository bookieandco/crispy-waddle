import type { AudioCommand, AudioSandboxJob } from "./audio-execution-sandbox.js";

export type DspOperation = "copy" | "filter";

export interface DspWorkerJob {
  operation: DspOperation;
  inputPath: string;
  outputPath: string;
  sampleRate: number;
  channels: number;
  filterGraph?: string;
}

const pathIsSandboxAbsolute = (path: string): boolean => path.startsWith("/") && !path.includes("..") && !path.includes("\0");

/**
 * Converts an approved DSP job into an argv-only command. No shell is used and
 * paths are passed as arguments, preventing shell interpretation of filenames.
 */
export function createFfmpegDspCommand(job: AudioSandboxJob, dsp: DspWorkerJob): AudioCommand {
  if (dsp.inputPath !== job.inputPath) throw new Error("DSP input path does not match the authorized job.");
  if (dsp.outputPath !== job.outputPath) throw new Error("DSP output path does not match the authorized job.");
  if (!pathIsSandboxAbsolute(dsp.inputPath) || !pathIsSandboxAbsolute(dsp.outputPath)) {
    throw new Error("DSP paths must be absolute sandbox paths without traversal.");
  }
  if (!Number.isInteger(dsp.sampleRate) || dsp.sampleRate <= 0) throw new Error("DSP sample rate must be positive.");
  if (!Number.isInteger(dsp.channels) || dsp.channels <= 0) throw new Error("DSP channel count must be positive.");

  if (dsp.operation === "copy") {
    return { argv: ["ffmpeg", "-nostdin", "-v", "error", "-i", dsp.inputPath, "-map", "0:a:0", "-c:a", "pcm_s24le", "-ar", String(dsp.sampleRate), "-ac", String(dsp.channels), dsp.outputPath] };
  }

  if (!dsp.filterGraph) throw new Error("DSP filter operation requires a filter graph.");
  if (/[\r\n]/.test(dsp.filterGraph)) throw new Error("DSP filter graph cannot contain newlines.");

  return {
    argv: ["ffmpeg", "-nostdin", "-v", "error", "-i", dsp.inputPath, "-map", "0:a:0", "-af", dsp.filterGraph, "-c:a", "pcm_s24le", "-ar", String(dsp.sampleRate), "-ac", String(dsp.channels), dsp.outputPath],
  };
}
