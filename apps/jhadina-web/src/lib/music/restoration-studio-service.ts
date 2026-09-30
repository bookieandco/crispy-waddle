import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildRestorationExportTracks,
  type RestorationDawManifest,
  type RestorationExportMarker,
} from "@jhadina/music-core";
import { SupabaseMusicRestorationArtifactStore } from "./restoration-supabase-store";

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function listRestorationStudioCases(input: {
  client: SupabaseClient;
  ownerUserId: string;
}) {
  const store = new SupabaseMusicRestorationArtifactStore(input.client, input.ownerUserId);
  return store.listCases();
}

export async function getRestorationStudioCase(input: {
  client: SupabaseClient;
  ownerUserId: string;
  caseId: string;
}) {
  const store = new SupabaseMusicRestorationArtifactStore(input.client, input.ownerUserId);
  const restorationCase = await store.getCase(input.caseId);
  if (!restorationCase) throw new Error("MUSIC_RESTORATION_CASE_NOT_FOUND");

  const [
    artifacts,
    evidence,
    versions,
    reconstructions,
    vocalRepairs,
    jobs,
    executionReceipts,
    reviews,
  ] = await Promise.all([
    store.listArtifacts(input.caseId),
    store.listEvidence(input.caseId),
    store.listVersions(input.caseId),
    store.listReconstructionReceipts(input.caseId),
    store.listVocalReceipts(input.caseId),
    store.listJobs(input.caseId),
    store.listExecutionReceipts(input.caseId),
    store.listReviews(input.caseId),
  ]);

  const audio = await Promise.all(artifacts.map(async artifact => ({
    artifact,
    downloadUrl: await store.createArtifactDownloadUrl(artifact.id),
  })));

  const sourceArtifactId = String(restorationCase.source_artifact_id);
  const markers: RestorationExportMarker[] = evidence.flatMap(item => {
    const artifactId = stringValue(item.artifact_id);
    if (artifactId !== sourceArtifactId) return [];
    const region = objectValue(item.region);
    const startSample = numberValue(region.startSample);
    const artifact = artifacts.find(candidate => candidate.id === artifactId);
    if (startSample === undefined || !artifact) return [];
    const data = objectValue(item.data);
    return [{
      id: String(item.id),
      label: stringValue(data.label) ?? String(item.kind ?? "evidence"),
      artifactId,
      kind: String(item.kind ?? "evidence"),
      sample: Math.max(0, Math.round(startSample)),
      sampleRate: artifact.sampleRate,
      confidence: numberValue(item.confidence),
    }];
  });

  const history = [
    ...versions.map(item => ({
      id: String(item.id),
      operation: stringValue(item.operation),
      operationClass: stringValue(item.operation_class),
      sourceArtifactId: stringValue(item.source_artifact_id),
      outputArtifactId: stringValue(item.output_artifact_id),
      createdAt: String(item.created_at),
      qcPassed: typeof item.qc_passed === "boolean" ? item.qc_passed : undefined,
    })),
    ...reconstructions.map(item => ({
      id: String(item.id),
      operation: "instrument-reconstruction",
      operationClass: "reconstruction",
      sourceArtifactId: stringValue(item.source_artifact_id),
      outputArtifactId: stringValue(item.output_artifact_id),
      createdAt: String(item.created_at),
      qcPassed: objectValue(item.qc).passed === true,
    })),
    ...vocalRepairs.map(item => ({
      id: String(item.id),
      operation: "vocal-restoration",
      operationClass: "correction",
      sourceArtifactId: stringValue(item.source_artifact_id),
      outputArtifactId: stringValue(item.output_artifact_id),
      createdAt: String(item.created_at),
      qcPassed: objectValue(item.qc).passed === true,
    })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const tracks = buildRestorationExportTracks(artifacts);
  const manifest: RestorationDawManifest = {
    version: 1,
    caseId: String(restorationCase.id),
    title: String(restorationCase.title),
    createdAt: new Date().toISOString(),
    sourceArtifactId: String(restorationCase.source_artifact_id),
    currentVersionId: String(restorationCase.current_version_id),
    tracks,
    markers,
    restorationHistory: history,
    notes: [
      "The immutable source remains authoritative.",
      "Derived and reconstructed tracks must not be mistaken for recovered canonical source.",
      "A/B audition remains required for repaired material before release.",
    ],
  };

  return {
    restorationCase,
    artifacts: audio.map(({ artifact, downloadUrl }) => ({
      id: artifact.id,
      kind: artifact.kind,
      role: artifact.role,
      sha256: artifact.contentHash,
      sampleRate: artifact.sampleRate,
      channels: artifact.channels,
      sampleCount: artifact.sampleCount,
      durationSeconds: artifact.sampleRate > 0 ? artifact.sampleCount / artifact.sampleRate : 0,
      parentArtifactId: artifact.parentArtifactId,
      createdAt: artifact.createdAt,
      runtimeReceiptId: artifact.runtimeReceiptId,
      downloadUrl,
    })),
    evidence,
    markers,
    versions,
    reconstructions,
    vocalRepairs,
    jobs,
    executionReceipts,
    reviews,
    manifest,
  };
}
