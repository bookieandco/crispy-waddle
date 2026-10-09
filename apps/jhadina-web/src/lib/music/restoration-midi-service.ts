import type { SupabaseClient } from "@supabase/supabase-js";
import { transcribeInstrumentToMidi } from "@jhadina/music-core";
import { createMusicRestorationRuntimeClient } from "./restoration-runtime-server";
import { SupabaseMusicRestorationArtifactStore } from "./restoration-supabase-store";

/** RESTORE-UNIFY.5 -- owner-scoped creative MIDI hypothesis, never original recovery. */
export async function runPersistedInstrumentMidi(input: {
  client: SupabaseClient;
  ownerUserId: string;
  caseId: string;
  parentArtifactId: string;
}) {
  const store = new SupabaseMusicRestorationArtifactStore(input.client, input.ownerUserId);
  const parent = await store.get(input.ownerUserId, input.parentArtifactId);
  if (!parent || parent.caseId !== input.caseId) throw new Error("MUSIC_MIDI_PARENT_NOT_FOUND");
  if (!["guitar", "piano", "bass", "other"].includes(parent.role ?? "") ||
      parent.kind !== "derived" || !parent.parentArtifactId) {
    throw new Error("MUSIC_MIDI_REQUIRES_ISOLATED_INSTRUMENT_STEM");
  }
  const existing = await store.listArtifacts(input.caseId);
  if (existing.some(artifact => artifact.parentArtifactId === parent.id &&
      artifact.role === "midi." + parent.role)) {
    throw new Error("MUSIC_MIDI_PARENT_ALREADY_TRANSCRIBED");
  }
  const jobId = "music-midi:" + globalThis.crypto.randomUUID();
  await store.createJob({
    id: jobId, caseId: input.caseId, kind: "perceive",
    sourceArtifactId: parent.id,
    metadata: {
      operationClass: "creative-reconstruction",
      modelId: "spotify-basic-pitch-v1", needsHumanReview: true,
      originalPerformanceRecovered: false,
    },
  });
  try {
    const result = await transcribeInstrumentToMidi({
      ownerUserId: input.ownerUserId, caseId: input.caseId, parent,
      runtime: await createMusicRestorationRuntimeClient(), store, jobId,
    });
    await store.completeJob({
      id: jobId, outputArtifactIds: [result.artifact.id],
      runtimeReceiptId: result.receipt.runtimeReceiptId,
      metadata: {
        operationClass: "creative-reconstruction",
        modelId: result.receipt.modelId,
        modelVersion: result.receipt.modelVersion, noteCount: result.receipt.noteCount,
        needsHumanReview: true, originalPerformanceRecovered: false,
        restorationCertified: false,
      },
    });
    return {
      jobId, parentArtifactId: parent.id, artifactId: result.artifact.id,
      modelId: result.receipt.modelId, noteCount: result.receipt.noteCount,
      runtimeReceiptId: result.receipt.runtimeReceiptId,
      needsHumanReview: true, restorationCertified: false,
    };
  } catch (error) {
    await store.failJob(jobId, error instanceof Error ? error.message : "MIDI transcription failed");
    throw error;
  }
}
