import type { Track } from "./types.js";
import type { DiscoveryPreferences, DiscoveryResult } from "./discovery.js";

export type SmartMixTuning = {
  artistVariety: number;
  discovery: number;
  mood?: string;
  bpm?: { min?: number; max?: number };
};

export type SmartMixSeed = {
  track?: Track;
  artists?: string[];
  genres?: string[];
  recentTrackIds?: string[];
};

export type SmartMix = {
  id: string;
  title: string;
  description: string;
  tracks: DiscoveryResult[];
  tuning: SmartMixTuning;
};

export function createSmartMix(seed: SmartMixSeed, candidates: DiscoveryResult[], tuning: SmartMixTuning = { artistVariety: 0.5, discovery: 0.35 }): SmartMix {
  const seedArtist = seed.track?.artistIds?.[0];
  const artists = new Set(seed.artists ?? []);
  if (seedArtist) artists.add(seedArtist);

  const ranked = candidates
    .map((candidate, index) => {
      let score = candidate.confidence ?? 0.5;
      if (seedArtist && candidate.artist === seedArtist) score += (1 - tuning.artistVariety) * 0.35;
      if (candidate.discoveryReason === "similarity") score += tuning.discovery * 0.25;
      score -= Math.max(0, index - 8) * 0.002;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score);

  const seenArtists = new Set<string>();
  const tracks: DiscoveryResult[] = [];
  for (const { candidate } of ranked) {
    const artist = candidate.artist;
    const penalty = seenArtists.has(artist) ? tuning.artistVariety : 0;
    if (tracks.length >= 30) break;
    if (penalty > 0.75 && tracks.length < 10) continue;
    tracks.push(candidate);
    seenArtists.add(artist);
  }

  const title = seed.track ? `Mix for ${seed.track.title}` : seedArtist ? `Mix for ${seedArtist}` : "Your Jhadina Mix";
  return { id: `jhadina-mix-${Date.now()}`, title, description: buildDescription(seed, tuning), tracks, tuning };
}

export function buildSmartMixPreferences(seed: SmartMixSeed, tuning: SmartMixTuning): DiscoveryPreferences {
  return {
    seed: seed.track?.title,
    artists: [...new Set([...(seed.artists ?? []), ...(seed.track?.artistIds ?? [])])],
    genres: seed.genres,
    includeDeepCuts: tuning.discovery > 0.45,
    includeLive: tuning.discovery > 0.7,
    includeRemixes: tuning.discovery > 0.6,
  };
}

function buildDescription(seed: SmartMixSeed, tuning: SmartMixTuning): string {
  const anchor = seed.track?.title ?? seed.artists?.[0] ?? "your listening";
  const mode = tuning.discovery >= 0.65 ? "with room to discover something new" : tuning.discovery <= 0.2 ? "with familiar favorites" : "with a mix of favorites and discoveries";
  return `Built around ${anchor}, ${mode}.`;
}
