import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EvidenceObservation,
  InstrumentReconstructionRequest,
  InstrumentReconstructionRuntimeResult,
  InstrumentDonorSearchInput,
  InstrumentDonorSearchRuntimeResult,
  LedgerRestorationVersion,
  PostExecutionQcReceipt,
  RestorationArtifactStore,
  RestorationCase,
  RestorationInstrumentAssessmentReceipt,
  StoredRestorationArtifact,
  VocalRestorationRequest,
  VocalRestorationRuntimeResult,
} from "@jhadina/music-core";

const BUCKET = "jhadina-music-restoration";
const SIGNED_URL_TTL_SECONDS = 10 * 60;

function safePart(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "artifact";
}

function sourcePath(input: {
  ownerUserId: string;
  caseId: string;
  sha256: string;
  fileName: string;
}): string {
  return [
    safePart(input.ownerUserId),
    safePart(input.caseId),
    "source",
    input.sha256.toLowerCase(),
    safePart(input.fileName),
  ].join("/");
}

function derivedPath(input: {
  ownerUserId: string;
  caseId: string;
  artifactId: string;
  sha256: string;
  fileName: string;
}): string {
  return [
    safePart(input.ownerUserId),
    safePart(input.caseId),
    "derived",
    safePart(input.artifactId),
    input.sha256.toLowerCase(),
    safePart(input.fileName),
  ].join("/");
}

export class SupabaseMusicRestorationArtifactStore implements RestorationArtifactStore {
  constructor(
    private readonly client: SupabaseClient,
    private readonly ownerUserId: string,
  ) {}

  async putImmutableSource(input: {
    ownerUserId: string;
    caseId: string;
    artifactId: string;
    fileName: string;
    mimeType: string;
    sha256: string;
    bytes: Uint8Array;
  }): Promise<{ storageUri: string; runtimeUri: string }> {
    this.assertOwner(input.ownerUserId);
    const path = sourcePath(input);
    const { error } = await this.client.storage
      .from(BUCKET)
      .upload(path, input.bytes, {
        contentType: input.mimeType,
        upsert: false,
        cacheControl: "31536000",
      });
    if (error) throw new Error(`MUSIC_RESTORATION_SOURCE_UPLOAD_FAILED: ${error.message}`);
    return {
      storageUri: `supabase-private://${BUCKET}/${path}`,
      runtimeUri: await this.signedUrl(path),
    };
  }

  async putDerived(input: {
    ownerUserId: string;
    caseId: string;
    artifactId: string;
    parentArtifactId: string;
    fileName: string;
    mimeType: string;
    sha256: string;
    bytes: Uint8Array;
    role?: string;
  }): Promise<{ storageUri: string; runtimeUri: string }> {
    this.assertOwner(input.ownerUserId);
    if (!input.parentArtifactId.trim()) throw new Error("MUSIC_RESTORATION_PARENT_ARTIFACT_REQUIRED");
    const path = derivedPath(input);
    const { error } = await this.client.storage
      .from(BUCKET)
      .upload(path, input.bytes, {
        contentType: input.mimeType,
        upsert: false,
        cacheControl: "31536000",
      });
    if (error) throw new Error(`MUSIC_RESTORATION_DERIVED_UPLOAD_FAILED: ${error.message}`);
    return {
      storageUri: `supabase-private://${BUCKET}/${path}`,
      runtimeUri: await this.signedUrl(path),
    };
  }

  async resolveRuntimeUri(ownerUserId: string, artifactId: string): Promise<string> {
    this.assertOwner(ownerUserId);
    const { data, error } = await this.client
      .from("music_restoration_artifacts")
      .select("storage_bucket,storage_path")
      .eq("id", artifactId)
      .eq("owner_user_id", this.ownerUserId)
      .single();
    if (error || !data) throw new Error(`MUSIC_RESTORATION_ARTIFACT_LOOKUP_FAILED: ${error?.message ?? "not found"}`);
    if (data.storage_bucket !== BUCKET) throw new Error("MUSIC_RESTORATION_ARTIFACT_BUCKET_NOT_ADMITTED");
    return this.signedUrl(String(data.storage_path));
  }

  async registerCase(restorationCase: RestorationCase): Promise<void> {
    this.assertOwner(restorationCase.userId);
    const { error } = await this.client.from("music_restoration_cases").insert({
      id: restorationCase.id,
      user_id: restorationCase.userId,
      title: restorationCase.title,
      status: restorationCase.status,
      source_artifact_id: restorationCase.versions[0]?.outputArtifactId ?? "",
      source_version_id: restorationCase.sourceVersionId,
      current_version_id: restorationCase.currentVersionId,
      created_at: restorationCase.createdAt,
      updated_at: restorationCase.updatedAt,
    });
    if (error) throw new Error(`MUSIC_RESTORATION_CASE_WRITE_FAILED: ${error.message}`);
  }

  async register(artifact: StoredRestorationArtifact): Promise<void> {
    this.assertOwner(artifact.ownerUserId);
    const parsed = this.parseStorageUri(artifact.storageUri);
    const { error } = await this.client.from("music_restoration_artifacts").insert({
      id: artifact.id,
      case_id: artifact.caseId,
      owner_user_id: artifact.ownerUserId,
      kind: artifact.kind,
      content_hash: artifact.contentHash.toLowerCase(),
      sample_rate: artifact.sampleRate,
      channels: artifact.channels,
      sample_count: artifact.sampleCount,
      parent_artifact_id: artifact.parentArtifactId ?? null,
      storage_bucket: parsed.bucket,
      storage_path: parsed.path,
      mime_type: artifact.mimeType,
      size_bytes: artifact.sizeBytes,
      role: artifact.role ?? null,
      runtime_receipt_id: artifact.runtimeReceiptId ?? null,
      created_at: artifact.createdAt,
    });
    if (error) throw new Error(`MUSIC_RESTORATION_ARTIFACT_WRITE_FAILED: ${error.message}`);
  }

  async get(ownerUserId: string, artifactId: string): Promise<StoredRestorationArtifact | undefined> {
    this.assertOwner(ownerUserId);
    const { data, error } = await this.client
      .from("music_restoration_artifacts")
      .select("*")
      .eq("id", artifactId)
      .eq("owner_user_id", this.ownerUserId)
      .maybeSingle();
    if (error) throw new Error(`MUSIC_RESTORATION_ARTIFACT_READ_FAILED: ${error.message}`);
    if (!data) return undefined;
    return {
      id: String(data.id),
      kind: data.kind,
      contentHash: String(data.content_hash),
      sampleRate: Number(data.sample_rate),
      channels: Number(data.channels),
      sampleCount: Number(data.sample_count),
      parentArtifactId: data.parent_artifact_id ? String(data.parent_artifact_id) : undefined,
      createdAt: String(data.created_at),
      ownerUserId: String(data.owner_user_id),
      caseId: String(data.case_id),
      storageUri: `supabase-private://${String(data.storage_bucket)}/${String(data.storage_path)}`,
      mimeType: String(data.mime_type),
      sizeBytes: Number(data.size_bytes),
      role: data.role ? String(data.role) : undefined,
      runtimeReceiptId: data.runtime_receipt_id ? String(data.runtime_receipt_id) : undefined,
    };
  }


  async createJob(input: {
    id: string;
    caseId: string;
    kind: "probe" | "separate" | "perceive" | "repair" | "reconstruct" | "vocal-restore" | "donor-search";
    sourceArtifactId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.client.from("music_restoration_jobs").insert({
      id: input.id,
      case_id: input.caseId,
      owner_user_id: this.ownerUserId,
      kind: input.kind,
      status: "processing",
      source_artifact_id: input.sourceArtifactId,
      metadata: input.metadata ?? {},
    });
    if (error) throw new Error(`MUSIC_RESTORATION_JOB_WRITE_FAILED: ${error.message}`);
  }

  async completeJob(input: {
    id: string;
    outputArtifactIds?: string[];
    runtimeReceiptId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.client
      .from("music_restoration_jobs")
      .update({
        status: "completed",
        output_artifact_ids: input.outputArtifactIds ?? [],
        runtime_receipt_id: input.runtimeReceiptId ?? null,
        metadata: input.metadata ?? {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .eq("owner_user_id", this.ownerUserId);
    if (error) throw new Error(`MUSIC_RESTORATION_JOB_COMPLETE_FAILED: ${error.message}`);
  }

  async failJob(id: string, errorMessage: string): Promise<void> {
    const { error } = await this.client
      .from("music_restoration_jobs")
      .update({
        status: "failed",
        error: errorMessage.slice(0, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("owner_user_id", this.ownerUserId);
    if (error) throw new Error(`MUSIC_RESTORATION_JOB_FAIL_FAILED: ${error.message}`);
  }

  async persistEvidence(input: {
    caseId: string;
    artifactId: string;
    observations: EvidenceObservation[];
    runtimeReceiptId?: string;
  }): Promise<void> {
    if (!input.observations.length) return;
    const rows = input.observations.map(observation => ({
      id: observation.id,
      case_id: input.caseId,
      artifact_id: input.artifactId,
      kind: observation.kind,
      confidence: observation.confidence,
      region: observation.region ?? null,
      data: observation.data,
      runtime_receipt_id: input.runtimeReceiptId ?? null,
    }));
    const { error } = await this.client
      .from("music_restoration_evidence")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(`MUSIC_RESTORATION_EVIDENCE_WRITE_FAILED: ${error.message}`);
  }

  async persistDonorSearchOutcome(input: {
    caseId: string;
    jobId: string;
    search: InstrumentDonorSearchInput;
    result: InstrumentDonorSearchRuntimeResult;
  }): Promise<void> {
    const { error } = await this.client
      .from("music_restoration_donor_searches")
      .insert({
        id: input.result.runtimeReceiptId,
        job_id: input.jobId,
        case_id: input.caseId,
        owner_user_id: this.ownerUserId,
        source_artifact_id: input.search.sourceArtifactId,
        instrument_family: input.search.instrumentFamily,
        event_kind: input.search.eventKind ?? null,
        target_region: input.search.target,
        candidates: input.result.candidates.map(candidate => ({
          candidateId: candidate.candidateId,
          artifactId: candidate.artifactId,
          sourceStartMs: candidate.sourceStartMs,
          sourceEndMs: candidate.sourceEndMs,
          similarityScore: candidate.similarityScore,
          qualityScore: candidate.qualityScore,
          contextScore: candidate.contextScore,
          searchScore: candidate.searchScore,
          damageScore: candidate.damageScore,
          expectedGain: candidate.expectedGain,
          runtimeReceiptId: candidate.runtimeReceiptId,
          sha256: candidate.artifact.contentHash,
        })),
        runtime_receipt_id: input.result.runtimeReceiptId,
      });
    if (error) {
      throw new Error(`MUSIC_DONOR_SEARCH_RECEIPT_WRITE_FAILED: ${error.message}`);
    }
  }

  async persistReconstructionOutcome(input: {
    caseId: string;
    jobId: string;
    request: InstrumentReconstructionRequest;
    result: InstrumentReconstructionRuntimeResult;
    assessment: RestorationInstrumentAssessmentReceipt;
  }): Promise<void> {
    const { request, result, assessment } = input;
    const { error } = await this.client
      .from("music_restoration_reconstruction_receipts")
      .insert({
        id: result.runtimeReceipt.runtimeReceiptId,
        job_id: input.jobId,
        case_id: input.caseId,
        owner_user_id: this.ownerUserId,
        source_artifact_id: request.sourceArtifactId,
        replacement_artifact_id: request.replacementArtifactId,
        output_artifact_id: result.storedArtifact.id,
        instrument_family: request.instrumentFamily,
        segments: request.segments,
        fingerprint_similarity: request.fingerprintSimilarity,
        expected_gain: request.expectedGain,
        gain_confidence: request.gainConfidence,
        gain_evidence_method: request.gainEvidenceMethod,
        assessment_runtime_receipt_id: assessment.runtimeReceiptId,
        assessment: assessment,
        evidence_ids: request.evidenceIds,
        approval_evidence_id: request.approval.evidenceId,
        approved_by_user_id: request.approval.approvedByUserId,
        approved_at: request.approval.approvedAt,
        runtime_receipt_id: result.runtimeReceipt.runtimeReceiptId,
        qc: result.qc,
        created_at: result.storedArtifact.createdAt,
      });
    if (error) {
      throw new Error(`MUSIC_RECONSTRUCTION_RECEIPT_WRITE_FAILED: ${error.message}`);
    }
  }

  async persistVocalRestorationOutcome(input: {
    caseId: string;
    jobId: string;
    request: VocalRestorationRequest;
    result: VocalRestorationRuntimeResult;
  }): Promise<void> {
    const { request, result } = input;
    const { error } = await this.client
      .from("music_restoration_vocal_receipts")
      .insert({
        id: result.runtimeReceipt.runtimeReceiptId,
        job_id: input.jobId,
        case_id: input.caseId,
        owner_user_id: this.ownerUserId,
        source_artifact_id: request.sourceArtifactId,
        output_artifact_id: result.storedArtifact.id,
        segments: request.segments,
        evidence_ids: request.evidenceIds,
        approval_evidence_id: request.approval.evidenceId,
        approved_by_user_id: request.approval.approvedByUserId,
        approved_at: request.approval.approvedAt,
        runtime_receipt_id: result.runtimeReceipt.runtimeReceiptId,
        preservation: result.runtimeReceipt.preservation,
        qc: result.qc,
        created_at: result.storedArtifact.createdAt,
      });
    if (error) {
      throw new Error(`MUSIC_VOCAL_RESTORATION_RECEIPT_WRITE_FAILED: ${error.message}`);
    }
  }

  async persistExecutionOutcome(input: {
    caseId: string;
    receipt: PostExecutionQcReceipt;
    version?: LedgerRestorationVersion;
  }): Promise<void> {
    const { error: receiptError } = await this.client
      .from("music_restoration_execution_receipts")
      .insert({
        id: input.receipt.id,
        execution_id: input.receipt.executionId,
        case_id: input.caseId,
        source_artifact_id: input.receipt.sourceArtifactId,
        output_artifact_id: input.receipt.outputArtifactId ?? null,
        status: input.receipt.status,
        qc: input.receipt.qc,
        gate: input.receipt.gate,
        output_hash: input.receipt.outputHash ?? null,
        expected_output_hash: input.receipt.expectedOutputHash ?? null,
        hash_verified: input.receipt.hashVerified,
        reasons: input.receipt.reasons,
        created_at: input.receipt.createdAt,
      });
    if (receiptError) {
      throw new Error(`MUSIC_RESTORATION_EXECUTION_RECEIPT_WRITE_FAILED: ${receiptError.message}`);
    }

    if (!input.version) return;
    const { error: versionError } = await this.client
      .from("music_restoration_versions")
      .insert({
        id: input.version.id,
        case_id: input.version.caseId,
        source_artifact_id: input.version.sourceArtifactId,
        output_artifact_id: input.version.outputArtifactId,
        candidate_id: input.version.candidateId ?? null,
        operation_class: input.version.operationClass,
        operation: input.version.operation,
        evidence_ids: input.version.evidenceIds,
        authorization_ids: input.version.authorizationIds,
        qc_passed: input.version.qcPassed,
        created_at: input.version.createdAt,
      });
    if (versionError) {
      throw new Error(`MUSIC_RESTORATION_VERSION_WRITE_FAILED: ${versionError.message}`);
    }
    const { error: caseError } = await this.client
      .from("music_restoration_cases")
      .update({
        current_version_id: input.version.id,
        updated_at: input.version.createdAt,
      })
      .eq("id", input.caseId)
      .eq("user_id", this.ownerUserId);
    if (caseError) {
      throw new Error(`MUSIC_RESTORATION_CASE_VERSION_UPDATE_FAILED: ${caseError.message}`);
    }
  }

  async listCases(): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.client
      .from("music_restoration_cases")
      .select("id,title,status,source_artifact_id,source_version_id,current_version_id,created_at,updated_at")
      .eq("user_id", this.ownerUserId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(`MUSIC_RESTORATION_CASE_LIST_FAILED: ${error.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
  }

  async getCase(caseId: string): Promise<Record<string, unknown> | undefined> {
    const { data, error } = await this.client
      .from("music_restoration_cases")
      .select("id,title,status,source_artifact_id,source_version_id,current_version_id,created_at,updated_at")
      .eq("id", caseId)
      .eq("user_id", this.ownerUserId)
      .maybeSingle();
    if (error) throw new Error(`MUSIC_RESTORATION_CASE_READ_FAILED: ${error.message}`);
    return data ? data as Record<string, unknown> : undefined;
  }

  async listArtifacts(caseId: string): Promise<StoredRestorationArtifact[]> {
    const { data, error } = await this.client
      .from("music_restoration_artifacts")
      .select("*")
      .eq("case_id", caseId)
      .eq("owner_user_id", this.ownerUserId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`MUSIC_RESTORATION_ARTIFACT_LIST_FAILED: ${error.message}`);
    return (data ?? []).map(row => ({
      id: String(row.id),
      kind: row.kind,
      contentHash: String(row.content_hash),
      sampleRate: Number(row.sample_rate),
      channels: Number(row.channels),
      sampleCount: Number(row.sample_count),
      parentArtifactId: row.parent_artifact_id ? String(row.parent_artifact_id) : undefined,
      createdAt: String(row.created_at),
      ownerUserId: String(row.owner_user_id),
      caseId: String(row.case_id),
      storageUri: `supabase-private://${String(row.storage_bucket)}/${String(row.storage_path)}`,
      mimeType: String(row.mime_type),
      sizeBytes: Number(row.size_bytes),
      role: row.role ? String(row.role) : undefined,
      runtimeReceiptId: row.runtime_receipt_id ? String(row.runtime_receipt_id) : undefined,
    }));
  }

  async listEvidence(caseId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.client
      .from("music_restoration_evidence")
      .select("id,artifact_id,kind,confidence,region,data,runtime_receipt_id,created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`MUSIC_RESTORATION_EVIDENCE_LIST_FAILED: ${error.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
  }

  async listVersions(caseId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.client
      .from("music_restoration_versions")
      .select("id,source_artifact_id,output_artifact_id,candidate_id,operation_class,operation,evidence_ids,authorization_ids,qc_passed,created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`MUSIC_RESTORATION_VERSION_LIST_FAILED: ${error.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
  }

  async listDonorSearches(caseId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.client
      .from("music_restoration_donor_searches")
      .select("id,source_artifact_id,instrument_family,event_kind,target_region,candidates,runtime_receipt_id,created_at")
      .eq("case_id", caseId)
      .eq("owner_user_id", this.ownerUserId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`MUSIC_DONOR_SEARCH_LIST_FAILED: ${error.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
  }

  async listReconstructionReceipts(caseId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.client
      .from("music_restoration_reconstruction_receipts")
      .select("id,source_artifact_id,replacement_artifact_id,output_artifact_id,instrument_family,segments,qc,created_at")
      .eq("case_id", caseId)
      .eq("owner_user_id", this.ownerUserId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`MUSIC_RECONSTRUCTION_RECEIPT_LIST_FAILED: ${error.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
  }

  async listJobs(caseId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.client
      .from("music_restoration_jobs")
      .select("id,kind,status,source_artifact_id,output_artifact_ids,runtime_receipt_id,metadata,error,created_at,updated_at")
      .eq("case_id", caseId)
      .eq("owner_user_id", this.ownerUserId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`MUSIC_RESTORATION_JOB_LIST_FAILED: ${error.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
  }

  async listExecutionReceipts(caseId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.client
      .from("music_restoration_execution_receipts")
      .select("id,execution_id,source_artifact_id,output_artifact_id,status,qc,gate,hash_verified,reasons,created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`MUSIC_RESTORATION_EXECUTION_RECEIPT_LIST_FAILED: ${error.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
  }

  async listReviews(caseId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.client
      .from("music_restoration_reviews")
      .select("id,artifact_id,comparison_artifact_id,decision,note,qc_receipt_id,qc_receipt_kind,reviewed_at")
      .eq("case_id", caseId)
      .eq("owner_user_id", this.ownerUserId)
      .order("reviewed_at", { ascending: true });
    if (error) throw new Error(`MUSIC_RESTORATION_REVIEW_LIST_FAILED: ${error.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
  }

  async listVocalReceipts(caseId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.client
      .from("music_restoration_vocal_receipts")
      .select("id,source_artifact_id,output_artifact_id,segments,preservation,qc,created_at")
      .eq("case_id", caseId)
      .eq("owner_user_id", this.ownerUserId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`MUSIC_VOCAL_RESTORATION_RECEIPT_LIST_FAILED: ${error.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
  }

  async downloadArtifactBytes(artifactId: string): Promise<Uint8Array> {
    const { data, error } = await this.client
      .from("music_restoration_artifacts")
      .select("storage_bucket,storage_path")
      .eq("id", artifactId)
      .eq("owner_user_id", this.ownerUserId)
      .single();
    if (error || !data) {
      throw new Error(`MUSIC_RESTORATION_ARTIFACT_EXPORT_LOOKUP_FAILED: ${error?.message ?? "not found"}`);
    }
    if (String(data.storage_bucket) !== BUCKET) {
      throw new Error("MUSIC_RESTORATION_ARTIFACT_BUCKET_NOT_ADMITTED");
    }
    const { data: blob, error: downloadError } = await this.client.storage
      .from(BUCKET)
      .download(String(data.storage_path));
    if (downloadError || !blob) {
      throw new Error(`MUSIC_RESTORATION_ARTIFACT_EXPORT_DOWNLOAD_FAILED: ${downloadError?.message ?? "missing bytes"}`);
    }
    return new Uint8Array(await blob.arrayBuffer());
  }

  async createArtifactDownloadUrl(artifactId: string, expiresInSeconds = 15 * 60): Promise<string> {
    const { data, error } = await this.client
      .from("music_restoration_artifacts")
      .select("storage_bucket,storage_path")
      .eq("id", artifactId)
      .eq("owner_user_id", this.ownerUserId)
      .single();
    if (error || !data) {
      throw new Error(`MUSIC_RESTORATION_ARTIFACT_DOWNLOAD_LOOKUP_FAILED: ${error?.message ?? "not found"}`);
    }
    if (String(data.storage_bucket) !== BUCKET) {
      throw new Error("MUSIC_RESTORATION_ARTIFACT_BUCKET_NOT_ADMITTED");
    }
    const { data: signed, error: signedError } = await this.client.storage
      .from(BUCKET)
      .createSignedUrl(String(data.storage_path), Math.max(60, Math.min(3600, expiresInSeconds)));
    if (signedError || !signed?.signedUrl) {
      throw new Error(`MUSIC_RESTORATION_ARTIFACT_DOWNLOAD_SIGN_FAILED: ${signedError?.message ?? "missing URL"}`);
    }
    return signed.signedUrl;
  }

  private assertOwner(ownerUserId: string): void {
    if (!ownerUserId || ownerUserId !== this.ownerUserId) {
      throw new Error("MUSIC_RESTORATION_OWNER_MISMATCH");
    }
  }

  private async signedUrl(path: string): Promise<string> {
    const { data, error } = await this.client.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      throw new Error(`MUSIC_RESTORATION_SIGNED_URL_FAILED: ${error?.message ?? "missing signed URL"}`);
    }
    return data.signedUrl;
  }

  private parseStorageUri(uri: string): { bucket: string; path: string } {
    const prefix = "supabase-private://";
    if (!uri.startsWith(prefix)) throw new Error("MUSIC_RESTORATION_STORAGE_URI_INVALID");
    const rest = uri.slice(prefix.length);
    const slash = rest.indexOf("/");
    if (slash <= 0) throw new Error("MUSIC_RESTORATION_STORAGE_URI_INVALID");
    const bucket = rest.slice(0, slash);
    const path = rest.slice(slash + 1);
    if (bucket !== BUCKET || !path) throw new Error("MUSIC_RESTORATION_STORAGE_URI_NOT_ADMITTED");
    return { bucket, path };
  }
}
