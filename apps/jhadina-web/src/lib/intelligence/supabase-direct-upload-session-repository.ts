import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntakeModality, PerceptionJob } from "@jhadina/intelligence-core";
import type { UniversalUploadPrivacyClass } from "./production-universal-upload-runtime";

export type DirectUploadSessionStatus =
  | "issued"
  | "finalized"
  | "rejected"
  | "expired";

export type DirectUploadSession = {
  id: string;
  actorId: string;
  quarantinePath: string;
  filename: string;
  declaredMediaType: string;
  modality: IntakeModality;
  expectedByteLength: number;
  privacyClass: UniversalUploadPrivacyClass;
  intent?: string;
  status: DirectUploadSessionStatus;
  expiresAt: string;
  finalizeLeaseOwner?: string;
  finalizeLeaseToken?: string;
  finalizeLeaseExpiresAt?: string;
  scanSha256?: string;
  scanAt?: string;
  assetId?: string;
  perceptionJobId?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

type SessionRow = {
  id: string;
  actor_id: string;
  quarantine_path: string;
  filename: string;
  declared_media_type: string;
  modality: IntakeModality;
  expected_byte_length: number;
  privacy_class: UniversalUploadPrivacyClass;
  intent: string | null;
  status: DirectUploadSessionStatus;
  expires_at: string;
  finalize_lease_owner: string | null;
  finalize_lease_token: string | null;
  finalize_lease_expires_at: string | null;
  scan_sha256: string | null;
  scan_at: string | null;
  asset_id: string | null;
  perception_job_id: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

function toSession(row: SessionRow): DirectUploadSession {
  return {
    id: row.id,
    actorId: row.actor_id,
    quarantinePath: row.quarantine_path,
    filename: row.filename,
    declaredMediaType: row.declared_media_type,
    modality: row.modality,
    expectedByteLength: Number(row.expected_byte_length),
    privacyClass: row.privacy_class,
    intent: row.intent ?? undefined,
    status: row.status,
    expiresAt: row.expires_at,
    finalizeLeaseOwner: row.finalize_lease_owner ?? undefined,
    finalizeLeaseToken: row.finalize_lease_token ?? undefined,
    finalizeLeaseExpiresAt: row.finalize_lease_expires_at ?? undefined,
    scanSha256: row.scan_sha256 ?? undefined,
    scanAt: row.scan_at ?? undefined,
    assetId: row.asset_id ?? undefined,
    perceptionJobId: row.perception_job_id ?? undefined,
    lastError: row.last_error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseDirectUploadSessionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(input: {
    id: string;
    actorId: string;
    quarantinePath: string;
    filename: string;
    declaredMediaType: string;
    modality: IntakeModality;
    expectedByteLength: number;
    privacyClass: UniversalUploadPrivacyClass;
    intent?: string;
    expiresAt: string;
  }): Promise<DirectUploadSession> {
    const now = new Date().toISOString();
    const row = {
      id: input.id,
      actor_id: input.actorId,
      quarantine_path: input.quarantinePath,
      filename: input.filename,
      declared_media_type: input.declaredMediaType,
      modality: input.modality,
      expected_byte_length: input.expectedByteLength,
      privacy_class: input.privacyClass,
      intent: input.intent ?? null,
      status: "issued",
      expires_at: input.expiresAt,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await this.client
      .from("jhadina_upload_sessions")
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;
    return toSession(data as SessionRow);
  }

  async get(actorId: string, sessionId: string): Promise<DirectUploadSession | undefined> {
    const { data, error } = await this.client
      .from("jhadina_upload_sessions")
      .select("*")
      .eq("actor_id", actorId)
      .eq("id", sessionId)
      .maybeSingle();
    if (error) throw error;
    return data ? toSession(data as SessionRow) : undefined;
  }

  async claimFinalize(input: {
    actorId: string;
    sessionId: string;
    workerId: string;
    leaseMs: number;
  }) {
    const { data, error } = await this.client.rpc("claim_jhadina_upload_session_finalize", {
      p_actor_id: input.actorId,
      p_session_id: input.sessionId,
      p_worker_id: input.workerId,
      p_lease_ms: input.leaseMs,
    });
    if (error) throw error;
    return data ? toSession(data as SessionRow) : undefined;
  }

  async renewFinalizeLease(input: {
    actorId: string;
    sessionId: string;
    workerId: string;
    leaseToken: string;
    leaseMs: number;
  }) {
    const { data, error } = await this.client.rpc("renew_jhadina_upload_session_finalize_lease", {
      p_actor_id: input.actorId,
      p_session_id: input.sessionId,
      p_worker_id: input.workerId,
      p_lease_token: input.leaseToken,
      p_lease_ms: input.leaseMs,
    });
    if (error) throw error;
    return data ? toSession(data as SessionRow) : undefined;
  }

  async recordScan(input: {
    actorId: string;
    sessionId: string;
    workerId: string;
    leaseToken: string;
    sha256: string;
    scannedAt: string;
  }) {
    const { data, error } = await this.client.rpc("record_jhadina_upload_session_scan", {
      p_actor_id: input.actorId,
      p_session_id: input.sessionId,
      p_worker_id: input.workerId,
      p_lease_token: input.leaseToken,
      p_sha256: input.sha256,
      p_scanned_at: input.scannedAt,
    });
    if (error) throw error;
    return data ? toSession(data as SessionRow) : undefined;
  }

  async complete(input: {
    actorId: string;
    sessionId: string;
    workerId: string;
    leaseToken: string;
    assetId: string;
    perceptionJobId: string;
  }) {
    const { data, error } = await this.client.rpc("complete_jhadina_upload_session", {
      p_actor_id: input.actorId,
      p_session_id: input.sessionId,
      p_worker_id: input.workerId,
      p_lease_token: input.leaseToken,
      p_asset_id: input.assetId,
      p_perception_job_id: input.perceptionJobId,
    });
    if (error) throw error;
    return data ? toSession(data as SessionRow) : undefined;
  }

  async reject(input: {
    actorId: string;
    sessionId: string;
    workerId: string;
    leaseToken: string;
    error: string;
  }) {
    const { data, error } = await this.client.rpc("reject_jhadina_upload_session", {
      p_actor_id: input.actorId,
      p_session_id: input.sessionId,
      p_worker_id: input.workerId,
      p_lease_token: input.leaseToken,
      p_error: input.error,
    });
    if (error) throw error;
    return data ? toSession(data as SessionRow) : undefined;
  }

  async release(input: {
    actorId: string;
    sessionId: string;
    workerId: string;
    leaseToken: string;
    error: string;
  }) {
    const { data, error } = await this.client.rpc("release_jhadina_upload_session_finalize", {
      p_actor_id: input.actorId,
      p_session_id: input.sessionId,
      p_worker_id: input.workerId,
      p_lease_token: input.leaseToken,
      p_error: input.error,
    });
    if (error) throw error;
    return data ? toSession(data as SessionRow) : undefined;
  }
}

export type FinalizedDirectUpload = {
  session: DirectUploadSession;
  job?: Pick<PerceptionJob, "id" | "status" | "attempt" | "maxAttempts" | "availableAt">;
};
