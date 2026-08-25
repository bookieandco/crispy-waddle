import type { Album, Artist, Playlist, Track } from "./types.js";

export interface MusicLibraryState {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
  favoriteTrackIds: string[];
  recentlyPlayedTrackIds: string[];
  downloadedTrackIds: string[];
}

export function createMusicLibraryState(): MusicLibraryState {
  return {
    tracks: [],
    albums: [],
    artists: [],
    playlists: [],
    favoriteTrackIds: [],
    recentlyPlayedTrackIds: [],
    downloadedTrackIds: [],
  };
}

export function upsertTracks(state: MusicLibraryState, tracks: Track[]): MusicLibraryState {
  const byId = new Map(state.tracks.map((track) => [track.id, track]));
  for (const track of tracks) byId.set(track.id, track);
  return { ...state, tracks: [...byId.values()] };
}

export function upsertAlbums(state: MusicLibraryState, albums: Album[]): MusicLibraryState {
  const byId = new Map(state.albums.map((album) => [album.id, album]));
  for (const album of albums) byId.set(album.id, album);
  return { ...state, albums: [...byId.values()] };
}

export function upsertArtists(state: MusicLibraryState, artists: Artist[]): MusicLibraryState {
  const byId = new Map(state.artists.map((artist) => [artist.id, artist]));
  for (const artist of artists) byId.set(artist.id, artist);
  return { ...state, artists: [...byId.values()] };
}

export function upsertPlaylists(state: MusicLibraryState, playlists: Playlist[]): MusicLibraryState {
  const byId = new Map(state.playlists.map((playlist) => [playlist.id, playlist]));
  for (const playlist of playlists) byId.set(playlist.id, playlist);
  return { ...state, playlists: [...byId.values()] };
}

export function toggleFavorite(state: MusicLibraryState, trackId: string): MusicLibraryState {
  const favoriteTrackIds = state.favoriteTrackIds.includes(trackId)
    ? state.favoriteTrackIds.filter((id) => id !== trackId)
    : [...state.favoriteTrackIds, trackId];
  return { ...state, favoriteTrackIds };
}

export function recordPlayed(state: MusicLibraryState, trackId: string, max = 50): MusicLibraryState {
  const recentlyPlayedTrackIds = [trackId, ...state.recentlyPlayedTrackIds.filter((id) => id !== trackId)].slice(0, max);
  return { ...state, recentlyPlayedTrackIds };
}

export function markDownloaded(state: MusicLibraryState, trackId: string): MusicLibraryState {
  return state.downloadedTrackIds.includes(trackId)
    ? state
    : { ...state, downloadedTrackIds: [...state.downloadedTrackIds, trackId] };
}
