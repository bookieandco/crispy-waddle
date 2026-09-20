import type { MusicRepository } from "./repository.js";
import type { Playlist, Track } from "./types.js";
import type { SpotifyProvider } from "./spotify-provider.js";

/** Imports Spotify metadata into the same provider-neutral repository used by other Music sources. */
export class SpotifyLibrarySync {
  constructor(private readonly provider: SpotifyProvider, private readonly repository: MusicRepository) {}
  importTrack(userId: string, providerTrackId: string): Promise<Track> { return this.provider.importTrack(userId, providerTrackId); }
  importPlaylist(userId: string, providerPlaylistId: string): Promise<Playlist> { return this.provider.importPlaylist(userId, providerPlaylistId); }
  async syncTracks(userId: string, ids: string[]) { let count=0; for (const id of new Set(ids)) { await this.provider.importTrack(userId,id); count++; } return count; }
  async syncPlaylists(userId: string, ids: string[]) { let count=0; for (const id of new Set(ids)) { await this.provider.importPlaylist(userId,id); count++; } return count; }
  async snapshot(userId: string) { return { tracks: await this.repository.listTracks(userId), sources: await this.repository.listSources(userId) }; }
}
