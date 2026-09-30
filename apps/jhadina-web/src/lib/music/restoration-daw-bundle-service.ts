import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildRestorationZip,
  renderLogicImportGuide,
  renderReaperProject,
  renderRestorationManifest,
  renderRestorationMarkersCsv,
  sha256Hex,
} from "@jhadina/music-core";
import type { getRestorationStudioCase } from "./restoration-studio-service";
import { SupabaseMusicRestorationArtifactStore } from "./restoration-supabase-store";

export const MAX_DAW_BUNDLE_SOURCE_BYTES = 250 * 1024 * 1024;

type StudioSnapshot = Awaited<ReturnType<typeof getRestorationStudioCase>>;

function safeFile(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "restoration";
}

export async function buildRestorationDawBundle(input: {
  client: SupabaseClient;
  ownerUserId: string;
  snapshot: StudioSnapshot;
}) {
  const totalSourceBytes = input.snapshot.artifacts.reduce(
    (sum, artifact) => sum + Number(artifact.sizeBytes ?? 0),
    0,
  );
  if (!Number.isFinite(totalSourceBytes) || totalSourceBytes > MAX_DAW_BUNDLE_SOURCE_BYTES) {
    throw new Error("MUSIC_RESTORATION_DAW_BUNDLE_TOO_LARGE");
  }

  const store = new SupabaseMusicRestorationArtifactStore(input.client, input.ownerUserId);
  const title = safeFile(String(input.snapshot.restorationCase.title ?? "restoration"));
  const entries: Array<{ path: string; data: Uint8Array | string }> = [
    {
      path: "restoration-manifest.json",
      data: renderRestorationManifest(input.snapshot.manifest),
    },
    {
      path: "markers.csv",
      data: renderRestorationMarkersCsv(input.snapshot.manifest.markers),
    },
    {
      path: title + ".rpp",
      data: renderReaperProject(input.snapshot.manifest),
    },
    {
      path: "LOGIC-IMPORT.md",
      data: renderLogicImportGuide(input.snapshot.manifest),
    },
    {
      path: "README.txt",
      data: [
        "Jhadina Restoration Studio DAW bundle",
        "",
        "The immutable source remains authoritative.",
        "Files in stems/ are exact registered artifact bytes and are SHA-256 checked before packaging.",
        "Open the .rpp file in REAPER from this extracted folder, or import stems/ at time 0 in Logic Pro.",
        "markers.csv and restoration-manifest.json preserve timing, lineage, QC and restoration history.",
        "",
      ].join("\n"),
    },
  ];

  const verifiedArtifacts: Array<{ artifactId: string; sha256: string; bytes: number }> = [];
  for (const track of input.snapshot.manifest.tracks) {
    const bytes = await store.downloadArtifactBytes(track.artifactId);
    const actualHash = await sha256Hex(bytes);
    if (actualHash.toLowerCase() !== track.sha256.toLowerCase()) {
      throw new Error(`MUSIC_RESTORATION_EXPORT_HASH_MISMATCH: ${track.artifactId}`);
    }
    entries.push({ path: "stems/" + track.fileName, data: bytes });
    verifiedArtifacts.push({
      artifactId: track.artifactId,
      sha256: actualHash,
      bytes: bytes.byteLength,
    });
  }

  const bytes = buildRestorationZip(entries);
  const sha256 = await sha256Hex(bytes);
  return {
    title,
    bytes,
    sha256,
    totalSourceBytes,
    verifiedArtifacts,
  };
}
