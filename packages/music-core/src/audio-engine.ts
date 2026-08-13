import type { AudioArtifact } from "./mastering-executor";
import type { MasteringPlan } from "./mastering";
import { executeMasteringPlan, type ArtifactWriter, type MasteringExecutionPolicy, type MasteringExecutionResult } from "./mastering-executor";
import type { RestorationVersion } from "./restoration";

export interface AudioEngineCapabilities {
  realtime: boolean;
  offlineRender: boolean;
  channels: number;
  sampleRatesHz: number[];
  operations: string[];
}

export interface AudioEngineRenderRequest {
  sourceVersion: RestorationVersion;
  source: AudioArtifact;
  plan: MasteringPlan;
  policy: MasteringExecutionPolicy;
}

export interface AudioEngineAdapter {
  capabilities(): AudioEngineCapabilities;
  render(request: AudioEngineRenderRequest): Promise<MasteringExecutionResult>;
}

/** Shared engine contract for studio plugins, desktop, and mobile hosts. */
export class PortableAudioEngine implements AudioEngineAdapter {
  constructor(private readonly writer?: ArtifactWriter) {}

  capabilities(): AudioEngineCapabilities {
    return {
      realtime: false,
      offlineRender: true,
      channels: 2,
      sampleRatesHz: [44100, 48000, 88200, 96000],
      operations: ["eq", "limiter", "gain"],
    };
  }

  async render(request: AudioEngineRenderRequest): Promise<MasteringExecutionResult> {
    return executeMasteringPlan(request, this.writer);
  }
}
