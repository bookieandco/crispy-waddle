import { createHash } from "node:crypto";
import type { MediaSecurityScanner, MediaScanResult } from "@jhadina/security-core";
import { assertSafeMedia } from "@jhadina/security-core";
import {
  AudioPerceptionExtractor,
  CodePerceptionExtractor,
  DocumentPerceptionExtractor,
  GovernedAssetRegistry,
  GovernedMediaPipeline,
  GovernedPerceptionExtractionRouter,
  GovernedSubsystemDispatcher,
  GovernedUniversalIntakeRouter,
  ImagePerceptionExtractor,
  TextPerceptionExtractor,
  VideoPerceptionExtractor,
  type AssetIntelligencePacket,
  type IntakeModality,
  type MediaExtractionBackend,
  type RegisteredIntelligenceAsset,
  type SubsystemDispatchResult,
  type SubsystemIntelligenceAdapter,
} from "@jhadina/intelligence-core";
import { createServiceRoleClient } from "../supabase/service-role";
import { HttpMediaSecurityScanner } from "./http-media-security-scanner";
import { SupabaseIntelligenceAssetStore } from "./supabase-intelligence-asset-store";
import { createProductionSubsystemRegistry } from "./production-subsystem-registry";
import { SupabaseTrustedAssetReadResolver } from "./trusted-asset-read-resolver";
import { HttpSemanticPerceptionBackend } from "./production-perception-worker";
import {
  CompositeMediaExtractionBackend,
  FfmpegStructuralPerceptionBackend,
} from "./ffmpeg-structural-perception";
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
  packet: AssetIntelligencePacket;
  dispatch: SubsystemDispatchResult;
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
    private readonly media: GovernedMediaPipeline,
    private readonly dispatcher: GovernedSubsystemDispatcher,
    private readonly scannerPrivacyCeiling: UniversalUploadPrivacyClass = "sensitive",
  ) {}

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
    if (scan.sha256.toLowerCase() !== sha256) throw new Error("MEDIA_SCANNER_CONTENT_HASH_MISMATCH");
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

    const packet = await this.media.process({ asset, intent: input.intent });
    const dispatch = await this.dispatcher.dispatch(packet, input.intent);

    return Object.freeze({
      asset,
      scan: Object.freeze({ sha256: scan.sha256, verdict: scan.verdict, scannedAt: scan.scannedAt }),
      packet,
      dispatch,
    });
  }
}

function createProductionExtractors(backend: MediaExtractionBackend) {
  return [
    new VideoPerceptionExtractor(backend),
    new AudioPerceptionExtractor(backend),
    new ImagePerceptionExtractor(backend),
    new DocumentPerceptionExtractor(backend),
    new TextPerceptionExtractor(backend),
    new CodePerceptionExtractor(backend),
  ];
}

export function createProductionUniversalUploadRuntime(input: {
  subsystemAdapters?: readonly SubsystemIntelligenceAdapter[];
} = {}): UniversalUploadRuntime {
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
    configuredCeiling === "internal" || configuredCeiling === "sensitive" || configuredCeiling === "restricted"
      ? configuredCeiling
      : "sensitive";
  const perceptionWorkerUrl = process.env.JHADINA_PERCEPTION_WORKER_URL;
  if (!perceptionWorkerUrl) throw new Error("UPLOAD_RUNTIME_PERCEPTION_WORKER_UNAVAILABLE");
  const perceptionCeilingRaw = process.env.JHADINA_PERCEPTION_WORKER_PRIVACY_CEILING;
  const perceptionPrivacyCeiling: UniversalUploadPrivacyClass =
    perceptionCeilingRaw === "internal" || perceptionCeilingRaw === "sensitive" || perceptionCeilingRaw === "restricted"
      ? perceptionCeilingRaw
      : "sensitive";

  const objects = new SupabaseUniversalUploadObjectStore(client);
  const registry = new GovernedAssetRegistry(new SupabaseIntelligenceAssetStore(client));
  const trustedAssets = new SupabaseTrustedAssetReadResolver(client);
  const semanticBackend = new HttpSemanticPerceptionBackend(
    perceptionWorkerUrl,
    trustedAssets,
    process.env.JHADINA_PERCEPTION_WORKER_TOKEN || undefined,
    perceptionPrivacyCeiling,
  );
  const backend: MediaExtractionBackend =
    process.env.JHADINA_LOCAL_FFMPEG_ENABLED === "true"
      ? new CompositeMediaExtractionBackend([
          new FfmpegStructuralPerceptionBackend(trustedAssets),
          semanticBackend,
        ])
      : semanticBackend;
  const perception = new GovernedPerceptionExtractionRouter(createProductionExtractors(backend));
  const media = new GovernedMediaPipeline(perception, new GovernedUniversalIntakeRouter());
  const subsystemAdapters =
    input.subsystemAdapters ?? createProductionSubsystemRegistry(client).adapters;
  const dispatcher = new GovernedSubsystemDispatcher(subsystemAdapters);

  return new UniversalUploadRuntime(scanner, objects, registry, media, dispatcher, scannerPrivacyCeiling);
}

export const UNIVERSAL_UPLOAD_SUPPORTED_MODALITIES: readonly IntakeModality[] =
  Object.freeze(["image", "audio", "video", "document", "text", "code"]);
