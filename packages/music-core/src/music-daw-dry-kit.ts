import {
  validateMusicDawSession, type MusicDawAsset, type MusicDawSession,
} from "./music-daw-session.js";

export interface MusicDawDryBounceMapping {
  id: string;
  sha256: string;
  localPath: string;
  sampleRate: number;
  sampleCount: number;
}
export interface MusicDawDryBounceKit {
  sessionJson: string;
  assetsJson: string;
  warnings: string[];
}

/**
 * Bind the exact saved DAW revision to the hash-verified asset file names
 * shipped in the user's Restoration Studio bundle. No auth URLs or filesystem
 * paths from the browser are serialized; these are relative paths inside stems/.
 *
 * Bundle pieces can contain partial assets, but a local operator must extract
 * ALL pieces (and direct-download files) before rendering; the dry bounce
 * independently hashes and refuses missing sources.
 */
export function buildMusicDawDryBounceKit(
  document: MusicDawSession,
  audio: MusicDawAsset[],
  tracks: Array<{
    artifactId: string; fileName: string; sha256: string;
    sampleRate: number; sampleCount: number;
  }>,
): MusicDawDryBounceKit {
  validateMusicDawSession(document, document.caseId, audio);
  if (!Number.isSafeInteger(document.revision) || document.revision < 1) {
    throw new Error("MUSIC_DAW_DRY_KIT_REQUIRES_SAVED_REVISION");
  }
  const byId = new Map(tracks.map(t => [t.artifactId, t]));
  const localNames = new Set<string>();
  const mapping: MusicDawDryBounceMapping[] = [];
  const warnings: string[] = [];
  for (const entry of document.tracks) {
    const track = byId.get(entry.artifactId);
    const asset = audio.find(x => x.id === entry.artifactId);
    if (!track || !asset ||
        track.sha256.toLowerCase() !== entry.sourceSha256.toLowerCase() ||
        track.sampleRate !== asset.sampleRate ||
        track.sampleCount !== asset.sampleCount ||
        !track.fileName || track.fileName.length > 240 ||
        track.fileName === "." || track.fileName === ".." ||
        /[\\/]/.test(track.fileName) || localNames.has(track.fileName)) {
      throw new Error("MUSIC_DAW_DRY_KIT_SOURCE_MAPPING_INVALID");
    }
    localNames.add(track.fileName);
    mapping.push({
      id: track.artifactId,
      sha256: track.sha256.toLowerCase(),
      localPath: track.fileName,
      sampleRate: track.sampleRate,
      sampleCount: track.sampleCount,
    });
    if (asset.mimeType.toLowerCase() !== "audio/wav" &&
        asset.mimeType.toLowerCase() !== "audio/x-wav") {
      warnings.push("Non-WAV source " + entry.artifactId +
        ": the strict dry renderer will block until a new hashed WAV derivative is registered.");
    }
    if (entry.compressor.enabled ||
        Object.values(entry.eq).some(value => value !== 0) ||
        entry.pluginRack?.some(plugin => plugin.enabled)) {
      warnings.push("Active DSP on " + entry.artifactId +
        ": dry bounce intentionally fails instead of silently ignoring plugin/EQ/compressor settings.");
    }
  }
  return {
    sessionJson: JSON.stringify(document, null, 2) + "\n",
    assetsJson: JSON.stringify(mapping, null, 2) + "\n",
    warnings,
  };
}
