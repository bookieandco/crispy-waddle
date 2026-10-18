import type { Album, Artist, Track } from "./types.js";

export interface MusicSearchResult {
  track: Track;
  score: number;
  matchedOn: string[];
  artistName?: string;
  albumName?: string;
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export interface MusicSearchContext { artists?: Artist[]; albums?: Album[]; }

export function searchTracks(tracks: Track[], query: string, context: MusicSearchContext = {}): MusicSearchResult[] {
  const q = normalize(query);
  if (!q) return [];
  const artists = new Map((context.artists ?? []).map(artist => [artist.id, artist.name]));
  const albums = new Map((context.albums ?? []).map(album => [album.id, album.title]));
  return tracks
    .map((track) => {
      const title = normalize(track.title);
      const ids = track.externalIds ? Object.values(track.externalIds).map(normalize) : [];
      const artistNames = track.artistIds.map(id => artists.get(id)).filter((name): name is string => Boolean(name));
      const albumName = track.albumId ? albums.get(track.albumId) : undefined;
      const matchedOn: string[] = [];
      let score = 0;
      if (title === q) { score += 1; matchedOn.push("title"); }
      else if (title.includes(q)) { score += 0.7; matchedOn.push("title"); }
      if (artistNames.some(name => normalize(name) === q)) { score += 0.85; matchedOn.push("artist"); }
      else if (artistNames.some(name => normalize(name).includes(q))) { score += 0.65; matchedOn.push("artist"); }
      if (albumName && normalize(albumName) === q) { score += 0.7; matchedOn.push("album"); }
      else if (albumName && normalize(albumName).includes(q)) { score += 0.5; matchedOn.push("album"); }
      if (ids.some(id => id === q || id.includes(q))) { score += 0.8; matchedOn.push("externalId"); }
      return { track, score, matchedOn,
        artistName: artistNames.join(" · ") || undefined, albumName };
    })
    .filter(result => result.score > 0)
    .sort((a,b) => b.score - a.score || a.track.title.localeCompare(b.track.title));
}
