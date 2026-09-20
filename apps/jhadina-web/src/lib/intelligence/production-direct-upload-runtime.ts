import { randomUUID } from "node:crypto";
import type { IntakeModality } from "@jhadina/intelligence-core";
import { createServiceRoleClient } from "../supabase/service-role";
import {
  SupabaseDirectUploadObjectStore,
  type DirectUploadGrant,
} from "./supabase-direct-upload-object-store";
import {
  SupabaseDirectUploadSessionRepository,
  type DirectUploadSession,
} from "./supabase-direct-upload-session-repository";
import { JHADINA_INTAKE_BUCKET } from "./supabase-universal-upload-store";
import { validateUniversalUploadDeclaration } from "./universal-upload-validation";
import type { UniversalUploadPrivacyClass } from "./production-universal-upload-runtime";

const SIGNED_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;

const PRIVACY_RANK: Record<UniversalUploadPrivacyClass, number> = {
  internal: 1,
  sensitive: 2,
  restricted: 3,
};

export type DirectUploadSessionIssue = {
  session: DirectUploadSession;
  upload: {
    bucket: typeof JHADINA_INTAKE_BUCKET;
    path: string;
    token: string;
    signedUploadUrl?: string;
    resumable: {
      endpoint: string;
      headers: Readonly<Record<"x-signature", string>>;
      chunkSizeBytes: number;
      metadata: {
        bucketName: typeof JHADINA_INTAKE_BUCKET;
        objectName: string;
        contentType: string;
        cacheControl: string;
      };
    };
  };
};

export interface DirectUploadSessionStore {
  create(input: {
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
  }): Promise<DirectUploadSession>;
  get(actorId: string, sessionId: string): Promise<DirectUploadSession | undefined>;
  requestFinalize(input: {
    actorId: string;
    sessionId: string;
    maxAttempts: number;
  }): Promise<DirectUploadSession | undefined>;
}

export interface DirectUploadIssueObjectStore {
  issue(input: {
    actorId: string;
    sessionId: string;
    filename: string;
  }): Promise<DirectUploadGrant>;
}

/**
 * User-request path only. It issues narrow quarantine upload capabilities and
 * enqueues finalization. Scanner/hash/promotion never run in the HTTP request.
 */
export class DirectUploadRuntime {
  constructor(
    private readonly sessions: DirectUploadSessionStore,
    private readonly directObjects: DirectUploadIssueObjectStore,
    private readonly scannerPrivacyCeiling: UniversalUploadPrivacyClass = "sensitive",
    private readonly now: () => Date = () => new Date(),
    private readonly id: () => string = () => randomUUID(),
    private readonly finalizeMaxAttempts = 4,
  ) {
    if (
      !Number.isInteger(finalizeMaxAttempts) ||
      finalizeMaxAttempts < 1 ||
      finalizeMaxAttempts > 20
    ) {
      throw new Error("DIRECT_UPLOAD_FINALIZE_MAX_ATTEMPTS_INVALID");
    }
  }

  async issue(input: {
    actorId: string;
    filename: string;
    declaredMediaType: string;
    byteLength: number;
    privacyClass: UniversalUploadPrivacyClass;
    intent?: string;
  }): Promise<DirectUploadSessionIssue> {
    if (!input.actorId.trim()) throw new Error("DIRECT_UPLOAD_ACTOR_REQUIRED");
    if (!input.filename.trim()) throw new Error("DIRECT_UPLOAD_FILENAME_REQUIRED");
    if (PRIVACY_RANK[input.privacyClass] > PRIVACY_RANK[this.scannerPrivacyCeiling]) {
      throw new Error("DIRECT_UPLOAD_SCANNER_PRIVACY_INCOMPATIBLE");
    }

    const validated = validateUniversalUploadDeclaration({
      declaredMediaType: input.declaredMediaType,
      byteLength: input.byteLength,
    });
    const sessionId = this.id();
    const grant = await this.directObjects.issue({
      actorId: input.actorId,
      sessionId,
      filename: input.filename,
    });
    const expiresAt = new Date(this.now().getTime() + SIGNED_UPLOAD_TTL_MS).toISOString();
    const session = await this.sessions.create({
      id: sessionId,
      actorId: input.actorId,
      quarantinePath: grant.quarantinePath,
      filename: input.filename,
      declaredMediaType: validated.mediaType,
      modality: validated.modality,
      expectedByteLength: input.byteLength,
      privacyClass: input.privacyClass,
      intent: input.intent,
      expiresAt,
    });

    return Object.freeze({
      session,
      upload: Object.freeze({
        bucket: JHADINA_INTAKE_BUCKET,
        path: grant.quarantinePath,
        token: grant.token,
        signedUploadUrl: grant.signedUploadUrl,
        resumable: Object.freeze({
          endpoint: grant.tusEndpoint,
          headers: Object.freeze({ "x-signature": grant.token }),
          chunkSizeBytes: grant.chunkSizeBytes,
          metadata: Object.freeze({
            bucketName: JHADINA_INTAKE_BUCKET,
            objectName: grant.quarantinePath,
            contentType: validated.mediaType,
            cacheControl: "3600",
          }),
        }),
      }),
    });
  }

  async requestFinalize(input: {
    actorId: string;
    sessionId: string;
  }): Promise<DirectUploadSession> {
    const existing = await this.sessions.get(input.actorId, input.sessionId);
    if (!existing) throw new Error("DIRECT_UPLOAD_SESSION_NOT_FOUND");

    if (existing.status === "finalized") return existing;
    if (existing.status === "rejected") {
      throw new Error(`DIRECT_UPLOAD_SESSION_REJECTED:${existing.lastError ?? "rejected"}`);
    }
    if (existing.status === "expired") throw new Error("DIRECT_UPLOAD_SESSION_EXPIRED");
    if (
      existing.status === "finalize_queued" ||
      existing.status === "finalizing" ||
      existing.status === "finalize_retry"
    ) {
      return existing;
    }

    const queued = await this.sessions.requestFinalize({
      actorId: input.actorId,
      sessionId: input.sessionId,
      maxAttempts: this.finalizeMaxAttempts,
    });
    if (!queued) throw new Error("DIRECT_UPLOAD_FINALIZE_QUEUE_FAILED");
    if (queued.status === "expired") throw new Error("DIRECT_UPLOAD_SESSION_EXPIRED");
    return queued;
  }
}

export function createProductionDirectUploadRuntime(): DirectUploadRuntime {
  const client = createServiceRoleClient();
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!client || !projectUrl) throw new Error("DIRECT_UPLOAD_RUNTIME_SUPABASE_UNAVAILABLE");
  if (!process.env.JHADINA_MEDIA_SCANNER_URL) {
    throw new Error("DIRECT_UPLOAD_RUNTIME_MEDIA_SCANNER_UNAVAILABLE");
  }

  const ceilingRaw = process.env.JHADINA_MEDIA_SCANNER_PRIVACY_CEILING;
  const scannerPrivacyCeiling: UniversalUploadPrivacyClass =
    ceilingRaw === "internal" || ceilingRaw === "sensitive" || ceilingRaw === "restricted"
      ? ceilingRaw
      : "sensitive";

  const finalizeAttemptsRaw = Number(
    process.env.JHADINA_UPLOAD_FINALIZE_MAX_ATTEMPTS ?? "4",
  );
  const finalizeMaxAttempts =
    Number.isInteger(finalizeAttemptsRaw) &&
    finalizeAttemptsRaw >= 1 &&
    finalizeAttemptsRaw <= 20
      ? finalizeAttemptsRaw
      : 4;

  return new DirectUploadRuntime(
    new SupabaseDirectUploadSessionRepository(client),
    new SupabaseDirectUploadObjectStore(client, projectUrl),
    scannerPrivacyCeiling,
    () => new Date(),
    () => randomUUID(),
    finalizeMaxAttempts,
  );
}
