/**
 * JHADINA-DAW.1: portable non-destructive edit document.
 * Same project/track state for laptop and landscape phone/tablet.
 * Original source bytes and approved versions are never modified by edits.
 * This describes edits; it does not claim native VST/AU execution or mixed WAV rendering.
 */
export type MusicDawPluginFormat = "web-audio" | "vst3" | "au";
export type MusicDawPluginStatus = "ready-web" | "needs-native-host" | "native-validated";
export interface MusicDawPluginSlot {
  id: string;
  pluginId: string;
  name: string;
  format: MusicDawPluginFormat;
  hostStatus: MusicDawPluginStatus;
  enabled: boolean;
  parameters: Record<string, number>;
  // A native host must supply the installed identifier and independently
  // validated, rights-approved plugin binary. Never accept a filesystem path.
  installedPluginId?: string;
}
export const MUSIC_DAW_WEB_EFFECTS = [
  { pluginId: "jhadina.web.delay", name: "Stereo Delay", format: "web-audio" as const },
  { pluginId: "jhadina.web.highpass", name: "High-pass Filter", format: "web-audio" as const },
];
export type MusicDawHostPlatform = "phone-web" | "tablet-web" | "laptop-browser" | "desktop-companion";
export interface MusicDawNativeHostEvidence {
  reachable: boolean;
  approved: boolean;
  platform: "macos" | "windows" | "linux";
  formats: MusicDawPluginFormat[];
  installedPluginIds: string[];
  receiptId: string;
}
export function admitMusicDawPlugin(slot: MusicDawPluginSlot,
  platform: MusicDawHostPlatform, native?: MusicDawNativeHostEvidence): {
    executableHere: boolean;
    route: "browser-web-audio" | "trusted-companion" | "unavailable";
  } {
  if (slot.format === "web-audio") {
    return { executableHere: MUSIC_DAW_WEB_EFFECTS.some(p => p.pluginId === slot.pluginId)
      && slot.hostStatus === "ready-web", route: "browser-web-audio" };
  }
  if (platform !== "desktop-companion" || !native?.reachable ||
      !native.approved || !native.receiptId ||
      !native.formats.includes(slot.format) ||
      !slot.installedPluginId ||
      !native.installedPluginIds.includes(slot.installedPluginId) ||
      slot.hostStatus !== "native-validated") {
    return { executableHere: false, route: "unavailable" };
  }
  return { executableHere: true, route: "trusted-companion" };
}
export function insertMusicDawPlugin(track: MusicDawTrack,
  input: { id: string; pluginId: string; name: string; format: MusicDawPluginFormat }): MusicDawTrack {
  if (!validId(input.id) || !validId(input.name) || !validId(input.pluginId) ||
      track.pluginRack?.some(p => p.id === input.id) || (track.pluginRack?.length ?? 0) >= 12) {
    throw new Error("MUSIC_DAW_PLUGIN_SLOT_INVALID");
  }
  if (input.format === "web-audio" &&
      !MUSIC_DAW_WEB_EFFECTS.some(p => p.pluginId === input.pluginId)) {
    throw new Error("MUSIC_DAW_WEB_EFFECT_NOT_ADMITTED");
  }
  const slot: MusicDawPluginSlot = {
    ...input, enabled: true, parameters: input.pluginId === "jhadina.web.delay"
      ? { timeSeconds: .25, feedback: .18, wet: .2 }
      : input.pluginId === "jhadina.web.highpass" ? { frequencyHz: 90 } : {},
    hostStatus: input.format === "web-audio" ? "ready-web" : "needs-native-host",
  };
  return { ...track, pluginRack: [...(track.pluginRack ?? []), slot] };
}
function validPlugin(slot: MusicDawPluginSlot): boolean {
  if (!slot || !validId(slot.id) || !validId(slot.pluginId) || !validId(slot.name) ||
      !["web-audio", "vst3", "au"].includes(slot.format) ||
      !["ready-web", "needs-native-host", "native-validated"].includes(slot.hostStatus) ||
      typeof slot.enabled !== "boolean" ||
      !slot.parameters || typeof slot.parameters !== "object" ||
      Array.isArray(slot.parameters) ||
      Object.keys(slot.parameters).length > 32 ||
      Object.values(slot.parameters).some(v => !numberIn(v, -20000, 20000))) return false;
  if (slot.format === "web-audio") {
    return slot.hostStatus === "ready-web" &&
      MUSIC_DAW_WEB_EFFECTS.some(p=>p.pluginId===slot.pluginId) &&
      !slot.installedPluginId;
  }
  // Native plugins may be represented in the cloud project, but no remote or
  // browser execution is implied by this serialized state.
  return slot.hostStatus === "needs-native-host" && !slot.installedPluginId;
}

export type MusicDawEq = { lowDb: number; midDb: number; highDb: number };
export interface MusicDawClip {
  id: string;
  startSeconds: number;
  endSeconds: number;
  sourceOffsetSeconds: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
}
export interface MusicDawTrack {
  artifactId: string;
  sourceSha256: string;
  name: string;
  role: string;
  durationSeconds: number;
  gainDb: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  eq: MusicDawEq;
  compressor: { enabled: boolean; thresholdDb: number; ratio: number };
  clips: MusicDawClip[];
  pluginRack?: MusicDawPluginSlot[];
}
export interface MusicDawSession {
  schemaVersion: "jhadina-music-daw/v1";
  caseId: string;
  revision: number;
  tempoBpm: number | null;
  tracks: MusicDawTrack[];
  updatedAt: string;
}
export interface MusicDawAsset {
  id: string;
  sha256: string;
  role?: string;
  kind: string;
  mimeType: string;
  sampleRate: number;
  sampleCount: number;
}
const LIMIT = 48;
const numberIn = (v: number, min: number, max: number) =>
  Number.isFinite(v) && v >= min && v <= max;
const validId = (v: unknown): v is string =>
  typeof v === "string" && !!v.trim() && v.length <= 240;
const sha = /^[a-f0-9]{64}$/i;
const audio = (x: MusicDawAsset) => x.mimeType.startsWith("audio/") &&
  !["audio/midi", "audio/x-midi"].includes(x.mimeType.toLowerCase());

export function initializeMusicDawSession(caseId: string, assets: MusicDawAsset[],
  now = new Date().toISOString()): MusicDawSession {
  if (!validId(caseId)) throw new Error("MUSIC_DAW_CASE_REQUIRED");
  const usable = assets.filter(audio).sort((a,b)=>Number(b.kind === "source")-Number(a.kind === "source"));
  if (!usable.length || usable.length > LIMIT) throw new Error("MUSIC_DAW_TRACK_COUNT_INVALID");
  return {
    schemaVersion: "jhadina-music-daw/v1", caseId, revision: 0,
    tempoBpm: null, updatedAt: now,
    tracks: usable.map((asset, index) => {
      const duration = asset.sampleCount / asset.sampleRate;
      if (!Number.isFinite(duration) || duration <= 0) throw new Error("MUSIC_DAW_ASSET_DURATION_INVALID");
      return {
        artifactId: asset.id, sourceSha256: asset.sha256.toLowerCase(),
        role: asset.role ?? (asset.kind === "source" ? "source-mix" : "stem"),
        name: asset.role ?? (asset.kind === "source" ? "Original (immutable)" : "Stem"),
        durationSeconds: duration, gainDb: 0, pan: 0,
        // One original reference sounds by default; other versions and stems
        // begin silent, so recursive layers never accidentally sum twice.
        mute: index !== 0, solo: false,
        eq: { lowDb: 0, midDb: 0, highDb: 0 },
        pluginRack: [],
        compressor: { enabled: false, thresholdDb: -18, ratio: 2 },
        clips: [{ id: "clip:" + asset.id, startSeconds: 0,
          endSeconds: duration, sourceOffsetSeconds: 0,
          fadeInSeconds: 0, fadeOutSeconds: 0 }],
      };
    }),
  };
}

export function validateMusicDawSession(value: MusicDawSession, caseId: string,
  assets: MusicDawAsset[]): MusicDawSession {
  if (!value || value.schemaVersion !== "jhadina-music-daw/v1" ||
      value.caseId !== caseId || !Number.isSafeInteger(value.revision) ||
      value.revision < 0 || !Array.isArray(value.tracks) ||
      value.tracks.length < 1 || value.tracks.length > LIMIT ||
      (value.tempoBpm !== null && !numberIn(value.tempoBpm, 25, 300)) ||
      !validId(value.updatedAt) || !Number.isFinite(Date.parse(value.updatedAt))) {
    throw new Error("MUSIC_DAW_DOCUMENT_INVALID");
  }
  const sources = new Map(assets.filter(audio).map(a => [a.id, a]));
  const trackIds = new Set<string>();
  let totalClips = 0;
  for (const track of value.tracks) {
    const source = sources.get(track.artifactId);
    if (!source || trackIds.has(track.artifactId) ||
        !sha.test(track.sourceSha256) ||
        track.sourceSha256.toLowerCase() !== source.sha256.toLowerCase() ||
        !validId(track.name) || !validId(track.role) ||
        !numberIn(track.durationSeconds, .000001, 86400) ||
        Math.abs(track.durationSeconds - source.sampleCount / source.sampleRate) > .01 ||
        !numberIn(track.gainDb, -60, 12) || !numberIn(track.pan, -1, 1) ||
        typeof track.mute !== "boolean" || typeof track.solo !== "boolean" ||
        !track.eq || !numberIn(track.eq.lowDb, -18, 18) ||
        !numberIn(track.eq.midDb, -18, 18) ||
        !numberIn(track.eq.highDb, -18, 18) ||
        !track.compressor ||
        typeof track.compressor.enabled !== "boolean" ||
        !numberIn(track.compressor.thresholdDb, -60, 0) ||
        !numberIn(track.compressor.ratio, 1, 12) ||
        !Array.isArray(track.clips) || track.clips.length > 64 ||
        (track.pluginRack !== undefined && (
          !Array.isArray(track.pluginRack) || track.pluginRack.length > 12 ||
          track.pluginRack.some(slot => !validPlugin(slot)) ||
          new Set(track.pluginRack.map(p=>p.id)).size !== track.pluginRack.length))) {
      throw new Error("MUSIC_DAW_TRACK_INTEGRITY_FAILED");
    }
    trackIds.add(track.artifactId);
    const clipIds = new Set<string>();
    for (const clip of track.clips) {
      if (!validId(clip.id) || clipIds.has(clip.id) ||
          !numberIn(clip.startSeconds, 0, 86400) ||
          !numberIn(clip.endSeconds, clip.startSeconds + .001, 86400) ||
          !numberIn(clip.sourceOffsetSeconds, 0, track.durationSeconds) ||
          clip.sourceOffsetSeconds + clip.endSeconds - clip.startSeconds >
            track.durationSeconds + .002 ||
          !numberIn(clip.fadeInSeconds, 0, Math.min(5, clip.endSeconds - clip.startSeconds)) ||
          !numberIn(clip.fadeOutSeconds, 0, Math.min(5, clip.endSeconds - clip.startSeconds))) {
        throw new Error("MUSIC_DAW_CLIP_INVALID");
      }
      clipIds.add(clip.id);
    }
    const sorted = [...track.clips].sort((a,b) => a.startSeconds-b.startSeconds);
    if (sorted.some((c,i) => i > 0 && c.startSeconds < sorted[i-1]!.endSeconds - .001)) {
      throw new Error("MUSIC_DAW_OVERLAPPING_CLIPS");
    }
    totalClips += track.clips.length;
  }
  if (totalClips > 1024) throw new Error("MUSIC_DAW_CLIP_BUDGET_EXCEEDED");
  return value;
}

export function splitMusicDawClip(track: MusicDawTrack, clipId: string,
  atSeconds: number): MusicDawTrack {
  const clip = track.clips.find(x => x.id === clipId);
  if (!clip || !numberIn(atSeconds, clip.startSeconds + .02, clip.endSeconds - .02)) {
    throw new Error("MUSIC_DAW_SPLIT_OUTSIDE_CLIP");
  }
  const left: MusicDawClip = { ...clip, endSeconds: atSeconds,
    fadeOutSeconds: Math.min(clip.fadeOutSeconds, atSeconds-clip.startSeconds) };
  const right: MusicDawClip = { ...clip, id: clip.id + ":split:" + atSeconds.toFixed(3),
    startSeconds: atSeconds,
    sourceOffsetSeconds: clip.sourceOffsetSeconds + (atSeconds - clip.startSeconds),
    fadeInSeconds: Math.min(clip.fadeInSeconds, clip.endSeconds-atSeconds) };
  return { ...track, clips: track.clips.flatMap(x => x.id === clipId ? [left, right] : [x]) };
}

export function activeMusicDawClip(track: MusicDawTrack, seconds: number):
  MusicDawClip | undefined {
  return track.clips.find(c => seconds >= c.startSeconds && seconds < c.endSeconds);
}

export function musicDawClipGain(clip: MusicDawClip, atSeconds: number): number {
  const elapsed = atSeconds-clip.startSeconds;
  const remaining = clip.endSeconds-atSeconds;
  if (elapsed < 0 || remaining <= 0) return 0;
  return Math.max(0, Math.min(1,
    clip.fadeInSeconds > 0 ? elapsed / clip.fadeInSeconds : 1,
    clip.fadeOutSeconds > 0 ? remaining / clip.fadeOutSeconds : 1));
}
