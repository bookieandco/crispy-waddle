import {
  AudioPerceptionExtractor,
  CodePerceptionExtractor,
  DocumentPerceptionExtractor,
  GovernedMediaPipeline,
  GovernedPerceptionExtractionRouter,
  GovernedSubsystemDispatcher,
  GovernedUniversalIntakeRouter,
  ImagePerceptionExtractor,
  TextPerceptionExtractor,
  VideoPerceptionExtractor,
  type MediaExtractionBackend,
} from "@jhadina/intelligence-core";
import { createServiceRoleClient } from "../supabase/service-role";
import { CompositeMediaExtractionBackend, FfmpegStructuralPerceptionBackend } from "./ffmpeg-structural-perception";
import { PerceptionJobWorker } from "./perception-job-worker";
import { createProductionSubsystemRegistry } from "./production-subsystem-registry";
import { HttpSemanticPerceptionBackend } from "./production-perception-worker";
import { SupabaseIntelligenceAssetStore } from "./supabase-intelligence-asset-store";
import { SupabasePerceptionJobRepository } from "./supabase-perception-job-repository";
import { SupabaseTrustedAssetReadResolver } from "./trusted-asset-read-resolver";
import type { UniversalUploadPrivacyClass } from "./production-universal-upload-runtime";

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

export function createProductionPerceptionJobWorker(input: {
  workerId: string;
  leaseMs?: number;
}): PerceptionJobWorker {
  const client = createServiceRoleClient();
  if (!client) throw new Error("PERCEPTION_RUNTIME_SUPABASE_UNAVAILABLE");

  const perceptionWorkerUrl = process.env.JHADINA_PERCEPTION_WORKER_URL;
  if (!perceptionWorkerUrl) throw new Error("PERCEPTION_RUNTIME_WORKER_UNAVAILABLE");

  const ceilingRaw = process.env.JHADINA_PERCEPTION_WORKER_PRIVACY_CEILING;
  const privacyCeiling: UniversalUploadPrivacyClass =
    ceilingRaw === "internal" || ceilingRaw === "sensitive" || ceilingRaw === "restricted"
      ? ceilingRaw
      : "sensitive";

  const trustedAssets = new SupabaseTrustedAssetReadResolver(client);
  const semantic = new HttpSemanticPerceptionBackend(
    perceptionWorkerUrl,
    trustedAssets,
    process.env.JHADINA_PERCEPTION_WORKER_TOKEN || undefined,
    privacyCeiling,
  );

  const backend: MediaExtractionBackend =
    process.env.JHADINA_LOCAL_FFMPEG_ENABLED === "true"
      ? new CompositeMediaExtractionBackend([
          new FfmpegStructuralPerceptionBackend(trustedAssets),
          semantic,
        ])
      : semantic;

  const media = new GovernedMediaPipeline(
    new GovernedPerceptionExtractionRouter(createProductionExtractors(backend)),
    new GovernedUniversalIntakeRouter(),
  );
  const registry = createProductionSubsystemRegistry(client);

  return new PerceptionJobWorker(
    new SupabasePerceptionJobRepository(client),
    new SupabaseIntelligenceAssetStore(client),
    media,
    new GovernedSubsystemDispatcher(registry.adapters),
    input.workerId,
    input.leaseMs ?? 60_000,
  );
}
