import type { Album, Artist, Artwork, ListeningEvent, Lyrics, MediaAsset, MusicSource, Playlist, Track } from "./types.js";

export interface MusicRepository {
  getTrack(userId: string, trackId: string): Promise<Track | null>;
  upsertTrack(userId: string, track: Track): Promise<Track>;
  listTracks(userId: string): Promise<Track[]>;
  upsertArtist(userId: string, artist: Artist): Promise<Artist>;
  upsertAlbum(userId: string, album: Album): Promise<Album>;
  upsertPlaylist(userId: string, playlist: Playlist): Promise<Playlist>;
  upsertSource(source: MusicSource): Promise<MusicSource>;
  listSources(userId: string): Promise<MusicSource[]>;
  addAsset(userId: string, asset: MediaAsset): Promise<MediaAsset>;
  listAssets(userId: string, trackId: string): Promise<MediaAsset[]>;
  upsertArtwork(userId: string, artwork: Artwork): Promise<Artwork>;
  upsertLyrics(userId: string, lyrics: Lyrics): Promise<Lyrics>;
  recordListeningEvent(event: ListeningEvent): Promise<ListeningEvent>;
}

export class InMemoryMusicRepository implements MusicRepository {
  private tracks = new Map<string, Track>();
  private artists = new Map<string, Artist>();
  private albums = new Map<string, Album>();
  private playlists = new Map<string, Playlist>();
  private sources = new Map<string, MusicSource>();
  private assets = new Map<string, MediaAsset>();
  private artwork = new Map<string, Artwork>();
  private lyrics = new Map<string, Lyrics>();
  private listening = new Map<string, ListeningEvent>();
  private key(userId: string, id: string) { return `${userId}:${id}`; }
  private assertUser(userId: string, ownerId: string) { if (userId !== ownerId) throw new Error("User scope violation"); }
  async getTrack(userId: string, trackId: string) { return this.tracks.get(this.key(userId, trackId)) ?? null; }
  async upsertTrack(userId: string, track: Track) { const copy = structuredClone(track); this.tracks.set(this.key(userId, track.id), copy); return copy; }
  async listTracks(userId: string) { return [...this.tracks.entries()].filter(([k]) => k.startsWith(`${userId}:`)).map(([,v]) => structuredClone(v)); }
  async upsertArtist(userId: string, artist: Artist) { const copy = structuredClone(artist); this.artists.set(this.key(userId, artist.id), copy); return copy; }
  async upsertAlbum(userId: string, album: Album) { const copy = structuredClone(album); this.albums.set(this.key(userId, album.id), copy); return copy; }
  async upsertPlaylist(userId: string, playlist: Playlist) { this.assertUser(userId, playlist.ownerUserId); const copy = structuredClone(playlist); this.playlists.set(this.key(userId, playlist.id), copy); return copy; }
  async upsertSource(source: MusicSource) { const copy = structuredClone(source); this.sources.set(this.key(source.userId, source.id), copy); return copy; }
  async listSources(userId: string) { return [...this.sources.entries()].filter(([k]) => k.startsWith(`${userId}:`)).map(([,v]) => structuredClone(v)); }
  async addAsset(userId: string, asset: MediaAsset) { const copy = structuredClone(asset); this.assets.set(this.key(userId, asset.id), copy); return copy; }
  async listAssets(userId: string, trackId: string) { return [...this.assets.entries()].filter(([k,v]) => k.startsWith(`${userId}:`) && v.trackId === trackId).map(([,v]) => structuredClone(v)); }
  async upsertArtwork(userId: string, artwork: Artwork) { const copy = structuredClone(artwork); this.artwork.set(this.key(userId, artwork.id), copy); return copy; }
  async upsertLyrics(userId: string, lyrics: Lyrics) { const copy = structuredClone(lyrics); this.lyrics.set(this.key(userId, lyrics.id), copy); return copy; }
  async recordListeningEvent(event: ListeningEvent) { const copy = structuredClone(event); this.listening.set(this.key(event.userId, event.id), copy); return copy; }
}
