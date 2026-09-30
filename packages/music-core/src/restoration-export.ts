import type { StoredRestorationArtifact } from "./restoration-engine/ingest-runtime.js";

export interface RestorationExportMarker {
  id: string;
  label: string;
  sample: number;
  sampleRate: number;
  confidence?: number;
  kind?: string;
}

export interface RestorationExportTrack {
  artifactId: string;
  name: string;
  role: string;
  fileName: string;
  sampleRate: number;
  channels: number;
  sampleCount: number;
  durationSeconds: number;
  sha256: string;
  sourceKind: StoredRestorationArtifact["kind"];
}

export interface RestorationDawManifest {
  version: 1;
  caseId: string;
  title: string;
  createdAt: string;
  sourceArtifactId: string;
  currentVersionId: string;
  tracks: RestorationExportTrack[];
  markers: RestorationExportMarker[];
  restorationHistory: Array<{
    id: string;
    operation?: string;
    operationClass?: string;
    sourceArtifactId?: string;
    outputArtifactId?: string;
    createdAt: string;
    qcPassed?: boolean;
  }>;
  notes: string[];
}

const safeName = (value: string): string =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 100) || "track";

const escapeRpp = (value: string): string => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

function roleName(role?: string): string {
  const value = role?.trim() || "mix";
  if (value === "vocals") return "Vocals";
  if (value === "drums") return "Drums";
  if (value === "bass") return "Bass";
  if (value === "other") return "Other";
  if (value === "vocal-restoration") return "Vocals Restored";
  if (value.startsWith("reconstructed-")) {
    return "Reconstructed " + value.slice("reconstructed-".length).replace(/-/g, " ");
  }
  if (value === "restoration-output") return "Restoration Output";
  return value.replace(/-/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

export function buildRestorationExportTracks(
  artifacts: StoredRestorationArtifact[],
): RestorationExportTrack[] {
  return artifacts
    .filter(artifact => artifact.mimeType.startsWith("audio/"))
    .map(artifact => {
      const role = artifact.role ?? (artifact.kind === "source" ? "source-mix" : "derived");
      const label = roleName(role);
      return {
        artifactId: artifact.id,
        name: label,
        role,
        fileName: safeName(label) + "-" + artifact.id.replace(/[^a-zA-Z0-9]+/g, "-").slice(-16) + ".wav",
        sampleRate: artifact.sampleRate,
        channels: artifact.channels,
        sampleCount: artifact.sampleCount,
        durationSeconds: artifact.sampleRate > 0 ? artifact.sampleCount / artifact.sampleRate : 0,
        sha256: artifact.contentHash,
        sourceKind: artifact.kind,
      };
    })
    .sort((a, b) => {
      const priority = (role: string): number => {
        if (role === "source-mix") return 0;
        if (role === "vocals" || role === "vocal-restoration") return 1;
        if (role === "drums") return 2;
        if (role === "bass") return 3;
        if (role === "other") return 4;
        return 5;
      };
      return priority(a.role) - priority(b.role) || a.name.localeCompare(b.name);
    });
}

export function renderRestorationMarkersCsv(markers: RestorationExportMarker[]): string {
  const rows = ["id,label,kind,time_seconds,sample,sample_rate,confidence"];
  for (const marker of [...markers].sort((a, b) => a.sample / a.sampleRate - b.sample / b.sampleRate)) {
    const cells = [
      marker.id,
      marker.label,
      marker.kind ?? "",
      (marker.sample / marker.sampleRate).toFixed(6),
      String(marker.sample),
      String(marker.sampleRate),
      marker.confidence === undefined ? "" : marker.confidence.toFixed(4),
    ].map(value => '"' + String(value).replace(/"/g, '""') + '"');
    rows.push(cells.join(","));
  }
  return rows.join("\n") + "\n";
}

export function renderReaperProject(manifest: RestorationDawManifest): string {
  const sampleRate = manifest.tracks[0]?.sampleRate ?? 48000;
  const lines = [
    '<REAPER_PROJECT 0.1 "7.0" 0',
    "  RIPPLE 0",
    "  GROUPOVERRIDE 0 0 0",
    "  AUTOXFADE 1",
    "  SAMPLERATE " + sampleRate + " 0 0",
  ];

  manifest.markers
    .slice()
    .sort((a, b) => a.sample / a.sampleRate - b.sample / b.sampleRate)
    .forEach((marker, index) => {
      lines.push(
        '  MARKER ' + (index + 1) + ' ' + (marker.sample / marker.sampleRate).toFixed(9) +
        ' "' + escapeRpp(marker.label) + '" 0 0 1 B {00000000-0000-0000-0000-000000000000}',
      );
    });

  for (const track of manifest.tracks) {
    lines.push(
      "  <TRACK",
      '    NAME "' + escapeRpp(track.name) + '"',
      "    PEAKCOL 16576",
      "    BEAT -1",
      "    AUTOMODE 0",
      "    <ITEM",
      "      POSITION 0.00000000000000",
      "      LENGTH " + track.durationSeconds.toFixed(12),
      '      NAME "' + escapeRpp(track.name) + '"',
      "      VOLPAN 1 0 1 -1",
      "      SOFFS 0",
      "      PLAYRATE 1 1 0 -1 0 0.0025",
      "      <SOURCE WAVE",
      '        FILE "stems/' + escapeRpp(track.fileName) + '"',
      "      >",
      "    >",
      "  >",
    );
  }
  lines.push(">");
  return lines.join("\n") + "\n";
}

export function renderLogicImportGuide(manifest: RestorationDawManifest): string {
  const trackList = manifest.tracks.map(track => "- stems/" + track.fileName + " — " + track.name).join("\n");
  return [
    "# Logic Pro import — " + manifest.title,
    "",
    "1. Create a new project at the source sample rate.",
    "2. Drag all WAV files from the stems folder to bar 1 / time 0 with one file per track.",
    "3. Keep every file at original speed and pitch; do not normalize on import.",
    "4. Use markers.csv as the restoration reference sheet or recreate markers at the listed times.",
    "5. Keep restoration-manifest.json beside the project as the provenance/QC record.",
    "",
    "Source sample rate: " + (manifest.tracks[0]?.sampleRate ?? "unknown") + " Hz",
    "",
    "## Tracks",
    trackList || "- No audio tracks",
    "",
    "Jhadina export rule: these assets are derived restoration files; the immutable source remains authoritative.",
    "",
  ].join("\n");
}

export function renderRestorationManifest(manifest: RestorationDawManifest): string {
  return JSON.stringify(manifest, null, 2) + "\n";
}
