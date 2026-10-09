import type { SupabaseClient } from "@supabase/supabase-js";
import { separateDeepDrumArtifact } from "@jhadina/music-core";
import { SupabaseMusicRestorationArtifactStore } from "./restoration-supabase-store";
import { createMusicRestorationRuntimeClient } from "./restoration-runtime-server";

/** MUSIC-DEEPSTEMS.3 authenticated operator integration; never upgrades final QC automatically. */
export async function runPersistedDeepDrums(input: {
  client: SupabaseClient;
  ownerUserId: string;
  caseId: string;
  parentArtifactId: string;
}) {
  const store = new SupabaseMusicRestorationArtifactStore(input.client, input.ownerUserId);
  const parent = await store.get(input.ownerUserId, input.parentArtifactId);
  if (!parent || parent.caseId !== input.caseId) throw new Error("MUSIC_DEEP_DRUMS_PARENT_NOT_FOUND");
  if (parent.role !== "drums" || parent.kind !== "derived" || !parent.parentArtifactId) {
    throw new Error("MUSIC_DEEP_DRUMS_REQUIRES_SEPARATED_DRUMS");
  }
  const existing = await store.listArtifacts(input.caseId);
  if (existing.some(artifact => artifact.parentArtifactId === parent.id &&
    artifact.role?.startsWith("drums."))) throw new Error("MUSIC_DEEP_DRUMS_ALREADY_EXTRACTED");
  const jobId = "music-deep-drums:" + globalThis.crypto.randomUUID();
  await store.createJob({
    id: jobId, caseId: input.caseId, kind: "separate", sourceArtifactId: parent.id,
    metadata: { kind: "deep-drums", modelId: "drumsep-cpu-v1", humanListeningRequired: true },
  });
  try {
    const result = await separateDeepDrumArtifact({
      ownerUserId: input.ownerUserId, caseId: input.caseId,
      parent, runtime: await createMusicRestorationRuntimeClient(),
      store, jobId,
    });
    await store.completeJob({
      id: jobId, outputArtifactIds: result.artifacts.map(a => a.id),
      runtimeReceiptId: result.receipt.runtimeReceiptId,
      metadata: {
        parentArtifactId: parent.id, modelId: result.receipt.modelId,
        modelVersion: result.receipt.modelVersion,
        qc: result.receipt.qc, needsListeningReview: true, restorationCertified: false,
      },
    });
    return {
      jobId, parentArtifactId: parent.id, artifactIds: result.artifacts.map(a => a.id),
      qc: result.receipt.qc, modelId: result.receipt.modelId,
      runtimeReceiptId: result.receipt.runtimeReceiptId,
      needsListeningReview: true, certified: false,
    };
  } catch (error) {
    await store.failJob(jobId, error instanceof Error ? error.message : "Deep drum separation failed");
    throw error;
  }
}
