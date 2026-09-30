import type { SupabaseClient } from "@supabase/supabase-js";
import {
  restoreVocalRegions,
  type VocalRepairSegment,
} from "@jhadina/music-core";
import { createMusicRestorationRuntimeClient } from "./restoration-runtime-server";
import { SupabaseMusicRestorationArtifactStore } from "./restoration-supabase-store";

export interface VocalRestorationServiceInput {
  client: SupabaseClient;
  ownerUserId: string;
  caseId: string;
  sourceArtifactId: string;
  segments: VocalRepairSegment[];
  evidenceIds: string[];
  approved: boolean;
}

function isVocalRole(role?: string): boolean {
  return role === "vocals" || role === "vocal-restoration" || Boolean(role?.startsWith("vocal-"));
}

export async function runVocalRestoration(input: VocalRestorationServiceInput) {
  const store = new SupabaseMusicRestorationArtifactStore(input.client, input.ownerUserId);
  const source = await store.get(input.ownerUserId, input.sourceArtifactId);
  if (!source || source.caseId !== input.caseId) {
    throw new Error("MUSIC_VOCAL_RESTORATION_SOURCE_NOT_FOUND");
  }
  if (!isVocalRole(source.role)) {
    throw new Error("MUSIC_VOCAL_RESTORATION_VOCAL_STEM_REQUIRED");
  }
  if (!input.approved) {
    throw new Error("MUSIC_VOCAL_RESTORATION_EXPLICIT_APPROVAL_REQUIRED");
  }

  const requestId = `music-vocal-restoration-request:${globalThis.crypto.randomUUID()}`;
  const jobId = `music-vocal-restore:${globalThis.crypto.randomUUID()}`;
  const approvalEvidenceId = `music-vocal-restoration-approval:${globalThis.crypto.randomUUID()}`;
  const approvedAt = new Date().toISOString();
  const request = {
    requestId,
    sourceArtifactId: source.id,
    segments: input.segments,
    evidenceIds: [...new Set([
      ...input.evidenceIds,
      ...input.segments.flatMap(segment => segment.evidenceIds),
      approvalEvidenceId,
    ])],
    approval: {
      approvedByUserId: input.ownerUserId,
      approvedAt,
      evidenceId: approvalEvidenceId,
    },
  };

  await store.createJob({
    id: jobId,
    caseId: input.caseId,
    kind: "vocal-restore",
    sourceArtifactId: source.id,
    metadata: {
      requestId,
      segmentCount: input.segments.length,
      operations: input.segments.map(segment => segment.operation),
      requiresAudition: true,
    },
  });

  try {
    const result = await restoreVocalRegions({
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
        preservation: result.runtimeReceipt.preservation,
        requiresAudition: true,
      },
    });

    return {
      jobId,
      request,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vocal restoration failed";
    await store.failJob(jobId, message);
    throw error;
  }
}
