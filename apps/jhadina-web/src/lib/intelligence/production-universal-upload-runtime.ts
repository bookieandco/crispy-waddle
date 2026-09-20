import { createHash } from "node:crypto";
import type { MediaSecurityScanner, MediaScanResult } from "@jhadina/security-core";
import { assertSafeMedia } from "@jhadina/security-core";
import {
  GovernedAssetRegistry,
  perceptionJobId,
  type IntakeModality,
  type PerceptionJob,
  type PerceptionJobRepository,
  type RegisteredIntelligenceAsset,
} from "@jhadina/intelligence-core";
import { createServiceRoleClient } from "../supabase/service-role";
import { HttpMediaSecurityScanner } from "./http-media-security-scanner";
import { SupabaseIntelligenceAssetStore } from "./supabase-intelligence-asset-store";
import { SupabasePerceptionJobRepository } from "./supabase-perception-job-repository";
import {
  SupabaseUniversalUploadObjectStore,
  type UniversalUploadObjectStore,
} from "./supabase-universal-upload-store";
import { validateUniversalUpload } from "./universal-upload-validation";

export type UniversalUploadPrivacyClass = "internal" | "sensitive" | "restricted";

export type UniversalUploadInput = {
  actorId: string;
  filename: string;
  declaredMediaType: string;
  bytes: Uint8Array;
  privacyClass: UniversalUploadPrivacyClass;
  intent?: string;
};

export type UniversalUploadResult = {
  asset: RegisteredIntelligenceAsset;
  scan: Pick<MediaScanResult, "sha256" | "verdict" | "scannedAt">;
  job: PerceptionJob;
};

const PRIVACY_RANK: Record<UniversalUploadPrivacyClass, number> = {
  internal: 1,
  sensitive: 2,
  restricted: 3,
};

export class UniversalUploadRuntime {
  constructor(
    private readonly scanner: MediaSecurityScanner,
    private readonly objects: UniversalUploadObjectStore,
    private readonly registry: GovernedAssetRegistry,
    private readonly jobs: PerceptionJobRepository,
    private readonly scannerPrivacyCeiling: UniversalUploadPrivacyClass = "sensitive",
    private readonly maxAttempts = 4,
  ) {
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
      throw new Error("UPLOAD_PERCEPTION_MAX_ATTEMPTS_INVALID");
    }
  }

  async ingest(input: UniversalUploadInput): Promise<UniversalUploadResult> {
    if (!input.actorId.trim()) throw new Error("UPLOAD_ACTOR_REQUIRED");
    if (!input.filename.trim()) throw new Error("UPLOAD_FILENAME_REQUIRED");
    if (PRIVACY_RANK[input.privacyClass] > PRIVACY_RANK[this.scannerPrivacyCeiling]) {
      throw new Error("UPLOAD_SCANNER_PRIVACY_INCOMPATIBLE");
    }

    const validated = validateUniversalUpload({
      declaredMediaType: input.declaredMediaType,
      bytes: input.bytes,
    });
    const sha256 = createHash("sha256").update(input.bytes).digest("hex");

    const quarantined = await this.objects.putQuarantine({
      actorId: input.actorId,
      filename: input.filename,
      mediaType: validated.mediaType,
      bytes: input.bytes,
    });

    const scanAssetId = `quarantine:${sha256.slice(0, 24)}`;
    const scan = await this.scanner.scan({
      assetId: scanAssetId,
      uri: quarantined.scanUri,
      mimeType: validated.mediaType,
      sizeBytes: input.bytes.byteLength,
    });
    if (scan.sha256.toLowerCase() !== sha256) {
      throw new Error("MEDIA_SCANNER_CONTENT_HASH_MISMATCH");
    }
    assertSafeMedia(scan);

    const promoted = await this.objects.promote({
      actorId: input.actorId,
      quarantineHandle: quarantined.handle,
      filename: input.filename,
    });

    const asset = await this.registry.register({
      actorId: input.actorId,
      modality: validated.modality,
      mediaType: validated.mediaType,
      storageRef: promoted.assetRef,
      filename: input.filename,
      byteLength: input.bytes.byteLength,
      contentSha256: sha256,
      privacyClass: input.privacyClass,
    });

    const job = await this.jobs.enqueue({
      id: perceptionJobId(asset.actorId, asset.id),
      actorId: asset.actorId,
      assetId: asset.id,
      intent: input.intent,
      maxAttempts: this.maxAttempts,
    });

    return Object.freeze({
      asset,
      scan: Object.freeze({
        sha256: scan.sha256,
        verdict: scan.verdict,
        scannedAt: scan.scannedAt,
      }),
      job,
    });
  }
}

export function createProductionUniversalUploadRuntime(): UniversalUploadRuntime {
  const client = createServiceRoleClient();
  if (!client) throw new Error("UPLOAD_RUNTIME_SUPABASE_UNAVAILABLE");

  const scannerUrl = process.env.JHADINA_MEDIA_SCANNER_URL;
  if (!scannerUrl) throw new Error("UPLOAD_RUNTIME_MEDIA_SCANNER_UNAVAILABLE");

  const scanner = new HttpMediaSecurityScanner(
    scannerUrl,
    process.env.JHADINA_MEDIA_SCANNER_TOKEN || undefined,
  );
  const configuredCeiling = process.env.JHADINA_MEDIA_SCANNER_PRIVACY_CEILING;
  const scannerPrivacyCeiling: UniversalUploadPrivacyClass =
    configuredCeiling === "internal" ||
    configuredCeiling === "sensitive" ||
    configuredCeiling === "restricted"
      ? configuredCeiling
      : "sensitive";

  const maxAttemptsRaw = Number(process.env.JHADINA_PERCEPTION_MAX_ATTEMPTS ?? "4");
  const maxAttempts =
    Number.isInteger(maxAttemptsRaw) && maxAttemptsRaw >= 1 && maxAttemptsRaw <= 20
      ? maxAttemptsRaw
      : 4;

  return new UniversalUploadRuntime(
    scanner,
    new SupabaseUniversalUploadObjectStore(client),
    new GovernedAssetRegistry(new SupabaseIntelligenceAssetStore(client)),
    new SupabasePerceptionJobRepository(client),
    scannerPrivacyCeiling,
    maxAttempts,
  );
}

export const UNIVERSAL_UPLOAD_SUPPORTED_MODALITIES: readonly IntakeModality[] =
  Object.freeze(["image", "audio", "video", "document", "text", "code"]);
