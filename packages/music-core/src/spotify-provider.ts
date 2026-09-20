import type { Album, Artist, MusicSource, Playlist, Track } from "./types.js";
import type { MusicRepository } from "./repository.js";

export interface SpotifyProviderConfig { clientId: string; redirectUri: string; scopes?: string[]; apiBaseUrl?: string; }
export interface SpotifyToken { accessToken: string; expiresAt?: number; }
export interface SpotifyProvider {
  authorizationUrl(state: string): string;
  getTrack(providerTrackId: string): Promise<Track>;
  getPlaylist(providerPlaylistId: string): Promise<Playlist>;
  importTrack(userId: string, providerTrackId: string): Promise<Track>;
  importPlaylist(userId: string, providerPlaylistId: string): Promise<Playlist>;
}
type SpotifyTrack = { id: string; name: string; duration_ms: number; explicit: boolean; track_number: number; disc_number: number; external_ids?: { isrc?: string }; artists: Array<{ id: string; name: string }>; album: { id: string; name: string; release_date?: string; images?: Array<{ url: string }>; artists: Array<{ id: string; name: string }> } };
type SpotifyPlaylist = { id: string; name: string; tracks: { items: Array<{ track: SpotifyTrack | null }> } };

export class SpotifyWebApiProvider implements SpotifyProvider {
  private readonly baseUrl: string;
  constructor(private readonly config: SpotifyProviderConfig, private readonly token: SpotifyToken, private readonly repository?: MusicRepository) { this.baseUrl = config.apiBaseUrl ?? "https://api.spotify.com/v1"; }
  authorizationUrl(state: string) {
    if (!state) throw new Error("Spotify OAuth state is required");
    const scopes = this.config.scopes ?? ["user-read-private", "user-library-read", "playlist-read-private", "playlist-read-collaborative", "user-read-recently-played"];
    return `https://accounts.spotify.com/authorize?${new URLSearchParams({ response_type: "code", client_id: this.config.clientId, redirect_uri: this.config.redirectUri, scope: scopes.join(" "), state })}`;
  }
  async getTrack(id: string) { return normalizeTrack(await this.request<SpotifyTrack>(`/tracks/${encodeURIComponent(id)}`)); }
  async getPlaylist(id: string) { return normalizePlaylist(await this.request<SpotifyPlaylist>(`/playlists/${encodeURIComponent(id)}`), "spotify"); }
  async importTrack(userId: string, id: string) {
    if (!this.repository) throw new Error("MusicRepository is required for import operations");
    const raw = await this.request<SpotifyTrack>(`/tracks/${encodeURIComponent(id)}`);
    await this.persistTrack(userId, raw); return normalizeTrack(raw);
  }
  async importPlaylist(userId: string, id: string) {
    if (!this.repository) throw new Error("MusicRepository is required for import operations");
    const raw = await this.request<SpotifyPlaylist>(`/playlists/${encodeURIComponent(id)}`);
    await this.repository.upsertSource(spotifySource(userId));
    for (const item of raw.tracks.items) if (item.track) await this.persistTrack(userId, item.track);
    return this.repository.upsertPlaylist(userId, normalizePlaylist(raw, userId));
  }
  private async persistTrack(userId: string, raw: SpotifyTrack) {
    if (!this.repository) throw new Error("MusicRepository is required for import operations");
    await this.repository.upsertSource(spotifySource(userId));
    for (const artist of raw.artists) await this.repository.upsertArtist(userId, normalizeArtist(artist));
    await this.repository.upsertAlbum(userId, normalizeAlbum(raw.album));
    return this.repository.upsertTrack(userId, normalizeTrack(raw));
  }
  private async request<T>(path: string): Promise<T> {
    if (!this.token.accessToken) throw new Error("Spotify access token is required");
    if (this.token.expiresAt && this.token.expiresAt <= Date.now()) throw new Error("Spotify access token is expired");
    const response = await fetch(`${this.baseUrl}${path}`, { headers: { Authorization: `Bearer ${this.token.accessToken}` } });
    if (!response.ok) throw new Error(`Spotify API request failed: ${response.status}`);
    return response.json() as Promise<T>;
  }
}
function spotifySource(userId: string): MusicSource { return { id: "spotify", userId, kind: "spotify", name: "Spotify", authorized: true, metadata: { provider: "spotify", role: "catalog-library" } }; }
function normalizeArtist(raw: { id: string; name: string }): Artist { return { id: `spotify:artist:${raw.id}`, name: raw.name, externalIds: { spotify: raw.id } }; }
function normalizeAlbum(raw: SpotifyTrack["album"]): Album { return { id: `spotify:album:${raw.id}`, title: raw.name, artistIds: raw.artists.map(a => `spotify:artist:${a.id}`), releaseDate: raw.release_date, artworkId: raw.images?.[0]?.url ? `artwork:${raw.images[0].url}` : undefined, externalIds: { spotify: raw.id } }; }
function normalizeTrack(raw: SpotifyTrack): Track { return { id: `spotify:track:${raw.id}`, title: raw.name, artistIds: raw.artists.map(a => `spotify:artist:${a.id}`), albumId: `spotify:album:${raw.album.id}`, durationMs: raw.duration_ms, trackNumber: raw.track_number, discNumber: raw.disc_number, isrc: raw.external_ids?.isrc, explicit: raw.explicit, artworkId: raw.album.images?.[0]?.url ? `artwork:${raw.album.images[0].url}` : undefined, externalIds: { spotify: raw.id } }; }
function normalizePlaylist(raw: SpotifyPlaylist, ownerUserId: string): Playlist { return { id: `spotify:playlist:${raw.id}`, name: raw.name, ownerUserId, sourceId: "spotify", trackIds: raw.tracks.items.flatMap(item => item.track ? [`spotify:track:${item.track.id}`] : []) }; }
