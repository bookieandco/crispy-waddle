import type { MediaAsset, Track } from "./types.js";
import type { MusicRepository } from "./repository.js";

export interface OfflineDownloadRequest {
  userId: string;
  track: Track;
  sourceId: string;
  sourceUri: string;
  mimeType?: string;
  codec?: string;
  bitrate?: number;
  lossless?: boolean;
  provenance?: Record<string, unknown>;
}

export interface OfflineDownloadResult { asset: MediaAsset; }

export interface OfflineSourceResolver {
  download(request: OfflineDownloadRequest, signal?: AbortSignal): Promise<OfflineDownloadResult>;
}

export interface OfflineAssetRemover {
  remove(userId: string, trackId: string): Promise<void>;
}

/** Resolves an already-authorized/downloadable source into a local file. */
export class OfflineLibrary {
  constructor(
    private readonly repository: MusicRepository,
    private readonly resolver: OfflineSourceResolver,
    private readonly remover?: OfflineAssetRemover,
  ) {}

  async makeAvailableOffline(request: OfflineDownloadRequest, signal?: AbortSignal): Promise<MediaAsset> {
    if (!request.userId) throw new Error("userId is required");
    if (!request.track.id) throw new Error("track.id is required");
    if (!request.sourceId) throw new Error("sourceId is required");
    if (!request.sourceUri) throw new Error("sourceUri is required");

    const result = await this.resolver.download(request, signal);
    const asset: MediaAsset = {
      ...result.asset,
      trackId: request.track.id,
      sourceId: request.sourceId,
      kind: "file",
      provenance: { ...request.provenance, offline: true, sourceUri: request.sourceUri },
    };
    return this.repository.addAsset(request.userId, asset);
  }

  async listOffline(userId: string, trackId: string): Promise<MediaAsset[]> {
    const assets = await this.repository.listAssets(userId, trackId);
    return assets.filter((asset) => asset.kind === "file" && asset.provenance?.offline === true);
  }

  async removeOffline(userId: string, trackId: string): Promise<void> {
    if (!this.remover) throw new Error("Offline asset removal is not configured");
    await this.remover.remove(userId, trackId);
  }
}
