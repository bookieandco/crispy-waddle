import type { AudioArtifact } from "./mastering-executor";
import type { MasteringPlan } from "./mastering";
import type { MasteringExecutionPolicy } from "./mastering-executor";

export interface RealtimeAudioBuffer {
  channels: Float32Array[];
  sampleRateHz: number;
  frames: number;
}

export interface RealtimeAudioProcessor {
  prepare(sampleRateHz: number, maxFrames: number, channels: number): void;
  process(input: RealtimeAudioBuffer, output: RealtimeAudioBuffer): void;
  reset(): void;
}

export interface RealtimeEngineSession {
  source: AudioArtifact;
  plan: MasteringPlan;
  policy: MasteringExecutionPolicy;
}

/**
 * Host-neutral real-time contract. Implementations must avoid allocation,
 * network access, filesystem I/O, and blocking calls inside process().
 */
export interface RealtimeAudioEngineAdapter {
  capabilities(): { realtime: true; maxChannels: number; sampleRatesHz: number[] };
  createProcessor(session: RealtimeEngineSession): RealtimeAudioProcessor;
}

export function createRealtimeBuffer(channels: number, frames: number, sampleRateHz: number): RealtimeAudioBuffer {
  return {
    channels: Array.from({ length: channels }, () => new Float32Array(frames)),
    sampleRateHz,
    frames,
  };
}
