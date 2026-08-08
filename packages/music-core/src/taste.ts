import type { Track } from "./types.js";

export interface TasteObservation {
  dimension: "artist" | "genre" | "era" | "explicitness" | "track_style";
  value: string;
  score: number;
  evidenceTrackIds: string[];
  explanation: string;
}

export interface TasteProfile {
  userId: string;
  observations: TasteObservation[];
  generatedAt: string;
  sourceIds: string[];
}

const normalize = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function buildTasteProfile(
  userId: string,
  tracks: Track[],
  sourceIds: string[] = [],
): TasteProfile {
  const artistCounts = new Map<string, string[]>();
  const explicitCounts = { explicit: [] as string[], clean: [] as string[] };

  for (const track of tracks) {
    for (const artistId of track.artistIds) {
      const ids = artistCounts.get(artistId) ?? [];
      ids.push(track.id);
      artistCounts.set(artistId, ids);
    }
    explicitCounts[track.explicit ? "explicit" : "clean"].push(track.id);
  }

  const observations: TasteObservation[] = [];
  for (const [artist, evidenceTrackIds] of artistCounts) {
    observations.push({
      dimension: "artist",
      value: normalize(artist),
      score: evidenceTrackIds.length / Math.max(tracks.length, 1),
      evidenceTrackIds,
      explanation: `Artist appears across ${evidenceTrackIds.length} sampled track(s).`,
    });
  }

  for (const [value, evidenceTrackIds] of Object.entries(explicitCounts)) {
    if (!evidenceTrackIds.length) continue;
    observations.push({
      dimension: "explicitness",
      value,
      score: evidenceTrackIds.length / Math.max(tracks.length, 1),
      evidenceTrackIds,
      explanation: `${Math.round((evidenceTrackIds.length / tracks.length) * 100)}% of sampled tracks are ${value}.`,
    });
  }

  return { userId, observations, generatedAt: new Date().toISOString(), sourceIds };
}
