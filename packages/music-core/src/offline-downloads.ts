import type { MediaAsset, Track } from "./types.js";
import { OfflineLibrary } from "./offline-library.js";

export type OfflineDownloadStatus = "queued" | "downloading" | "available" | "failed" | "canceled";

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

export interface OfflineDownloadTask {
  cancel(): void;
}

/** Orchestrates user-scoped download state and prevents terminal-state resurrection. */
export class OfflineDownloadManager {
  private readonly active = new Map<string, { canceled: boolean }>();

  constructor(private readonly library: OfflineLibrary, private readonly store: OfflineDownloadStateStore) {}

  async download(userId: string, request: Omit<Parameters<OfflineLibrary["makeAvailableOffline"]>[0], "userId">): Promise<MediaAsset> {
    const key = this.key(userId, request.track.id);
    const control = { canceled: false };
    this.active.set(key, control);
    const base = { userId, trackId: request.track.id, status: "queued" as const };
    await this.store.set(base);
    await this.store.set({ ...base, status: "downloading" });
    try {
      const asset = await this.library.makeAvailableOffline({ ...request, userId });
      if (control.canceled) throw new Error("Download canceled");
      await this.store.set({ ...base, status: "available", asset });
      return asset;
    } catch (error) {
      if (control.canceled) {
        await this.store.set({ ...base, status: "canceled" });
      } else {
        const message = error instanceof Error ? error.message : String(error);
        await this.store.set({ ...base, status: "failed", error: message });
      }
      throw error;
    } finally {
      this.active.delete(key);
    }
  }

  cancel(userId: string, trackId: string): boolean {
    const control = this.active.get(this.key(userId, trackId));
    if (!control) return false;
    control.canceled = true;
    return true;
  }

  async remove(userId: string, trackId: string): Promise<void> {
    const state = await this.store.get(userId, trackId);
    if (!state?.asset) return;
    await this.library.removeOffline(userId, trackId);
    await this.store.set({ userId, trackId, status: "canceled" });
  }

  async getState(userId: string, track: Track): Promise<OfflineDownloadState | null> {
    return this.store.get(userId, track.id);
  }

  private key(userId: string, trackId: string): string { return `${userId}:${trackId}`; }
}
