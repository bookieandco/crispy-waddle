import type { Track } from "./types.js";

export interface MusicSearchResult {
  track: Track;
  score: number;
  matchedOn: string[];
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function searchTracks(tracks: Track[], query: string): MusicSearchResult[] {
  const q = normalize(query);
  if (!q) return [];

  return tracks
    .map((track) => {
      const title = normalize(track.title);
      const ids = track.externalIds ? Object.values(track.externalIds).map(normalize) : [];
      const matchedOn: string[] = [];
      let score = 0;
      if (title === q) { score += 1; matchedOn.push("title"); }
      else if (title.includes(q)) { score += 0.7; matchedOn.push("title"); }
      if (ids.some((id) => id === q || id.includes(q))) { score += 0.8; matchedOn.push("externalId"); }
      return { track, score, matchedOn };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score);
}
