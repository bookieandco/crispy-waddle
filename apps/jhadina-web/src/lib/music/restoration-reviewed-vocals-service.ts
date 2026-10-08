import type { SupabaseClient } from "@supabase/supabase-js";
import {
  renderAndPersistReviewedVocalRegions,
  type ReviewedVocalRegionRole,
} from "@jhadina/music-core";
import { createMusicRestorationRuntimeClient } from "./restoration-runtime-server";
import { SupabaseMusicRestorationArtifactStore } from "./restoration-supabase-store";

const VOCAL_ROLES = new Set([
  "lead", "backing", "double", "harmony", "ad-lib", "spoken", "shout",
  "response", "effect", "breath",
]);

/** Routes a same-owner-reviewed vocal TIME RANGE, never claims source
 * disentanglement, speaker identity, or automated ad-lib separation. */
export async function runReviewedVocalRegionRender(input: {
  client: SupabaseClient;
  ownerUserId: string;
  caseId: string;
  parentArtifactId: string;
  regions: Array<{ role: ReviewedVocalRegionRole; startMs: number; endMs: number }>;
}) {
  const store = new SupabaseMusicRestorationArtifactStore(input.client, input.ownerUserId);
  const parent = await store.get(input.ownerUserId, input.parentArtifactId);
  if (!parent || parent.caseId !== input.caseId || parent.kind !== "derived" ||
      parent.role !== "vocals" || !parent.parentArtifactId) {
    throw new Error("MUSIC_VOCAL_REGIONS_OWNED_VOCALS_STEM_REQUIRED");
  }
  if (input.regions.length < 1 || input.regions.length > 64 ||
      input.regions.some(r=>!VOCAL_ROLES.has(r.role) ||
        !Number.isFinite(r.startMs) || !Number.isFinite(r.endMs) ||
        r.startMs < 0 || r.endMs-r.startMs < 50 ||
        r.endMs > 300000 || r.endMs > parent.sampleCount/parent.sampleRate*1000+1)) {
    throw new Error("MUSIC_VOCAL_REGIONS_BOUNDARIES_INVALID");
  }
  const uniqueRoles = new Set(input.regions.map(r => r.role));
  if (uniqueRoles.size > 6) throw new Error("MUSIC_VOCAL_REGIONS_TOO_MANY_LAYERS");
  const sorted = [...input.regions].sort((a,b)=>a.startMs-b.startMs);
  for (let i=1;i<sorted.length;i++) {
    if (sorted[i]!.startMs < sorted[i-1]!.endMs) {
      throw new Error("MUSIC_VOCAL_REGIONS_AMBIGUOUS_OVERLAP");
    }
  }
  const regionEvidence = input.regions.map(region => ({
    ...region, ownerReviewed: true as const,
    reviewEvidenceId: "music-vocal-region-review:" + crypto.randomUUID(),
  }));
  const jobId = "music-vocal-regions:" + crypto.randomUUID();
  await store.createJob({
    id: jobId, caseId: input.caseId, kind: "separate",
    sourceArtifactId: parent.id,
    metadata: {
      operationClass: "human-reviewed-time-region-masks",
      regions: regionEvidence, modelId: "reviewed-vocal-mask-v1",
      automatedSpeakerSeparationPerformed: false,
      needsListeningReview: true, restorationCertified: false,
    },
  });
  try {
    const result = await renderAndPersistReviewedVocalRegions({
      ownerUserId: input.ownerUserId,
      caseId: input.caseId, parent, regions: regionEvidence,
      runtime: await createMusicRestorationRuntimeClient(), store, jobId,
    });
    await store.completeJob({
      id: jobId, outputArtifactIds: result.artifacts.map(x => x.id),
      runtimeReceiptId: result.receipt.runtimeReceiptId,
      metadata: {
        modelId: "reviewed-vocal-mask-v1", regionEvidence,
        qc: result.receipt.qc,
        automatedSpeakerSeparationPerformed: false,
        restorationCertified: false,
        humanListeningRequired: true,
      },
    });
    return {
      jobId, artifactIds: result.artifacts.map(x=>x.id),
      qc: result.receipt.qc, sourceArtifactId: parent.id,
      automatedSpeakerSeparationPerformed: false,
      restorationCertified: false, needsListeningReview: true,
    };
  } catch (error) {
    await store.failJob(jobId, error instanceof Error ? error.message : "Vocal time-region render failed");
    throw error;
  }
}
