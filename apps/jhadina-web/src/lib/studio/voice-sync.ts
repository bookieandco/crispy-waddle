export type VoiceSyncMode = "lip-sync" | "phoneme-driven" | "viseme-driven";
export type VoiceSyncStatus = "queued" | "analyzing-audio" | "tracking-face" | "generating-sync" | "review" | "approved" | "failed";

export interface VoiceSyncJob {
  id: string;
  audioAssetId: string;
  videoAssetId: string;
  mode: VoiceSyncMode;
  status: VoiceSyncStatus;
  language?: string;
  preserveOriginalAudio: boolean;
  previewSeekEnabled: boolean;
}

export interface VoiceSyncTrack {
  startMs: number;
  endMs: number;
  phoneme?: string;
  viseme?: string;
  confidence: number;
}

export function createVoiceSyncJob(input: Omit<VoiceSyncJob, "id" | "status">): VoiceSyncJob {
  return { ...input, id: crypto.randomUUID(), status: "queued" };
}

export function isVoiceSyncTrackUsable(track: VoiceSyncTrack): boolean {
  return track.endMs > track.startMs && track.confidence >= 0.7;
}
