import type { AudioCommand, AudioExecutionResult, AudioSandboxJob } from "./audio-execution-sandbox.js";
import { createMusicWorkerManifest, validateMusicWorkerResult, type MusicWorkerRequest, type MusicWorkerResult } from "./music-worker.js";

export interface AudioWorkerRuntime {
  run(request: MusicWorkerRequest): Promise<MusicWorkerResult>;
}

/** Builds the only command the sandboxed worker is expected to receive. */
export function createMusicWorkerRequest(job: AudioSandboxJob, command: AudioCommand): MusicWorkerRequest {
  return { manifest: createMusicWorkerManifest(job), command: { argv: [...command.argv], workingDirectory: command.workingDirectory } };
}

/**
 * Validates the worker protocol at the execution boundary. This function does
 * not grant authorization and does not mutate provenance.
 */
export async function runMusicWorker(
  job: AudioSandboxJob,
  command: AudioCommand,
  runtime: AudioWorkerRuntime,
): Promise<AudioExecutionResult> {
  const result = await runtime.run(createMusicWorkerRequest(job, command));
  validateMusicWorkerResult(job, result);
  return {
    exitCode: result.exitCode,
    outputPath: result.outputPath,
    outputHash: result.outputHash,
  };
}
