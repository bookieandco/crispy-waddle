import type { SupabaseClient } from "@supabase/supabase-js";
import {
  restoreVocalArtifact,
  type VocalRestorationProfile,
} from "@jhadina/music-core";
import { createMusicRestorationRuntimeClient } from "./restoration-runtime-server";
import { SupabaseMusicRestorationArtifactStore } from "./restoration-supabase-store";

export async function runVocalRestoration(input: {
  client: SupabaseClient;
  ownerUserId: string;
  caseId: string;
  sourceArtifactId: string;
  profile: VocalRestorationProfile;
  evidenceIds: string[];
  approved: boolean;
}) {
  const store = new SupabaseMusicRestorationArtifactStore(input.client, input.ownerUserId);
  const source = await store.get(input.ownerUserId, input.sourceArtifactId);
  if (!source || source.caseId !== input.caseId) {
    throw new Error("MUSIC_VOCAL_RESTORATION_SOURCE_NOT_FOUND");
  }
  if (source.role !== "vocals") {
    throw new Error("MUSIC_VOCAL_RESTORATION_VOCAL_STEM_REQUIRED");
  }
  if (!input.approved) {
    throw new Error("MUSIC_VOCAL_RESTORATION_EXPLICIT_APPROVAL_REQUIRED");
  }

  const requestId = `music-vocal-request:${globalThis.crypto.randomUUID()}`;
  const jobId = `music-vocal:${globalThis.crypto.randomUUID()}`;
  const approvalEvidenceId = `music-vocal-approval:${globalThis.crypto.randomUUID()}`;
  const approvedAt = new Date().toISOString();
  const request = {
    requestId,
    sourceArtifactId: source.id,
    profile: input.profile,
    evidenceIds: [...new Set([...input.evidenceIds, approvalEvidenceId])],
    approval: {
      approvedByUserId: input.ownerUserId,
      approvedAt,
      evidenceId: approvalEvidenceId,
    },
  };

  await store.createJob({
    id: jobId,
    caseId: input.caseId,
    kind: "vocal",
    sourceArtifactId: source.id,
    metadata: {
      requestId,
      profile: input.profile,
      requiresAudition: true,
    },
  });

  try {
    const result = await restoreVocalArtifact({
      ownerUserId: input.ownerUserId,
      caseId: input.caseId,
      request,
      source,
      runtime: createMusicRestorationRuntimeClient(),
      store,
      jobId,
    });
    await store.persistVocalRestorationOutcome({
      caseId: input.caseId,
      jobId,
      request,
      result,
    });
    await store.completeJob({
      id: jobId,
      outputArtifactIds: [result.storedArtifact.id],
      runtimeReceiptId: result.runtimeReceipt.runtimeReceiptId,
      metadata: {
        requestId,
        identityPreserved: result.runtimeReceipt.comparison.identityPreserved,
        comparison: result.runtimeReceipt.comparison,
        requiresAudition: true,
        directorReadyVocalStem: true,
      },
    });
    return { jobId, request, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vocal restoration failed";
    await store.failJob(jobId, message);
    throw error;
  }
}
