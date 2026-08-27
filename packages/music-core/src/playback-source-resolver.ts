import type { MediaAsset, Track } from "./types.js";

export type PlaybackSourceRequest = {
  track: Track;
  offlineOnly?: boolean;
};

export type PlaybackSourceResult = {
  track: Track;
  asset: MediaAsset;
  mode: "offline" | "network";
};

export interface PlaybackSourceResolver {
  resolve(request: PlaybackSourceRequest): Promise<PlaybackSourceResult | null>;
}

/**
 * Provider-neutral playback boundary. Providers resolve their own authorized
 * playable assets; the player never needs to know how a URL was obtained.
 */
export class CompositePlaybackSourceResolver implements PlaybackSourceResolver {
  constructor(
    private readonly offlineResolver?: PlaybackSourceResolver,
    private readonly networkResolvers: PlaybackSourceResolver[] = [],
  ) {}

  async resolve(request: PlaybackSourceRequest): Promise<PlaybackSourceResult | null> {
    if (this.offlineResolver) {
      const offline = await this.offlineResolver.resolve({ ...request, offlineOnly: true });
      if (offline) return { ...offline, mode: "offline" };
    }
    if (request.offlineOnly) return null;
    for (const resolver of this.networkResolvers) {
      const result = await resolver.resolve({ ...request, offlineOnly: false });
      if (result) return { ...result, mode: "network" };
    }
    return null;
  }
}
