import type { MediaAsset, Track } from "./types.js";
import { OfflineLibrary } from "./offline-library.js";
export type OfflineDownloadStatus = "queued" | "downloading" | "available" | "failed" | "canceled";
export interface OfflineDownloadState { userId: string; trackId: string; status: OfflineDownloadStatus; asset?: MediaAsset; error?: string; }
export interface OfflineDownloadStateStore { get(userId: string, trackId: string): Promise<OfflineDownloadState | null>; set(state: OfflineDownloadState): Promise<void>; }
export class OfflineDownloadManager {
  private readonly active = new Map<string, { canceled: boolean; controller: AbortController }>();
  constructor(private readonly library: OfflineLibrary, private readonly store: OfflineDownloadStateStore) {}
  async download(userId: string, request: Omit<Parameters<OfflineLibrary["makeAvailableOffline"]>[0], "userId">): Promise<MediaAsset> {
    const key = this.key(userId, request.track.id);
    if (this.active.has(key)) throw new Error("Offline download already active");
    const control = { canceled: false, controller: new AbortController() };
    this.active.set(key, control);
    const base = { userId, trackId: request.track.id };
    await this.store.set({ ...base, status: "queued" });
    await this.store.set({ ...base, status: "downloading" });
    try {
      const asset = await this.library.makeAvailableOffline({ ...request, userId }, control.controller.signal);
      if (control.canceled) throw new Error("Download canceled");
      await this.store.set({ ...base, status: "available", asset });
      return asset;
    } catch (error) {
      await this.store.set(control.canceled ? { ...base, status: "canceled" } : { ...base, status: "failed", error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally { this.active.delete(key); }
  }
  cancel(userId: string, trackId: string) {
    const control = this.active.get(this.key(userId, trackId)); if (!control) return false;
    control.canceled = true; control.controller.abort(); return true;
  }
  async remove(userId: string, trackId: string) { await this.library.removeOffline(userId, trackId); await this.store.set({ userId, trackId, status: "canceled" }); }
  async getState(userId: string, track: Track) { return this.store.get(userId, track.id); }
  private key(userId: string, trackId: string) { return `${userId}:${trackId}`; }
}
