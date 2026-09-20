import { createServiceRoleClient } from "../supabase/service-role";
import { HttpMediaSecurityScanner } from "./http-media-security-scanner";
import { DirectUploadFinalizationWorker } from "./direct-upload-finalization-worker";
import { SupabaseDirectUploadSessionRepository } from "./supabase-direct-upload-session-repository";
import { SupabaseDirectUploadObjectStore } from "./supabase-direct-upload-object-store";
import { SupabaseUniversalUploadObjectStore } from "./supabase-universal-upload-store";
import { SupabaseIntelligenceAssetStore } from "./supabase-intelligence-asset-store";
import { SupabasePerceptionJobRepository } from "./supabase-perception-job-repository";
import { GovernedAssetRegistry } from "@jhadina/intelligence-core";
import type { UniversalUploadPrivacyClass } from "./production-universal-upload-runtime";
import { SupabaseQuarantineCleanupRepository } from "./supabase-quarantine-cleanup-repository";

export function createProductionDirectUploadFinalizationWorker(input: {
  workerId: string;
  leaseMs?: number;
}): DirectUploadFinalizationWorker {
  const client = createServiceRoleClient();
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!client || !projectUrl) throw new Error("DIRECT_UPLOAD_WORKER_SUPABASE_UNAVAILABLE");

  const scannerUrl = process.env.JHADINA_MEDIA_SCANNER_URL;
  if (!scannerUrl) throw new Error("DIRECT_UPLOAD_WORKER_SCANNER_UNAVAILABLE");

  const ceilingRaw = process.env.JHADINA_MEDIA_SCANNER_PRIVACY_CEILING;
  const scannerPrivacyCeiling: UniversalUploadPrivacyClass =
    ceilingRaw === "internal" || ceilingRaw === "sensitive" || ceilingRaw === "restricted"
      ? ceilingRaw
      : "sensitive";

  const maxPerceptionAttemptsRaw = Number(
    process.env.JHADINA_PERCEPTION_MAX_ATTEMPTS ?? "4",
  );
  const maxPerceptionAttempts =
    Number.isInteger(maxPerceptionAttemptsRaw) &&
    maxPerceptionAttemptsRaw >= 1 &&
    maxPerceptionAttemptsRaw <= 20
      ? maxPerceptionAttemptsRaw
      : 4;

  return new DirectUploadFinalizationWorker(
    new HttpMediaSecurityScanner(
      scannerUrl,
      process.env.JHADINA_MEDIA_SCANNER_TOKEN || undefined,
    ),
    new SupabaseDirectUploadSessionRepository(client),
    new SupabaseDirectUploadObjectStore(client, projectUrl),
    new SupabaseUniversalUploadObjectStore(client),
    new GovernedAssetRegistry(new SupabaseIntelligenceAssetStore(client)),
    new SupabasePerceptionJobRepository(client),
    input.workerId,
    scannerPrivacyCeiling,
    input.leaseMs ?? 5 * 60_000,
    () => new Date(),
    maxPerceptionAttempts,
    new SupabaseQuarantineCleanupRepository(client),
  );
}
