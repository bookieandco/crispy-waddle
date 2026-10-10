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

type SpotifyTrack = {
  id: string; type?: string; name: string; duration_ms: number; explicit: boolean;
  track_number: number; disc_number: number; external_ids?: { isrc?: string };
  artists: Array<{ id: string; name: string }>;
  album: { id: string; name: string; release_date?: string; images?: Array<{ url: string }>; artists: Array<{ id: string; name: string }> };
};
type SpotifyItems = {
  items: Array<{ item?: SpotifyTrack | null; track?: SpotifyTrack | null }>;
  next?: string | null;
};
type SpotifyPlaylist = { id: string; name: string; items?: SpotifyItems; tracks?: SpotifyItems };

function playlistId(id: string): string {
  if (!/^[A-Za-z0-9]{1,64}$/.test(id)) throw new Error("Invalid Spotify playlist ID");
  return id;
}
function validTrack(item: SpotifyTrack | null | undefined): item is SpotifyTrack {
  return Boolean(item && item.id && item.name && item.artists && item.album && item.type !== "episode");
}
function playlistItems(raw: SpotifyPlaylist): SpotifyItems {
  const items = raw.items ?? raw.tracks;
  if (!items) throw new Error("Spotify playlist items unavailable; access may require owner/collaborator rights");
  if (!Array.isArray(items.items)) throw new Error("Invalid Spotify playlist response");
  return items;
}
function normalizePlaylist(raw: SpotifyPlaylist, ownerUserId: string, items: SpotifyTrack[]): Playlist {
  return { id: `spotify:playlist:${raw.id}`, name: raw.name, ownerUserId, sourceId: "spotify",
    trackIds: [...new Set(items.map(item => `spotify:track:${item.id}`))] };
}

export class SpotifyWebApiProvider implements SpotifyProvider {
  private readonly baseUrl: string;
  constructor(private readonly config: SpotifyProviderConfig, private readonly token: SpotifyToken, private readonly repository?: MusicRepository) {
    this.baseUrl = (config.apiBaseUrl ?? "https://api.spotify.com/v1").replace(/\/$/, "");
  }
  authorizationUrl(state: string) {
    if (!state) throw new Error("Spotify OAuth state is required");
    const scopes = this.config.scopes ?? ["user-read-private", "user-library-read", "playlist-read-private", "playlist-read-collaborative", "user-read-recently-played"];
    return `https://accounts.spotify.com/authorize?${new URLSearchParams({ response_type: "code", client_id: this.config.clientId, redirect_uri: this.config.redirectUri, scope: scopes.join(" "), state })}`;
  }
  async getTrack(id: string) { return normalizeTrack(await this.request<SpotifyTrack>(`/tracks/${encodeURIComponent(id)}`)); }
  async getPlaylist(id: string) {
    const raw = await this.request<SpotifyPlaylist>(`/playlists/${playlistId(id)}`);
    return normalizePlaylist(raw, "spotify", await this.readPlaylistItems(id, raw));
  }
  async importTrack(userId: string, id: string) {
    if (!this.repository) throw new Error("MusicRepository is required for import operations");
    const raw = await this.request<SpotifyTrack>(`/tracks/${encodeURIComponent(id)}`);
    if (!validTrack(raw)) throw new Error("Spotify track metadata is unavailable");
    await this.persistTrack(userId, raw);
    return normalizeTrack(raw);
  }
  async importPlaylist(userId: string, id: string) {
    if (!this.repository) throw new Error("MusicRepository is required for import operations");
    const raw = await this.request<SpotifyPlaylist>(`/playlists/${playlistId(id)}`);
    const allItems = await this.readPlaylistItems(id, raw); // Fetch full access-granted catalog before writing.
    await this.repository.upsertSource(spotifySource(userId));
    for (const item of allItems) await this.persistTrack(userId, item);
    return this.repository.upsertPlaylist(userId, normalizePlaylist(raw, userId, allItems));
  }
  private async readPlaylistItems(id: string, playlist: SpotifyPlaylist): Promise<SpotifyTrack[]> {
    const items = playlistItems(playlist);
    const all = items.items.map(record => record.item ?? record.track).filter(validTrack);
    let next = items.next;
    const seen = new Set<string>();
    // Finite/capped metadata import: never silently truncate an oversized playlist.
    for (let page = 0; next; page++) {
      if (page >= 40 || all.length > 2000) throw new Error("Spotify playlist exceeds safe import limit");
      const url = new URL(next);
      const expected = new URL(this.baseUrl);
      const path = `${expected.pathname}/playlists/${playlistId(id)}/items`;
      if (url.origin !== expected.origin || url.pathname !== path || seen.has(url.toString())) {
        throw new Error("Invalid Spotify pagination URL");
      }
      seen.add(url.toString());
      const pageItems = await this.request<SpotifyItems>(url.pathname.slice(expected.pathname.length) + url.search);
      if (!Array.isArray(pageItems.items)) throw new Error("Invalid Spotify pagination response");
      all.push(...pageItems.items.map(item => item.item ?? item.track).filter(validTrack));
      next = pageItems.next;
    }
    if (all.length > 2000) throw new Error("Spotify playlist exceeds safe import limit");
    return all;
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
    if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Invalid Spotify API path");
    const response = await fetch(`${this.baseUrl}${path}`, { headers: { Authorization: `Bearer ${this.token.accessToken}` } });
    if (!response.ok) throw new Error(`Spotify API request failed: ${response.status}`);
    return response.json() as Promise<T>;
  }
}
// A catalog-only Spotify import grants no raw media streaming, offline, analysis, or redistribution rights.
function spotifySource(userId: string): MusicSource {
  return { id: "spotify", userId, kind: "spotify", name: "Spotify", authorized: false,
    metadata: { provider: "spotify", role: "catalog-library" } };
}
function normalizeArtist(raw: { id: string; name: string }): Artist {
  return { id: `spotify:artist:${raw.id}`, name: raw.name, externalIds: { spotify: raw.id } };
}
function normalizeAlbum(raw: SpotifyTrack["album"]): Album {
  return { id: `spotify:album:${raw.id}`, title: raw.name,
    artistIds: raw.artists.map(a => `spotify:artist:${a.id}`),
    releaseDate: raw.release_date, artworkId: raw.images?.[0]?.url ? `artwork:${raw.images[0].url}` : undefined,
    externalIds: { spotify: raw.id } };
}
function normalizeTrack(raw: SpotifyTrack): Track {
  return { id: `spotify:track:${raw.id}`, title: raw.name,
    artistIds: raw.artists.map(a => `spotify:artist:${a.id}`), albumId: `spotify:album:${raw.album.id}`,
    durationMs: raw.duration_ms, trackNumber: raw.track_number, discNumber: raw.disc_number,
    isrc: raw.external_ids?.isrc, explicit: raw.explicit,
    artworkId: raw.album.images?.[0]?.url ? `artwork:${raw.album.images[0].url}` : undefined,
    externalIds: { spotify: raw.id } };
}
