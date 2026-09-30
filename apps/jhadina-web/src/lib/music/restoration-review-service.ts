import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseMusicRestorationArtifactStore } from "./restoration-supabase-store";

export type RestorationReviewDecision = "approved" | "rejected";

function qcPassed(qc: unknown): boolean {
  if (!qc || typeof qc !== "object" || Array.isArray(qc)) return false;
  return (qc as Record<string, unknown>).passed === true;
}

async function verifiedQcForArtifact(
  client: SupabaseClient,
  caseId: string,
  ownerUserId: string,
  artifactId: string,
): Promise<{ receiptId: string; kind: string } | null> {
  const [vocal, reconstruction, execution] = await Promise.all([
    client
      .from("music_restoration_vocal_receipts")
      .select("id,qc")
      .eq("case_id", caseId)
      .eq("owner_user_id", ownerUserId)
      .eq("output_artifact_id", artifactId)
      .maybeSingle(),
    client
      .from("music_restoration_reconstruction_receipts")
      .select("id,qc")
      .eq("case_id", caseId)
      .eq("owner_user_id", ownerUserId)
      .eq("output_artifact_id", artifactId)
      .maybeSingle(),
    client
      .from("music_restoration_execution_receipts")
      .select("id,qc,status,hash_verified")
      .eq("case_id", caseId)
      .eq("output_artifact_id", artifactId)
      .maybeSingle(),
  ]);

  if (vocal.error) throw new Error(`MUSIC_RESTORATION_REVIEW_VOCAL_QC_FAILED: ${vocal.error.message}`);
  if (reconstruction.error) throw new Error(`MUSIC_RESTORATION_REVIEW_RECONSTRUCTION_QC_FAILED: ${reconstruction.error.message}`);
  if (execution.error) throw new Error(`MUSIC_RESTORATION_REVIEW_EXECUTION_QC_FAILED: ${execution.error.message}`);

  if (vocal.data && qcPassed(vocal.data.qc)) {
    return { receiptId: String(vocal.data.id), kind: "vocal-restoration" };
  }
  if (reconstruction.data && qcPassed(reconstruction.data.qc)) {
    return { receiptId: String(reconstruction.data.id), kind: "instrument-reconstruction" };
  }
  if (
    execution.data &&
    execution.data.status === "completed" &&
    execution.data.hash_verified === true &&
    qcPassed(execution.data.qc)
  ) {
    return { receiptId: String(execution.data.id), kind: "restoration-execution" };
  }
  return null;
}

export async function reviewRestorationArtifact(input: {
  client: SupabaseClient;
  ownerUserId: string;
  caseId: string;
  artifactId: string;
  decision: RestorationReviewDecision;
  note?: string;
  comparisonArtifactId?: string;
}) {
  const store = new SupabaseMusicRestorationArtifactStore(input.client, input.ownerUserId);
  const artifact = await store.get(input.ownerUserId, input.artifactId);
  if (!artifact || artifact.caseId !== input.caseId) {
    throw new Error("MUSIC_RESTORATION_REVIEW_ARTIFACT_NOT_FOUND");
  }
  if (artifact.kind === "source") {
    throw new Error("MUSIC_RESTORATION_REVIEW_SOURCE_CANNOT_BE_PROMOTED");
  }

  const restorationCase = await store.getCase(input.caseId);
  if (!restorationCase) throw new Error("MUSIC_RESTORATION_CASE_NOT_FOUND");

  const reviewedAt = new Date().toISOString();
  const reviewId = `music-restoration-review:${globalThis.crypto.randomUUID()}`;
  let qc: { receiptId: string; kind: string } | null = null;

  if (input.decision === "approved") {
    qc = await verifiedQcForArtifact(
      input.client,
      input.caseId,
      input.ownerUserId,
      input.artifactId,
    );
    if (!qc) throw new Error("MUSIC_RESTORATION_REVIEW_VERIFIED_QC_REQUIRED");
  }

  const versionId = input.decision === "approved"
    ? `music-restoration-version:${globalThis.crypto.randomUUID()}`
    : null;

  const { data, error } = await input.client.rpc("record_music_restoration_review", {
    p_review_id: reviewId,
    p_case_id: input.caseId,
    p_owner_user_id: input.ownerUserId,
    p_artifact_id: input.artifactId,
    p_comparison_artifact_id: input.comparisonArtifactId ?? null,
    p_decision: input.decision,
    p_note: input.note?.trim().slice(0, 2000) ?? "",
    p_qc_receipt_id: qc?.receiptId ?? null,
    p_qc_receipt_kind: qc?.kind ?? null,
    p_version_id: versionId,
    p_reviewed_at: reviewedAt,
  });
  if (error) {
    throw new Error(`MUSIC_RESTORATION_REVIEW_TRANSACTION_FAILED: ${error.message}`);
  }

  const result = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {};
  return {
    reviewId: String(result.reviewId ?? reviewId),
    decision: input.decision,
    versionId: input.decision === "approved"
      ? String(result.versionId ?? versionId)
      : null,
    qc,
  };
}
