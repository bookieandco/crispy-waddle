import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateRestorationFinalCertification,
  type RestorationFinalEvidence,
  type RestorationFinalJobEvidence,
} from "@jhadina/music-core";
import { buildRestorationDawBundle } from "./restoration-daw-bundle-service";
import {
  getMusicRestorationRuntimeHealth,
  type MusicRestorationRuntimeHealth,
} from "./restoration-runtime-server";
import { getRestorationStudioCase } from "./restoration-studio-service";
import { SupabaseMusicRestorationArtifactStore } from "./restoration-supabase-store";

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function boolValue(value: unknown): boolean {
  return value === true;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

async function currentRuntimeHealth(): Promise<{
  productionReady: boolean;
  health: MusicRestorationRuntimeHealth | null;
  error?: string;
}> {
  try {
    const health = await getMusicRestorationRuntimeHealth();
    return { productionReady: health.productionReady === true, health };
  } catch (error) {
    return {
      productionReady: false,
      health: null,
      error: error instanceof Error ? error.message : "Music restoration runtime health unavailable",
    };
  }
}

function qcPassedForReview(input: {
  review?: Record<string, unknown>;
  vocalReceipts: Array<Record<string, unknown>>;
  reconstructionReceipts: Array<Record<string, unknown>>;
  executionReceipts: Array<Record<string, unknown>>;
}): boolean {
  const review = input.review;
  if (!review) return false;
  const id = stringValue(review.qc_receipt_id);
  const kind = stringValue(review.qc_receipt_kind);
  if (!id || !kind) return false;

  if (kind === "vocal-restoration") {
    const receipt = input.vocalReceipts.find(item => String(item.id) === id);
    return Boolean(receipt && objectValue(receipt.qc).passed === true);
  }
  if (kind === "instrument-reconstruction") {
    const receipt = input.reconstructionReceipts.find(item => String(item.id) === id);
    return Boolean(receipt && objectValue(receipt.qc).passed === true);
  }
  if (kind === "restoration-execution") {
    const receipt = input.executionReceipts.find(item => String(item.id) === id);
    return Boolean(
      receipt &&
      String(receipt.status) === "completed" &&
      boolValue(receipt.hash_verified) &&
      objectValue(receipt.qc).passed === true,
    );
  }
  return false;
}

export async function inspectRestorationFinalCertification(input: {
  client: SupabaseClient;
  ownerUserId: string;
  caseId: string;
}) {
  const store = new SupabaseMusicRestorationArtifactStore(input.client, input.ownerUserId);
  const restorationCase = await store.getCase(input.caseId);
  if (!restorationCase) throw new Error("MUSIC_RESTORATION_CASE_NOT_FOUND");

  const [
    artifacts,
    jobsRaw,
    evidenceRows,
    versions,
    reviews,
    reconstructionReceipts,
    vocalReceipts,
    executionReceipts,
    runtime,
  ] = await Promise.all([
    store.listArtifacts(input.caseId),
    store.listJobs(input.caseId),
    store.listEvidence(input.caseId),
    store.listVersions(input.caseId),
    store.listReviews(input.caseId),
    store.listReconstructionReceipts(input.caseId),
    store.listVocalReceipts(input.caseId),
    store.listExecutionReceipts(input.caseId),
    currentRuntimeHealth(),
  ]);

  const sourceArtifactId = String(restorationCase.source_artifact_id ?? "");
  const source = artifacts.find(item => item.id === sourceArtifactId);
  const currentVersionId = stringValue(restorationCase.current_version_id);
  const currentVersionRaw = versions.find(item => String(item.id) === currentVersionId);
  const candidateId = stringValue(currentVersionRaw?.candidate_id);
  const currentOutputId = stringValue(currentVersionRaw?.output_artifact_id);
  const approvedReview = reviews.find(item =>
    String(item.id) === candidateId &&
    String(item.decision) === "approved" &&
    String(item.artifact_id) === currentOutputId,
  );

  const requiredStemArtifactIds: RestorationFinalEvidence["requiredStemArtifactIds"] = {};
  for (const role of ["vocals","drums","bass","other"] as const) {
    const artifact = artifacts.find(item => item.role === role);
    if (artifact) requiredStemArtifactIds[role] = artifact.id;
  }

  const jobs: RestorationFinalJobEvidence[] = jobsRaw.map(item => ({
    id: String(item.id),
    kind: String(item.kind ?? ""),
    status: String(item.status ?? ""),
    sourceArtifactId: stringValue(item.source_artifact_id),
    outputArtifactIds: stringArray(item.output_artifact_ids),
    runtimeReceiptId: stringValue(item.runtime_receipt_id),
  }));

  const evidenceReceiptIds = new Set(
    evidenceRows
      .map(item => stringValue(item.runtime_receipt_id))
      .filter((value): value is string => Boolean(value)),
  );

  const evidence: RestorationFinalEvidence = {
    runtimeProductionReady: runtime.productionReady,
    sourceArtifact: source ? {
      id: source.id,
      kind: source.kind,
      sha256: source.contentHash,
    } : undefined,
    requiredStemArtifactIds,
    jobs,
    evidenceCount: evidenceRows.length,
    evidenceRuntimeReceiptCount: evidenceReceiptIds.size,
    currentVersion: currentVersionRaw && currentOutputId ? {
      id: String(currentVersionRaw.id),
      outputArtifactId: currentOutputId,
      candidateId,
      qcPassed: boolValue(currentVersionRaw.qc_passed),
    } : undefined,
    approvedReview: approvedReview ? {
      id: String(approvedReview.id),
      artifactId: String(approvedReview.artifact_id),
      decision: String(approvedReview.decision),
      qcReceiptId: stringValue(approvedReview.qc_receipt_id),
      qcReceiptKind: stringValue(approvedReview.qc_receipt_kind),
    } : undefined,
    currentOutputQcVerified: qcPassedForReview({
      review: approvedReview,
      vocalReceipts,
      reconstructionReceipts,
      executionReceipts,
    }),
    artifactHashesVerified: false,
  };

  return {
    restorationCase,
    artifacts,
    runtime,
    evidence,
    decision: evaluateRestorationFinalCertification(evidence),
  };
}

export async function certifyRestorationFinal(input: {
  client: SupabaseClient;
  ownerUserId: string;
  caseId: string;
}) {
  const preflight = await inspectRestorationFinalCertification(input);
  const hardBlockers = preflight.decision.checks.filter(item =>
    !item.passed &&
    item.id !== "artifact-hashes" &&
    item.id !== "daw-bundle",
  );
  if (hardBlockers.length) {
    return {
      certified: false as const,
      persisted: null,
      runtime: preflight.runtime,
      decision: preflight.decision,
    };
  }

  const currentVersion = preflight.evidence.currentVersion;
  if (!currentVersion) throw new Error("MUSIC_RESTORATION_FINAL_VERSION_REQUIRED");

  const { data: existing, error: existingError } = await input.client
    .from("music_restoration_final_certifications")
    .select("id,case_id,current_version_id,output_artifact_id,bundle_sha256,certified_at,evidence")
    .eq("case_id", input.caseId)
    .eq("owner_user_id", input.ownerUserId)
    .eq("current_version_id", currentVersion.id)
    .maybeSingle();
  if (existingError) {
    throw new Error(`MUSIC_RESTORATION_FINAL_RECEIPT_READ_FAILED: ${existingError.message}`);
  }
  if (existing) {
    const historicalEvidence: RestorationFinalEvidence = {
      ...preflight.evidence,
      artifactHashesVerified: true,
      dawBundleSha256: String(existing.bundle_sha256),
    };
    const decision = evaluateRestorationFinalCertification(historicalEvidence);
    return {
      certified: decision.status === "certified",
      persisted: existing,
      runtime: preflight.runtime,
      decision,
    };
  }

  const snapshot = await getRestorationStudioCase(input);
  const bundle = await buildRestorationDawBundle({
    client: input.client,
    ownerUserId: input.ownerUserId,
    snapshot,
  });

  const evidence: RestorationFinalEvidence = {
    ...preflight.evidence,
    artifactHashesVerified: bundle.verifiedArtifacts.length === snapshot.manifest.tracks.length,
    dawBundleSha256: bundle.sha256,
  };
  const decision = evaluateRestorationFinalCertification(evidence);
  if (decision.status !== "certified") {
    return {
      certified: false as const,
      persisted: null,
      runtime: preflight.runtime,
      decision,
    };
  }

  const outputArtifactId = currentVersion.outputArtifactId;
  const receiptId = `music-restoration-final:${globalThis.crypto.randomUUID()}`;
  const certifiedAt = new Date().toISOString();
  const { data, error } = await input.client
    .from("music_restoration_final_certifications")
    .insert({
      id: receiptId,
      case_id: input.caseId,
      owner_user_id: input.ownerUserId,
      source_artifact_id: preflight.evidence.sourceArtifact?.id,
      current_version_id: currentVersion.id,
      output_artifact_id: outputArtifactId,
      bundle_sha256: bundle.sha256,
      verified_artifacts: bundle.verifiedArtifacts,
      runtime_health: preflight.runtime.health ?? {
        productionReady: false,
        error: preflight.runtime.error ?? null,
      },
      evidence: {
        checks: decision.checks,
        sourceArtifact: preflight.evidence.sourceArtifact,
        requiredStemArtifactIds: preflight.evidence.requiredStemArtifactIds,
        jobReceiptIds: preflight.evidence.jobs
          .filter(job => job.runtimeReceiptId)
          .map(job => ({ id: job.id, kind: job.kind, runtimeReceiptId: job.runtimeReceiptId })),
        evidenceCount: preflight.evidence.evidenceCount,
        evidenceRuntimeReceiptCount: preflight.evidence.evidenceRuntimeReceiptCount,
        approvedReview: preflight.evidence.approvedReview,
      },
      certified_at: certifiedAt,
    })
    .select("id,case_id,current_version_id,output_artifact_id,bundle_sha256,certified_at,evidence")
    .single();
  if (error || !data) {
    throw new Error(`MUSIC_RESTORATION_FINAL_RECEIPT_WRITE_FAILED: ${error?.message ?? "missing receipt"}`);
  }

  return {
    certified: true as const,
    persisted: data,
    runtime: preflight.runtime,
    decision,
  };
}
