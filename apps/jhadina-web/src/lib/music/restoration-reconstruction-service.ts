import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assessInstrumentReplacementArtifacts,
  decideInstrumentReplacement,
  reconstructInstrumentRegions,
  type InstrumentFamily,
  type ReconstructionSegment,
} from "@jhadina/music-core";
import { createMusicRestorationRuntimeClient } from "./restoration-runtime-server";
import { SupabaseMusicRestorationArtifactStore } from "./restoration-supabase-store";

export interface InstrumentReconstructionServiceInput {
  client: SupabaseClient;
  ownerUserId: string;
  caseId: string;
  sourceArtifactId: string;
  replacementArtifactId: string;
  instrumentFamily: InstrumentFamily;
  segments: ReconstructionSegment[];
  evidenceIds: string[];
  approved: boolean;
}

export async function runInstrumentReconstruction(input: InstrumentReconstructionServiceInput) {
  const store = new SupabaseMusicRestorationArtifactStore(input.client, input.ownerUserId);
  const [source, replacement] = await Promise.all([
    store.get(input.ownerUserId, input.sourceArtifactId),
    store.get(input.ownerUserId, input.replacementArtifactId),
  ]);
  if (!source || source.caseId !== input.caseId) throw new Error("MUSIC_RECONSTRUCTION_SOURCE_NOT_FOUND");
  if (!replacement || replacement.caseId !== input.caseId) throw new Error("MUSIC_RECONSTRUCTION_REPLACEMENT_NOT_FOUND");
  if (source.id === replacement.id) throw new Error("MUSIC_RECONSTRUCTION_SOURCE_DONOR_MUST_DIFFER");
  if (!input.approved) throw new Error("MUSIC_RECONSTRUCTION_EXPLICIT_APPROVAL_REQUIRED");
  if (source.role && replacement.role && source.role !== replacement.role) {
    throw new Error("MUSIC_RECONSTRUCTION_PERSISTED_ROLE_MISMATCH");
  }
  if ((input.instrumentFamily === "drums" || input.instrumentFamily === "bass") &&
      (source.role !== input.instrumentFamily || replacement.role !== input.instrumentFamily)) {
    throw new Error("MUSIC_RECONSTRUCTION_PERSISTED_FAMILY_MISMATCH");
  }
  if (source.role === "vocals" || replacement.role === "vocals") {
    throw new Error("MUSIC_RECONSTRUCTION_VOCAL_ARTIFACT_NOT_ADMITTED");
  }

  const runtime = await createMusicRestorationRuntimeClient();
  const assessment = await assessInstrumentReplacementArtifacts({
    ownerUserId: input.ownerUserId,
    instrumentFamily: input.instrumentFamily,
    segments: input.segments,
    source,
    replacement,
    runtime,
    store,
  });
  const pitched = ["acoustic-guitar","electric-guitar","piano","organ","strings","brass","woodwinds","bass","synth"];
  if (pitched.includes(input.instrumentFamily) &&
      assessment.diagnostics?.musicalFit?.status !== "compatible") {
    throw new Error("MUSIC_RECONSTRUCTION_MUSICAL_FIT_NOT_PROVEN: Preserve source; audition/verify notes and rhythm before using a donor.");
  }
  const candidateId = `instrument-replacement:${globalThis.crypto.randomUUID()}`;
  const decision = decideInstrumentReplacement({
    observed: assessment.observedFingerprint,
    candidate: {
      id: candidateId,
      label: `${input.instrumentFamily} donor`,
      fingerprint: assessment.replacementFingerprint,
      sourceArtifactId: source.id,
      replacementArtifactId: replacement.id,
    },
    gainEvidence: assessment.gainEvidence,
  });
  if (!decision.replace) {
    throw new Error(`MUSIC_RECONSTRUCTION_DONOR_REJECTED: ${decision.reason}`);
  }

  const requestId = `music-reconstruction-request:${globalThis.crypto.randomUUID()}`;
  const jobId = `music-reconstruct:${globalThis.crypto.randomUUID()}`;
  const approvedAt = new Date().toISOString();
  const approvalEvidenceId = `music-reconstruction-approval:${globalThis.crypto.randomUUID()}`;
  const request = {
    requestId,
    sourceArtifactId: source.id,
    replacementArtifactId: replacement.id,
    instrumentFamily: input.instrumentFamily,
    scope: "segments" as const,
    segments: input.segments,
    fingerprintSimilarity: decision.fingerprintSimilarity,
    expectedGain: decision.expectedRestorationGain,
    gainConfidence: decision.gainEvidenceConfidence,
    gainEvidenceMethod: assessment.gainEvidence.method,
    evidenceIds: [...new Set([
      ...input.evidenceIds,
      assessment.runtimeReceiptId,
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
    kind: "reconstruct",
    sourceArtifactId: source.id,
    metadata: {
      requestId,
      replacementArtifactId: replacement.id,
      instrumentFamily: input.instrumentFamily,
      candidateId,
      fingerprintSimilarity: decision.fingerprintSimilarity,
      expectedGain: decision.expectedRestorationGain,
      gainConfidence: decision.gainEvidenceConfidence,
      gainEvidenceMethod: assessment.gainEvidence.method,
      assessmentRuntimeReceiptId: assessment.runtimeReceiptId,
      assessmentDiagnostics: assessment.diagnostics,
      requiresAudition: true,
    },
  });

  try {
    const result = await reconstructInstrumentRegions({
      ownerUserId: input.ownerUserId,
      caseId: input.caseId,
      request,
      source,
      replacement,
      runtime,
      store,
      jobId,
    });
    await store.persistReconstructionOutcome({
      caseId: input.caseId,
      jobId,
      request,
      result,
      assessment,
    });
    await store.completeJob({
      id: jobId,
      outputArtifactIds: [result.storedArtifact.id],
      runtimeReceiptId: result.runtimeReceipt.runtimeReceiptId,
      metadata: {
        requestId,
        replacementArtifactId: replacement.id,
        candidateId,
        structuralQc: result.qc,
        requiresAudition: true,
      },
    });
    return {
      jobId,
      request,
      decision,
      assessment,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Instrument reconstruction failed";
    await store.failJob(jobId, message);
    throw error;
  }
}
