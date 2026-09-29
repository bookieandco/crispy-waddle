import type { SupabaseClient } from "@supabase/supabase-js";
import {
  perceiveRestorationArtifact,
  type StoredRestorationArtifact,
} from "@jhadina/music-core";
import { SupabaseMusicRestorationArtifactStore } from "./restoration-supabase-store";
import { createMusicRestorationRuntimeClient } from "./restoration-runtime-server";

export interface PersistedPerceptionSummary {
  artifactId: string;
  role?: string;
  runtimeReceiptId: string;
  tempoBpm?: number;
  beatCount: number;
  downbeatCount: number;
  sectionCount: number;
  transientCount: number;
  vocal?: unknown;
}

function admittedRole(role?: string): "vocals" | "drums" | "bass" | "other" | undefined {
  return role === "vocals" || role === "drums" || role === "bass" || role === "other"
    ? role
    : undefined;
}

export async function runPersistedPerception(input: {
  client: SupabaseClient;
  ownerUserId: string;
  caseId: string;
  artifact: StoredRestorationArtifact;
}): Promise<PersistedPerceptionSummary> {
  const store = new SupabaseMusicRestorationArtifactStore(input.client, input.ownerUserId);
  const jobId = `music-perceive:${globalThis.crypto.randomUUID()}`;
  await store.createJob({
    id: jobId,
    caseId: input.caseId,
    kind: "perceive",
    sourceArtifactId: input.artifact.id,
    metadata: { role: input.artifact.role ?? null },
  });

  try {
    const observed = await perceiveRestorationArtifact({
      ownerUserId: input.ownerUserId,
      artifact: input.artifact,
      runtime: createMusicRestorationRuntimeClient(),
      store,
      role: admittedRole(input.artifact.role),
    });
    await store.persistEvidence({
      caseId: input.caseId,
      artifactId: input.artifact.id,
      observations: observed.evidence,
      runtimeReceiptId: observed.receipt.runtimeReceiptId,
    });
    const summary: PersistedPerceptionSummary = {
      artifactId: input.artifact.id,
      role: input.artifact.role,
      runtimeReceiptId: observed.receipt.runtimeReceiptId,
      tempoBpm: observed.structure.tempoBpm,
      beatCount: observed.structure.beats.length,
      downbeatCount: observed.structure.downbeats.length,
      sectionCount: observed.structure.sections.length,
      transientCount: observed.receipt.transients.length,
      vocal: observed.receipt.vocal,
    };
    await store.completeJob({
      id: jobId,
      runtimeReceiptId: observed.receipt.runtimeReceiptId,
      metadata: {
        tempoBpm: summary.tempoBpm ?? null,
        beats: summary.beatCount,
        downbeats: summary.downbeatCount,
        sections: summary.sectionCount,
        transients: summary.transientCount,
      },
    });
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Music perception failed";
    await store.failJob(jobId, message);
    throw error;
  }
}
