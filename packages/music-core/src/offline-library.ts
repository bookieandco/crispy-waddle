import type { MediaAsset, Track } from "./types.js";
import type { MusicRepository } from "./repository.js";

export interface OfflineDownloadRequest {
  userId: string; track: Track; sourceId: string; sourceUri: string;
  mimeType?: string; codec?: string; bitrate?: number; lossless?: boolean;
  provenance?: Record<string, unknown>;
}
export interface OfflineDownloadResult { asset: MediaAsset; }
export interface OfflineSourceResolver { download(request: OfflineDownloadRequest, signal?: AbortSignal): Promise<OfflineDownloadResult>; }
export interface OfflineAssetRemover { remove(userId: string, asset: MediaAsset): Promise<void>; }

/** Persists only assets produced from an already-authorized downloadable source. */
export class OfflineLibrary {
  constructor(private readonly repository: MusicRepository, private readonly resolver: OfflineSourceResolver, private readonly remover?: OfflineAssetRemover) {}
  async makeAvailableOffline(request: OfflineDownloadRequest, signal?: AbortSignal): Promise<MediaAsset> {
    if (!request.userId || !request.track.id || !request.sourceId || !request.sourceUri) throw new Error("Complete offline download identity is required");
    const ownedTrack = await this.repository.getTrack(request.userId, request.track.id);
    if (!ownedTrack) throw new Error("Track is not in the user's authorized music library");
    const source = (await this.repository.listSources(request.userId)).find((item) => item.id === request.sourceId && item.authorized);
    if (!source) throw new Error("Authorized music source is required for offline download");
    const result = await this.resolver.download({ ...request, track: ownedTrack }, signal);
    if (result.asset.trackId !== ownedTrack.id || result.asset.sourceId !== source.id) throw new Error("Offline resolver returned an asset outside the authorized track/source scope");
    const asset: MediaAsset = { ...result.asset, trackId: ownedTrack.id, sourceId: source.id, kind: "file", provenance: { ...request.provenance, ...result.asset.provenance, offline: true } };
    return this.repository.addAsset(request.userId, asset);
  }
  async listOffline(userId: string, trackId: string) {
    return (await this.repository.listAssets(userId, trackId)).filter((asset) => asset.kind === "file" && asset.provenance?.offline === true);
  }
  async removeOffline(userId: string, trackId: string): Promise<void> {
    if (!this.remover) throw new Error("Offline asset removal is not configured");
    const assets = await this.listOffline(userId, trackId);
    for (const asset of assets) await this.remover.remove(userId, asset);
  }
}
