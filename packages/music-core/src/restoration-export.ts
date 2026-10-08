import type { StoredRestorationArtifact } from "./restoration-engine/ingest-runtime.js";

export interface RestorationExportMarker {
  id: string;
  label: string;
  artifactId?: string;
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

function audioExtension(mimeType: string): string {
  const mime = mimeType.toLowerCase().split(";")[0]?.trim();
  if (mime === "audio/wav" || mime === "audio/x-wav") return ".wav";
  if (mime === "audio/flac") return ".flac";
  if (mime === "audio/mpeg") return ".mp3";
  if (mime === "audio/mp4") return ".m4a";
  if (mime === "audio/aac") return ".aac";
  if (mime === "audio/ogg") return ".ogg";
  if (mime === "audio/midi" || mime === "audio/x-midi") return ".mid";
  return ".audio";
}

function roleName(role?: string): string {
  const value = role?.trim() || "mix";
  if (value === "vocals") return "Vocals";
  if (value === "drums") return "Drums";
  if (value.startsWith("drums.")) return "Drums — " + value.slice(6).replace(/-/g, " ");
  if (value === "guitar") return "Guitar";
  if (value.startsWith("midi.")) return "Creative MIDI — " + value.slice(5);
  if (value === "piano") return "Piano";
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
        fileName: safeName(label) + "-" + artifact.id.replace(/[^a-zA-Z0-9]+/g, "-").slice(-16) + audioExtension(artifact.mimeType),
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
    // Standard MIDI files are delivered intact in the bundle; do not emit
    // <SOURCE WAVE> for MIDI and silently corrupt the Reaper project.
    if (track.fileName.toLowerCase().endsWith(".mid")) continue;
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
    "6. MIDI files are creative transcriptions: import separately onto a MIDI instrument track, audit note/timing accuracy, and render an explicitly labeled new performance.",
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


export interface RestorationZipEntry {
  path: string;
  data: Uint8Array | string;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = CRC32_TABLE[(value ^ byte) & 0xff]! ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function zipPath(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length || parts.some(part => part === "." || part === "..")) {
    throw new Error("Restoration ZIP entry path is invalid.");
  }
  return parts.join("/");
}

function u16(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value & 0xffff, true);
  return bytes;
}

function u32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

/**
 * Builds a standards-compliant ZIP using the STORE method (no compression).
 * Audio is already compressed or large PCM, so avoiding a second compression
 * layer keeps export deterministic and removes a runtime dependency.
 */
export function buildRestorationZip(entries: RestorationZipEntry[]): Uint8Array {
  if (!entries.length) throw new Error("Restoration ZIP requires at least one entry.");
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const seen = new Set<string>();
  let localOffset = 0;

  for (const raw of entries) {
    const path = zipPath(raw.path);
    if (seen.has(path)) throw new Error(`Duplicate restoration ZIP entry: ${path}`);
    seen.add(path);
    const name = encoder.encode(path);
    const data = typeof raw.data === "string" ? encoder.encode(raw.data) : raw.data;
    const checksum = crc32(data);
    if (data.byteLength > 0xffffffff) throw new Error("Restoration ZIP entry exceeds ZIP32 limits.");

    const localHeader = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0x0021),
      u32(checksum),
      u32(data.byteLength),
      u32(data.byteLength),
      u16(name.byteLength),
      u16(0),
      name,
    ]);
    localParts.push(localHeader, data);

    centralParts.push(concatBytes([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0x0021),
      u32(checksum),
      u32(data.byteLength),
      u32(data.byteLength),
      u16(name.byteLength),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(localOffset),
      name,
    ]));
    localOffset += localHeader.byteLength + data.byteLength;
  }

  const central = concatBytes(centralParts);
  const local = concatBytes(localParts);
  if (local.byteLength > 0xffffffff || central.byteLength > 0xffffffff) {
    throw new Error("Restoration ZIP exceeds ZIP32 limits.");
  }
  const end = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(central.byteLength),
    u32(local.byteLength),
    u16(0),
  ]);
  return concatBytes([local, central, end]);
}
