import type { MediaAsset, MusicSource, Track } from "./types.js";
import type { MusicRepository } from "./repository.js";

export type UserPlaybackRequest = { userId: string; track: Track; offlineOnly?: boolean };
export type UserPlaybackResult = { track: Track; asset: MediaAsset; mode: "offline" | "network" };
export interface AuthorizedPlaybackResolver { resolve(request: UserPlaybackRequest): Promise<UserPlaybackResult | null>; }
export type SourceAssetResolver = { resolve(source: MusicSource, track: Track): Promise<MediaAsset | null> };

/** User-scoped resolver: repository ownership + source authorization are checked before playback. */
export class UserScopedPlaybackResolver implements AuthorizedPlaybackResolver {
  constructor(private readonly repository: MusicRepository, private readonly network: SourceAssetResolver) {}

  async resolve(request: UserPlaybackRequest): Promise<UserPlaybackResult | null> {
    if (!request.userId || !request.track.id) return null;

    const track = await this.repository.getTrack(request.userId, request.track.id);
    if (!track) return null;

    const offline = await this.repository.listAssets(request.userId, track.id);
    const local = offline.find((asset) => asset.kind === "file" && asset.provenance?.offline === true);
    if (local) return { track, asset: local, mode: "offline" };
    if (request.offlineOnly) return null;

    const sources = (await this.repository.listSources(request.userId)).filter((source) => source.authorized);
    for (const source of sources) {
      const asset = await this.network.resolve(source, track);
      if (asset && asset.sourceId === source.id && asset.trackId === track.id) {
        return { track, asset, mode: "network" };
      }
    }
    return null;
  }
}
