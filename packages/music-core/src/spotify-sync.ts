import type { MusicRepository } from "./repository.js";
import type { Playlist, Track } from "./types.js";
import type { SpotifyWebApiProvider } from "./spotify-provider.js";

export type SpotifySyncPage = { limit?: number; offset?: number };
export type SpotifySyncResult = { tracks: number; playlists: number; savedAlbums: number; followedArtists: number; recentlyPlayed: number };

/** Normalizes a Spotify account into Jhadina's provider-neutral library boundary. */
export class SpotifyLibrarySync {
  constructor(private readonly provider: SpotifyWebApiProvider, private readonly repository: MusicRepository) {}

  async importTrack(userId: string, trackId: string): Promise<Track> {
    return this.provider.importTrack(userId, trackId);
  }

  async importPlaylist(userId: string, playlistId: string): Promise<Playlist> {
    return this.provider.importPlaylist(userId, playlistId);
  }

  async syncTracks(userId: string, trackIds: string[]): Promise<number> {
    let count = 0;
    for (const trackId of [...new Set(trackIds)]) {
      await this.provider.importTrack(userId, trackId);
      count += 1;
    }
    return count;
  }

  async syncPlaylists(userId: string, playlistIds: string[]): Promise<number> {
    let count = 0;
    for (const playlistId of [...new Set(playlistIds)]) {
      await this.provider.importPlaylist(userId, playlistId);
      count += 1;
    }
    return count;
  }

  async snapshot(userId: string): Promise<{ tracks: Track[]; sources: Awaited<ReturnType<MusicRepository["listSources"]>> }> {
    return { tracks: await this.repository.listTracks(userId), sources: await this.repository.listSources(userId) };
  }
}
