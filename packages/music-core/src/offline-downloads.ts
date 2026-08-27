import type { MediaAsset, Track } from "./types.js";
import { OfflineLibrary } from "./offline-library.js";

export type OfflineDownloadStatus = "queued" | "downloading" | "available" | "failed";

export type OfflineDownloadState = {
  userId: string;
  trackId: string;
  status: OfflineDownloadStatus;
  asset?: MediaAsset;
  error?: string;
};

export interface OfflineDownloadStateStore {
  get(userId: string, trackId: string): Promise<OfflineDownloadState | null>;
  set(state: OfflineDownloadState): Promise<void>;
}

/** Orchestrates download state; actual source acquisition remains behind OfflineLibrary. */
export class OfflineDownloadManager {
  constructor(private readonly library: OfflineLibrary, private readonly store: OfflineDownloadStateStore) {}

  async download(userId: string, request: Omit<Parameters<OfflineLibrary["makeAvailableOffline"]>[0], "userId">): Promise<MediaAsset> {
    const base = { userId, trackId: request.track.id, status: "queued" as const };
    await this.store.set(base);
    await this.store.set({ ...base, status: "downloading" });
    try {
      const asset = await this.library.makeAvailableOffline({ ...request, userId });
      await this.store.set({ ...base, status: "available", asset });
      return asset;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.store.set({ ...base, status: "failed", error: message });
      throw error;
    }
  }

  async getState(userId: string, track: Track): Promise<OfflineDownloadState | null> {
    return this.store.get(userId, track.id);
  }
}
