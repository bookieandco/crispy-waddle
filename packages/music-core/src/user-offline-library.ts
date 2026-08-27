import type { MediaAsset, Track } from "./types.js";
import { OfflineLibrary, type OfflineDownloadRequest } from "./offline-library.js";

/** User-scoped façade: identity is supplied at construction, never inferred from playback/controller state. */
export class UserOfflineLibrary {
  constructor(private readonly userId: string, private readonly library: OfflineLibrary) {
    if (!userId) throw new Error("userId is required");
  }

  async download(input: Omit<OfflineDownloadRequest, "userId" | "track"> & { track: Track }): Promise<MediaAsset> {
    return this.library.makeAvailableOffline({ ...input, userId: this.userId });
  }

  async list(trackId: string): Promise<MediaAsset[]> {
    return this.library.listOffline(this.userId, trackId);
  }
}
