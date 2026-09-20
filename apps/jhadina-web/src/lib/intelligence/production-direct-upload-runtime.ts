import { randomUUID } from "node:crypto";
import type { MediaSecurityScanner } from "@jhadina/security-core";
import { assertSafeMedia } from "@jhadina/security-core";
import {
  GovernedAssetRegistry,
  perceptionJobId,
  type PerceptionJobRepository,
} from "@jhadina/intelligence-core";
import { createServiceRoleClient } from "../supabase/service-role";
import { HttpMediaSecurityScanner } from "./http-media-security-scanner";
import {
  SupabaseDirectUploadObjectStore,
  type DirectUploadGrant,
  type DirectUploadObjectInfo,
} from "./supabase-direct-upload-object-store";
import {
  SupabaseDirectUploadSessionRepository,
  type DirectUploadSession,
} from "./supabase-direct-upload-session-repository";
import { SupabaseIntelligenceAssetStore } from "./supabase-intelligence-asset-store";
import { SupabasePerceptionJobRepository } from "./supabase-perception-job-repository";
import {
  SupabaseUniversalUploadObjectStore,
  JHADINA_INTAKE_BUCKET,
} from "./supabase-universal-upload-store";
import {
  validateUniversalUploadDeclaration,
} from "./universal-upload-validation";
import type { UniversalUploadPrivacyClass } from "./production-universal-upload-runtime";

const SIGNED_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;
const DEFAULT_FINALIZE_LEASE_MS = 5 * 60 * 1000;

const PRIVACY_RANK: Record<UniversalUploadPrivacyClass, number> = {
  internal: 1,
  sensitive: 2,
  restricted: 3,
};

const TERMINAL_FINALIZE_ERRORS = [
  "DIRECT_UPLOAD_SIZE_MISMATCH",
  "DIRECT_UPLOAD_MIME_MISMATCH",
  "DIRECT_UPLOAD_OBJECT_SIZE_UNAVAILABLE",
  "DIRECT_UPLOAD_OBJECT_MIME_UNAVAILABLE",
  "MEDIA_SECURITY_",
  "MEDIA_SCANNER_ASSET_MISMATCH",
  "MEDIA_SCANNER_MIME_MISMATCH",
  "MEDIA_SCANNER_SIZE_MISMATCH",
  "MEDIA_SCANNER_SHA256_INVALID",
  "MEDIA_SCANNER_VERDICT_INVALID",
  "MEDIA_SCANNER_REASONS_INVALID",
  "MEDIA_SCANNER_TIMESTAMP_INVALID",
];

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

export type DirectUploadFinalizeResult = {
  session: DirectUploadSession;
  assetId: string;
  perceptionJob: {
    id: string;
    status: string;
    attempt: number;
    maxAttempts: number;
    availableAt: string;
  };
};

export interface DirectUploadSessionStore {
  create(input: {
    id: string; actorId: string; quarantinePath: string; filename: string;
    declaredMediaType: string; modality: DirectUploadSession["modality"];
    expectedByteLength: number; privacyClass: UniversalUploadPrivacyClass;
    intent?: string; expiresAt: string;
  }): Promise<DirectUploadSession>;
  get(actorId: string, sessionId: string): Promise<DirectUploadSession | undefined>;
  claimFinalize(input: { actorId: string; sessionId: string; workerId: string; leaseMs: number }): Promise<DirectUploadSession | undefined>;
  renewFinalizeLease(input: { actorId: string; sessionId: string; workerId: string; leaseToken: string; leaseMs: number }): Promise<DirectUploadSession | undefined>;
  recordScan(input: { actorId: string; sessionId: string; workerId: string; leaseToken: string; sha256: string; scannedAt: string }): Promise<DirectUploadSession | undefined>;
  complete(input: { actorId: string; sessionId: string; workerId: string; leaseToken: string; assetId: string; perceptionJobId: string }): Promise<DirectUploadSession | undefined>;
  reject(input: { actorId: string; sessionId: string; workerId: string; leaseToken: string; error: string }): Promise<DirectUploadSession | undefined>;
  release(input: { actorId: string; sessionId: string; workerId: string; leaseToken: string; error: string }): Promise<DirectUploadSession | undefined>;
}

export interface DirectUploadObjectStore {
  issue(input: { actorId: string; sessionId: string; filename: string }): Promise<DirectUploadGrant>;
  inspect(quarantinePath: string): Promise<DirectUploadObjectInfo | undefined>;
  scanUri(path: string): Promise<string>;
}

export interface DirectUploadPromotionStore {
  promote(input: { actorId: string; quarantineHandle: string; filename: string }): Promise<{ assetRef: string }>;
}

export class DirectUploadRuntime {
  constructor(
    private readonly scanner: MediaSecurityScanner,
    private readonly sessions: DirectUploadSessionStore,
    private readonly directObjects: DirectUploadObjectStore,
    private readonly promotion: DirectUploadPromotionStore,
    private readonly registry: GovernedAssetRegistry,
    private readonly jobs: PerceptionJobRepository,
    private readonly scannerPrivacyCeiling: UniversalUploadPrivacyClass = "sensitive",
    private readonly now: () => Date = () => new Date(),
    private readonly id: () => string = () => randomUUID(),
    private readonly finalizeLeaseMs = DEFAULT_FINALIZE_LEASE_MS,
    private readonly maxPerceptionAttempts = 4,
  ) {}

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

  async finalize(input: {
    actorId: string;
    sessionId: string;
  }): Promise<DirectUploadFinalizeResult> {
    const existing = await this.sessions.get(input.actorId, input.sessionId);
    if (!existing) throw new Error("DIRECT_UPLOAD_SESSION_NOT_FOUND");
    if (existing.status === "finalized") return this.finalized(existing);
    if (existing.status === "rejected") throw new Error(`DIRECT_UPLOAD_SESSION_REJECTED:${existing.lastError ?? "rejected"}`);
    if (existing.status === "expired") throw new Error("DIRECT_UPLOAD_SESSION_EXPIRED");

    const workerId = `direct-finalize:${this.id()}`;
    const claimed = await this.sessions.claimFinalize({
      actorId: input.actorId,
      sessionId: input.sessionId,
      workerId,
      leaseMs: this.finalizeLeaseMs,
    });
    if (!claimed?.finalizeLeaseToken) {
      const current = await this.sessions.get(input.actorId, input.sessionId);
      if (current?.status === "finalized") return this.finalized(current);
      if (current?.status === "expired") throw new Error("DIRECT_UPLOAD_SESSION_EXPIRED");
      throw new Error("DIRECT_UPLOAD_FINALIZE_BUSY");
    }

    const leaseToken = claimed.finalizeLeaseToken;
    const heartbeat = this.startHeartbeat(claimed, workerId, leaseToken);

    try {
      let scanSha256 = claimed.scanSha256;
      if (!scanSha256) {
        if (PRIVACY_RANK[claimed.privacyClass] > PRIVACY_RANK[this.scannerPrivacyCeiling]) {
          throw new Error("DIRECT_UPLOAD_SCANNER_PRIVACY_INCOMPATIBLE");
        }
        const object = await this.directObjects.inspect(claimed.quarantinePath);
        if (!object) throw new Error("DIRECT_UPLOAD_OBJECT_NOT_FOUND");
        if (object.sizeBytes !== claimed.expectedByteLength) {
          throw new Error("DIRECT_UPLOAD_SIZE_MISMATCH");
        }
        if (object.mediaType !== claimed.declaredMediaType) {
          throw new Error("DIRECT_UPLOAD_MIME_MISMATCH");
        }

        const uri = await this.directObjects.scanUri(claimed.quarantinePath);
        const scan = await this.scanner.scan({
          assetId: `upload-session:${claimed.id}`,
          uri,
          mimeType: claimed.declaredMediaType,
          sizeBytes: claimed.expectedByteLength,
        });
        assertSafeMedia(scan);
        const recorded = await this.sessions.recordScan({
          actorId: claimed.actorId,
          sessionId: claimed.id,
          workerId,
          leaseToken,
          sha256: scan.sha256,
          scannedAt: scan.scannedAt,
        });
        if (!recorded) throw new Error("DIRECT_UPLOAD_FINALIZE_LEASE_LOST");
        scanSha256 = scan.sha256;
      }

      if (heartbeat.lost()) throw new Error("DIRECT_UPLOAD_FINALIZE_LEASE_LOST");

      const promoted = await this.promotion.promote({
        actorId: claimed.actorId,
        quarantineHandle: claimed.quarantinePath,
        filename: claimed.filename,
      });
      const asset = await this.registry.register({
        actorId: claimed.actorId,
        modality: claimed.modality,
        mediaType: claimed.declaredMediaType,
        storageRef: promoted.assetRef,
        filename: claimed.filename,
        byteLength: claimed.expectedByteLength,
        contentSha256: scanSha256,
        privacyClass: claimed.privacyClass,
      });
      const job = await this.jobs.enqueue({
        id: perceptionJobId(asset.actorId, asset.id),
        actorId: asset.actorId,
        assetId: asset.id,
        intent: claimed.intent,
        maxAttempts: this.maxPerceptionAttempts,
      });

      if (heartbeat.lost()) throw new Error("DIRECT_UPLOAD_FINALIZE_LEASE_LOST");

      const completed = await this.sessions.complete({
        actorId: claimed.actorId,
        sessionId: claimed.id,
        workerId,
        leaseToken,
        assetId: asset.id,
        perceptionJobId: job.id,
      });
      if (!completed) throw new Error("DIRECT_UPLOAD_FINALIZE_LEASE_LOST");

      return Object.freeze({
        session: completed,
        assetId: asset.id,
        perceptionJob: Object.freeze({
          id: job.id,
          status: job.status,
          attempt: job.attempt,
          maxAttempts: job.maxAttempts,
          availableAt: job.availableAt,
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!heartbeat.lost() && message !== "DIRECT_UPLOAD_FINALIZE_LEASE_LOST") {
        if (TERMINAL_FINALIZE_ERRORS.some((marker) => message.includes(marker))) {
          await this.sessions.reject({
            actorId: claimed.actorId,
            sessionId: claimed.id,
            workerId,
            leaseToken,
            error: message,
          }).catch(() => undefined);
        } else {
          await this.sessions.release({
            actorId: claimed.actorId,
            sessionId: claimed.id,
            workerId,
            leaseToken,
            error: message,
          }).catch(() => undefined);
        }
      }
      throw error;
    } finally {
      heartbeat.stop();
    }
  }

  private async finalized(session: DirectUploadSession): Promise<DirectUploadFinalizeResult> {
    if (!session.assetId || !session.perceptionJobId) {
      throw new Error("DIRECT_UPLOAD_FINALIZED_STATE_INVALID");
    }
    const job = await this.jobs.get(session.actorId, session.perceptionJobId);
    if (!job) throw new Error("DIRECT_UPLOAD_PERCEPTION_JOB_NOT_FOUND");
    return Object.freeze({
      session,
      assetId: session.assetId,
      perceptionJob: Object.freeze({
        id: job.id,
        status: job.status,
        attempt: job.attempt,
        maxAttempts: job.maxAttempts,
        availableAt: job.availableAt,
      }),
    });
  }

  private startHeartbeat(
    session: DirectUploadSession,
    workerId: string,
    leaseToken: string,
  ): { stop: () => void; lost: () => boolean } {
    let lost = false;
    const timer = setInterval(() => {
      void this.sessions.renewFinalizeLease({
        actorId: session.actorId,
        sessionId: session.id,
        workerId,
        leaseToken,
        leaseMs: this.finalizeLeaseMs,
      }).then((renewed) => {
        if (!renewed) lost = true;
      }).catch(() => {
        lost = true;
      });
    }, Math.max(1000, Math.floor(this.finalizeLeaseMs / 3)));

    return {
      stop: () => clearInterval(timer),
      lost: () => lost,
    };
  }
}

export function createProductionDirectUploadRuntime(): DirectUploadRuntime {
  const client = createServiceRoleClient();
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!client || !projectUrl) throw new Error("DIRECT_UPLOAD_RUNTIME_SUPABASE_UNAVAILABLE");

  const scannerUrl = process.env.JHADINA_MEDIA_SCANNER_URL;
  if (!scannerUrl) throw new Error("DIRECT_UPLOAD_RUNTIME_MEDIA_SCANNER_UNAVAILABLE");

  const ceilingRaw = process.env.JHADINA_MEDIA_SCANNER_PRIVACY_CEILING;
  const scannerPrivacyCeiling: UniversalUploadPrivacyClass =
    ceilingRaw === "internal" || ceilingRaw === "sensitive" || ceilingRaw === "restricted"
      ? ceilingRaw
      : "sensitive";
  const maxAttemptsRaw = Number(process.env.JHADINA_PERCEPTION_MAX_ATTEMPTS ?? "4");
  const maxAttempts =
    Number.isInteger(maxAttemptsRaw) && maxAttemptsRaw >= 1 && maxAttemptsRaw <= 20
      ? maxAttemptsRaw
      : 4;

  return new DirectUploadRuntime(
    new HttpMediaSecurityScanner(
      scannerUrl,
      process.env.JHADINA_MEDIA_SCANNER_TOKEN || undefined,
    ),
    new SupabaseDirectUploadSessionRepository(client),
    new SupabaseDirectUploadObjectStore(client, projectUrl),
    new SupabaseUniversalUploadObjectStore(client),
    new GovernedAssetRegistry(new SupabaseIntelligenceAssetStore(client)),
    new SupabasePerceptionJobRepository(client),
    scannerPrivacyCeiling,
    () => new Date(),
    () => randomUUID(),
    DEFAULT_FINALIZE_LEASE_MS,
    maxAttempts,
  );
}
