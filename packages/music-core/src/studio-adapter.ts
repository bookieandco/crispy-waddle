import type { MasteringPlan } from "./mastering";
import type { AudioArtifact, MasteringExecutionPolicy } from "./mastering-executor";
import type { RealtimeAudioEngineAdapter, RealtimeAudioProcessor, RealtimeEngineSession } from "./realtime-audio-engine";

export type StudioHost = "vst3" | "audio-unit" | "aax" | "generic";

export interface StudioPluginState {
  host: StudioHost;
  caseId?: string;
  versionId?: string;
  plan?: MasteringPlan;
  policy?: MasteringExecutionPolicy;
}

export interface StudioAdapter {
  attach(host: StudioHost): void;
  loadSession(session: RealtimeEngineSession): void;
  processor(): RealtimeAudioProcessor;
  state(): StudioPluginState;
}

export class StudioAudioAdapter implements StudioAdapter {
  private currentHost: StudioHost = "generic";
  private currentSession?: RealtimeEngineSession;
  private currentProcessor?: RealtimeAudioProcessor;

  constructor(private readonly engine: RealtimeAudioEngineAdapter) {}

  attach(host: StudioHost): void { this.currentHost = host; }

  loadSession(session: RealtimeEngineSession): void {
    this.currentSession = session;
    this.currentProcessor = this.engine.createProcessor(session);
  }

  processor(): RealtimeAudioProcessor {
    if (!this.currentProcessor) throw new Error("Studio session has not been loaded");
    return this.currentProcessor;
  }

  state(): StudioPluginState {
    return {
      host: this.currentHost,
      caseId: this.currentSession?.source.id,
      versionId: this.currentSession?.plan.sourceVersionId,
      plan: this.currentSession?.plan,
      policy: this.currentSession?.policy,
    };
  }
}
