import type { MusicRepository } from "./repository.js";
import type { SpotifyProvider } from "./spotify-provider.js";

export type SpotifySyncResult = {
  importedTrackIds: string[];
  importedPlaylistIds: string[];
};

/** Imports explicitly authorized Spotify library content into Jhadina's provider-neutral repository. */
export async function syncSpotifyLibrary(
  userId: string,
  provider: SpotifyProvider,
  repository: MusicRepository,
  input: { trackIds?: string[]; playlistIds?: string[] },
): Promise<SpotifySyncResult> {
  const importedTrackIds = new Set<string>();
  const importedPlaylistIds = new Set<string>();

  for (const trackId of input.trackIds ?? []) {
    const track = await provider.importTrack(userId, trackId);
    await repository.upsertTrack(userId, track);
    importedTrackIds.add(track.id);
  }

  for (const playlistId of input.playlistIds ?? []) {
    const playlist = await provider.importPlaylist(userId, playlistId);
    await repository.upsertPlaylist(userId, playlist);
    for (const trackId of playlist.trackIds) importedTrackIds.add(trackId);
    importedPlaylistIds.add(playlist.id);
  }

  return {
    importedTrackIds: [...importedTrackIds],
    importedPlaylistIds: [...importedPlaylistIds],
  };
}
