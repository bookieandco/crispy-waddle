import type { AudioArtifact } from "./mastering-executor";
import type { MasteringPlan } from "./mastering";
import type { MasteringExecutionPolicy, MasteringExecutionResult } from "./mastering-executor";
import type { AudioEngineAdapter } from "./audio-engine";

export interface MobileAudioSession {
  caseId: string;
  versionId: string;
  source: AudioArtifact;
  plan: MasteringPlan;
  policy: MasteringExecutionPolicy;
}

export interface MobileAudioAdapter {
  capabilities(): { offlineRender: boolean; realtimePreview: boolean };
  preview(session: MobileAudioSession): Promise<MasteringExecutionResult>;
}

export class PortableMobileAudioAdapter implements MobileAudioAdapter {
  constructor(private readonly engine: AudioEngineAdapter) {}

  capabilities() {
    return { offlineRender: true, realtimePreview: false };
  }

  preview(session: MobileAudioSession): Promise<MasteringExecutionResult> {
    return this.engine.render({
      sourceVersion: {
        id: session.versionId,
        caseId: session.caseId,
        parentVersionId: undefined,
        createdAt: new Date().toISOString(),
        label: "Mobile preview source",
        status: "candidate",
        operation: "master",
        parameters: {},
        inputArtifactId: session.source.id,
        outputArtifactId: session.source.id,
      },
      source: session.source,
      plan: session.plan,
      policy: session.policy,
    });
  }
}
