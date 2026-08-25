import type { Album, Artist, MusicRepository, MusicSource, Playlist, Track } from "./index-internal.js";

export interface SpotifyProviderConfig {
  clientId: string;
  redirectUri: string;
  scopes?: string[];
  apiBaseUrl?: string;
}

export interface SpotifyToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface SpotifyProvider {
  authorizationUrl(state: string): string;
  getTrack(trackId: string): Promise<Track>;
  getPlaylist(playlistId: string): Promise<Playlist>;
  importTrack(userId: string, trackId: string): Promise<Track>;
  importPlaylist(userId: string, playlistId: string): Promise<Playlist>;
}

type SpotifyTrack = {
  id: string;
  name: string;
  duration_ms: number;
  explicit: boolean;
  track_number: number;
  disc_number: number;
  external_ids?: { isrc?: string };
  artists: Array<{ id: string; name: string }>; 
  album: { id: string; name: string; release_date?: string; images?: Array<{ url: string; width?: number; height?: number }>; artists: Array<{ id: string; name: string }> };
};

type SpotifyPlaylist = {
  id: string;
  name: string;
  owner?: { id?: string };
  tracks: { items: Array<{ track: SpotifyTrack | null }> };
};

export class SpotifyWebApiProvider implements SpotifyProvider {
  private readonly baseUrl: string;

  constructor(
    private readonly config: SpotifyProviderConfig,
    private readonly token: SpotifyToken,
    private readonly repository?: MusicRepository,
  ) {
    this.baseUrl = config.apiBaseUrl ?? "https://api.spotify.com/v1";
  }

  authorizationUrl(state: string): string {
    const scopes = this.config.scopes ?? [
      "user-read-private",
      "user-library-read",
      "playlist-read-private",
      "playlist-read-collaborative",
      "user-read-recently-played",
    ];
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(" "),
      state,
    });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async getTrack(trackId: string): Promise<Track> {
    const raw = await this.request<SpotifyTrack>(`/tracks/${encodeURIComponent(trackId)}`);
    return normalizeTrack(raw);
  }

  async getPlaylist(playlistId: string): Promise<Playlist> {
    const raw = await this.request<SpotifyPlaylist>(`/playlists/${encodeURIComponent(playlistId)}`);
    return normalizePlaylist(raw);
  }

  async importTrack(userId: string, trackId: string): Promise<Track> {
    if (!this.repository) throw new Error("MusicRepository is required for import operations");
    const raw = await this.request<SpotifyTrack>(`/tracks/${encodeURIComponent(trackId)}`);
    const track = normalizeTrack(raw);
    await this.repository.upsertSource(spotifySource(userId));
    for (const artist of raw.artists) await this.repository.upsertArtist(userId, normalizeArtist(artist));
    await this.repository.upsertAlbum(userId, normalizeAlbum(raw.album));
    return this.repository.upsertTrack(userId, track);
  }

  async importPlaylist(userId: string, playlistId: string): Promise<Playlist> {
    if (!this.repository) throw new Error("MusicRepository is required for import operations");
    const raw = await this.request<SpotifyPlaylist>(`/playlists/${encodeURIComponent(playlistId)}`);
    const tracks = raw.tracks.items.map((item) => item.track).filter((track): track is SpotifyTrack => Boolean(track));
    await this.repository.upsertSource(spotifySource(userId));
    for (const rawTrack of tracks) {
      for (const artist of rawTrack.artists) await this.repository.upsertArtist(userId, normalizeArtist(artist));
      await this.repository.upsertAlbum(userId, normalizeAlbum(rawTrack.album));
      await this.repository.upsertTrack(userId, normalizeTrack(rawTrack));
    }
    return this.repository.upsertPlaylist(userId, normalizePlaylist(raw));
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.token.accessToken}` },
    });
    if (!response.ok) throw new Error(`Spotify API request failed: ${response.status}`);
    return response.json() as Promise<T>;
  }
}

function spotifySource(userId: string): MusicSource {
  return {
    id: "spotify",
    userId,
    kind: "spotify",
    name: "Spotify",
    authorized: true,
    metadata: { provider: "spotify" },
  };
}

function normalizeArtist(raw: { id: string; name: string }): Artist {
  return { id: `spotify:artist:${raw.id}`, name: raw.name, externalIds: { spotify: raw.id } };
}

function normalizeAlbum(raw: SpotifyTrack["album"]): Album {
  return {
    id: `spotify:album:${raw.id}`,
    title: raw.name,
    artistIds: raw.artists.map((artist) => `spotify:artist:${artist.id}`),
    releaseDate: raw.release_date,
    artworkId: raw.images?.[0]?.url ? `artwork:${raw.images[0].url}` : undefined,
    externalIds: { spotify: raw.id },
  };
}

function normalizeTrack(raw: SpotifyTrack): Track {
  return {
    id: `spotify:track:${raw.id}`,
    title: raw.name,
    artistIds: raw.artists.map((artist) => `spotify:artist:${artist.id}`),
    albumId: `spotify:album:${raw.album.id}`,
    durationMs: raw.duration_ms,
    trackNumber: raw.track_number,
    discNumber: raw.disc_number,
    isrc: raw.external_ids?.isrc,
    explicit: raw.explicit,
    artworkId: raw.album.images?.[0]?.url ? `artwork:${raw.album.images[0].url}` : undefined,
    externalIds: { spotify: raw.id },
  };
}

function normalizePlaylist(raw: SpotifyPlaylist): Playlist {
  return {
    id: `spotify:playlist:${raw.id}`,
    name: raw.name,
    ownerUserId: raw.owner?.id ?? "spotify",
    sourceId: "spotify",
    trackIds: raw.tracks.items.filter((item) => item.track).map((item) => `spotify:track:${item.track!.id}`),
  };
}
