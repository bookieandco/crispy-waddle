import type { MediaSecurityScanner } from "@jhadina/security-core";
import { assertSafeMedia } from "@jhadina/security-core";
import {
  GovernedAssetRegistry,
  perceptionJobId,
  retryDelayMs,
  type PerceptionJobRepository,
} from "@jhadina/intelligence-core";
import type {
  DirectUploadSession,
  SupabaseDirectUploadSessionRepository,
} from "./supabase-direct-upload-session-repository";
import type {
  DirectUploadObjectInfo,
  SupabaseDirectUploadObjectStore,
} from "./supabase-direct-upload-object-store";
import type { SupabaseUniversalUploadObjectStore } from "./supabase-universal-upload-store";
import type { UniversalUploadPrivacyClass } from "./production-universal-upload-runtime";
import type { QuarantineCleanupReceiptStore } from "./supabase-quarantine-cleanup-repository";

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
  "DIRECT_UPLOAD_SCANNER_PRIVACY_INCOMPATIBLE",
  "MEDIA_SECURITY_",
  "MEDIA_SCANNER_ASSET_MISMATCH",
  "MEDIA_SCANNER_MIME_MISMATCH",
  "MEDIA_SCANNER_SIZE_MISMATCH",
  "MEDIA_SCANNER_SHA256_INVALID",
  "MEDIA_SCANNER_VERDICT_INVALID",
  "MEDIA_SCANNER_REASONS_INVALID",
  "MEDIA_SCANNER_TIMESTAMP_INVALID",
  "INTELLIGENCE_ASSET_ID_CONFLICT",
];

export type DirectUploadFinalizeOutcome =
  | { state: "idle" }
  | { state: "finalized"; session: DirectUploadSession }
  | { state: "retry_wait"; session: DirectUploadSession }
  | { state: "rejected"; session: DirectUploadSession }
  | { state: "lease_lost"; session: DirectUploadSession };

export type DirectUploadCleanupOutcome =
  | { state: "idle" }
  | { state: "cleaned"; session: DirectUploadSession }
  | { state: "retry_wait"; session: DirectUploadSession }
  | { state: "lease_lost"; session: DirectUploadSession };

export type DirectUploadOrphanCleanupOutcome =
  | { state: "idle" }
  | { state: "cleaned"; objectPath: string }
  | { state: "failed"; objectPath: string; error: string };

export interface DirectUploadFinalizeSessionStore {
  claimNextFinalize(workerId: string, leaseMs: number): Promise<DirectUploadSession | undefined>;
  renewFinalizeLease(input: {
    actorId: string; sessionId: string; workerId: string; leaseToken: string; leaseMs: number;
  }): Promise<DirectUploadSession | undefined>;
  recordScan(input: {
    actorId: string; sessionId: string; workerId: string; leaseToken: string;
    sha256: string; scannedAt: string;
  }): Promise<DirectUploadSession | undefined>;
  complete(input: {
    actorId: string; sessionId: string; workerId: string; leaseToken: string;
    assetId: string; perceptionJobId: string;
  }): Promise<DirectUploadSession | undefined>;
  retryFinalize(input: {
    actorId: string; sessionId: string; workerId: string; leaseToken: string;
    error: string; availableAt: string;
  }): Promise<DirectUploadSession | undefined>;
  reject(input: {
    actorId: string; sessionId: string; workerId: string; leaseToken: string; error: string;
  }): Promise<DirectUploadSession | undefined>;
  claimNextCleanup(workerId: string, leaseMs: number): Promise<DirectUploadSession | undefined>;
  completeCleanup(input: {
    actorId: string; sessionId: string; workerId: string; leaseToken: string;
  }): Promise<DirectUploadSession | undefined>;
  retryCleanup(input: {
    actorId: string; sessionId: string; workerId: string; leaseToken: string;
    error: string; availableAt: string;
  }): Promise<DirectUploadSession | undefined>;
}

export interface DirectUploadFinalizeObjectStore {
  inspect(path: string): Promise<DirectUploadObjectInfo | undefined>;
  scanUri(path: string): Promise<string>;
  removeQuarantine(path: string): Promise<void>;
}

export interface DirectUploadPromotionStore {
  promote(input: {
    actorId: string;
    quarantineHandle: string;
    filename: string;
  }): Promise<{ assetRef: string }>;
}

function isTerminalFinalizeError(message: string): boolean {
  return TERMINAL_FINALIZE_ERRORS.some((marker) => message.includes(marker));
}

export class DirectUploadFinalizationWorker {
  constructor(
    private readonly scanner: MediaSecurityScanner,
    private readonly sessions: DirectUploadFinalizeSessionStore,
    private readonly objects: DirectUploadFinalizeObjectStore,
    private readonly promotion: DirectUploadPromotionStore,
    private readonly registry: GovernedAssetRegistry,
    private readonly jobs: PerceptionJobRepository,
    private readonly workerId: string,
    private readonly scannerPrivacyCeiling: UniversalUploadPrivacyClass = "sensitive",
    private readonly leaseMs = 5 * 60_000,
    private readonly now: () => Date = () => new Date(),
    private readonly maxPerceptionAttempts = 4,
    private readonly cleanupReceipts?: QuarantineCleanupReceiptStore,
  ) {
    if (!workerId.trim()) throw new Error("DIRECT_UPLOAD_WORKER_ID_REQUIRED");
    if (!Number.isInteger(leaseMs) || leaseMs < 5000) {
      throw new Error("DIRECT_UPLOAD_FINALIZE_LEASE_INVALID");
    }
  }

  async runFinalizeNext(): Promise<DirectUploadFinalizeOutcome> {
    const claimed = await this.sessions.claimNextFinalize(this.workerId, this.leaseMs);
    if (!claimed) return { state: "idle" };
    if (!claimed.finalizeLeaseToken) {
      throw new Error("DIRECT_UPLOAD_FINALIZE_CLAIM_MISSING_LEASE");
    }

    const leaseToken = claimed.finalizeLeaseToken;
    const heartbeat = this.startFinalizeHeartbeat(claimed, leaseToken);

    try {
      let scanSha256 = claimed.scanSha256;
      if (!scanSha256) {
        if (
          PRIVACY_RANK[claimed.privacyClass] >
          PRIVACY_RANK[this.scannerPrivacyCeiling]
        ) {
          throw new Error("DIRECT_UPLOAD_SCANNER_PRIVACY_INCOMPATIBLE");
        }

        const object = await this.objects.inspect(claimed.quarantinePath);
        if (!object) throw new Error("DIRECT_UPLOAD_OBJECT_NOT_FOUND");
        this.assertObjectMatches(claimed, object);

        const uri = await this.objects.scanUri(claimed.quarantinePath);
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
          workerId: this.workerId,
          leaseToken,
          sha256: scan.sha256,
          scannedAt: scan.scannedAt,
        });
        if (!recorded) return { state: "lease_lost", session: claimed };
        scanSha256 = scan.sha256;
      }

      if (heartbeat.lost()) return { state: "lease_lost", session: claimed };

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

      if (heartbeat.lost()) return { state: "lease_lost", session: claimed };

      const completed = await this.sessions.complete({
        actorId: claimed.actorId,
        sessionId: claimed.id,
        workerId: this.workerId,
        leaseToken,
        assetId: asset.id,
        perceptionJobId: job.id,
      });
      if (!completed) return { state: "lease_lost", session: claimed };
      return { state: "finalized", session: completed };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (heartbeat.lost()) return { state: "lease_lost", session: claimed };

      if (isTerminalFinalizeError(message)) {
        const rejected = await this.sessions.reject({
          actorId: claimed.actorId,
          sessionId: claimed.id,
          workerId: this.workerId,
          leaseToken,
          error: message,
        });
        if (!rejected) return { state: "lease_lost", session: claimed };
        return { state: "rejected", session: rejected };
      }

      const availableAt = new Date(
        this.now().getTime() + retryDelayMs(Math.max(1, claimed.finalizeAttempt)),
      ).toISOString();
      const retried = await this.sessions.retryFinalize({
        actorId: claimed.actorId,
        sessionId: claimed.id,
        workerId: this.workerId,
        leaseToken,
        error: message,
        availableAt,
      });
      if (!retried) return { state: "lease_lost", session: claimed };
      return {
        state: retried.status === "rejected" ? "rejected" : "retry_wait",
        session: retried,
      };
    } finally {
      heartbeat.stop();
    }
  }

  async runCleanupNext(): Promise<DirectUploadCleanupOutcome> {
    const claimed = await this.sessions.claimNextCleanup(this.workerId, this.leaseMs);
    if (!claimed) return { state: "idle" };
    if (!claimed.cleanupLeaseToken) {
      throw new Error("DIRECT_UPLOAD_CLEANUP_CLAIM_MISSING_LEASE");
    }

    try {
      await this.objects.removeQuarantine(claimed.quarantinePath);
      await this.cleanupReceipts?.record({
        objectPath: claimed.quarantinePath,
        reason: "session_terminal",
        sessionId: claimed.id,
      });
      const completed = await this.sessions.completeCleanup({
        actorId: claimed.actorId,
        sessionId: claimed.id,
        workerId: this.workerId,
        leaseToken: claimed.cleanupLeaseToken,
      });
      if (!completed) return { state: "lease_lost", session: claimed };
      return { state: "cleaned", session: completed };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const availableAt = new Date(
        this.now().getTime() + retryDelayMs(Math.max(1, claimed.cleanupAttempt)),
      ).toISOString();
      const retried = await this.sessions.retryCleanup({
        actorId: claimed.actorId,
        sessionId: claimed.id,
        workerId: this.workerId,
        leaseToken: claimed.cleanupLeaseToken,
        error: message,
        availableAt,
      });
      if (!retried) return { state: "lease_lost", session: claimed };
      return { state: "retry_wait", session: retried };
    }
  }

  async runOrphanCleanupNext(): Promise<DirectUploadOrphanCleanupOutcome> {
    if (!this.cleanupReceipts) return { state: "idle" };
    const candidates = await this.cleanupReceipts.listOrphans(1);
    const objectPath = candidates[0];
    if (!objectPath) return { state: "idle" };

    try {
      await this.objects.removeQuarantine(objectPath);
      await this.cleanupReceipts.record({
        objectPath,
        reason: "orphan",
      });
      return { state: "cleaned", objectPath };
    } catch (error) {
      return {
        state: "failed",
        objectPath,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private assertObjectMatches(
    session: DirectUploadSession,
    object: DirectUploadObjectInfo,
  ): void {
    if (object.sizeBytes !== session.expectedByteLength) {
      throw new Error("DIRECT_UPLOAD_SIZE_MISMATCH");
    }
    if (object.mediaType !== session.declaredMediaType) {
      throw new Error("DIRECT_UPLOAD_MIME_MISMATCH");
    }
  }

  private startFinalizeHeartbeat(
    session: DirectUploadSession,
    leaseToken: string,
  ): { stop: () => void; lost: () => boolean } {
    let lost = false;
    const timer = setInterval(() => {
      void this.sessions.renewFinalizeLease({
        actorId: session.actorId,
        sessionId: session.id,
        workerId: this.workerId,
        leaseToken,
        leaseMs: this.leaseMs,
      }).then((renewed) => {
        if (!renewed) lost = true;
      }).catch(() => {
        lost = true;
      });
    }, Math.max(1000, Math.floor(this.leaseMs / 3)));

    return {
      stop: () => clearInterval(timer),
      lost: () => lost,
    };
  }
}
