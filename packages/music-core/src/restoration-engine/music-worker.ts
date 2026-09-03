import type { AudioCommand, AudioExecutionResult, AudioSandboxJob } from "./audio-execution-sandbox.js";

export const MUSIC_WORKER_PROTOCOL_VERSION = "1.0";

export interface MusicWorkerManifest {
  protocolVersion: string;
  jobId: string;
  sourceArtifactId: string;
  sourceArtifactHash: string;
  inputPath: string;
  outputPath: string;
  sampleRate: number;
  channels: number;
  pluginId?: string;
  pluginBinaryHash?: string;
  automationPlanId?: string;
}

export interface MusicWorkerRequest {
  manifest: MusicWorkerManifest;
  command: AudioCommand;
}

export interface MusicWorkerResult extends AudioExecutionResult {
  protocolVersion: string;
  jobId: string;
  sourceArtifactId: string;
}

export function createMusicWorkerManifest(job: AudioSandboxJob): MusicWorkerManifest {
  return {
    protocolVersion: MUSIC_WORKER_PROTOCOL_VERSION,
    jobId: job.id,
    sourceArtifactId: job.sourceArtifactId,
    sourceArtifactHash: job.sourceArtifactHash,
    inputPath: job.inputPath,
    outputPath: job.outputPath,
    sampleRate: job.sampleRate,
    channels: job.channels,
    pluginId: job.pluginId,
    pluginBinaryHash: job.pluginBinaryHash,
    automationPlanId: job.automationPlanId,
  };
}

export function validateMusicWorkerResult(
  job: AudioSandboxJob,
  result: MusicWorkerResult,
): void {
  if (result.protocolVersion !== MUSIC_WORKER_PROTOCOL_VERSION) {
    throw new Error("Unsupported music worker protocol version.");
  }
  if (result.jobId !== job.id) throw new Error("Music worker result job does not match the authorized job.");
  if (result.sourceArtifactId !== job.sourceArtifactId) {
    throw new Error("Music worker result source artifact does not match the authorized job.");
  }
  if (result.outputPath !== job.outputPath) {
    throw new Error("Music worker result output path does not match the authorized job.");
  }
  if (result.exitCode !== 0) throw new Error(`Music worker exited with code ${result.exitCode}.`);
}
