import type { MatchResult, Track, MediaAsset } from "./types.js";

export function matchTrack(track: Track, assets: MediaAsset[]): MatchResult {
  const candidates = assets.map((asset) => {
    let score = 0;
    const reasons: string[] = [];
    if (track.isrc && asset.provenance?.isrc === track.isrc) { score += 0.6; reasons.push("ISRC match"); }
    if (track.durationMs && asset.durationMs) {
      const delta = Math.abs(track.durationMs - asset.durationMs);
      if (delta <= 1000) { score += 0.3; reasons.push("duration within 1s"); }
      else if (delta <= 3000) { score += 0.15; reasons.push("duration within 3s"); }
    }
    if (asset.provenance?.title === track.title) { score += 0.05; reasons.push("title match"); }
    if (Array.isArray(asset.provenance?.artistIds) && track.artistIds.every((id) => (asset.provenance?.artistIds as string[]).includes(id))) { score += 0.05; reasons.push("artist match"); }
    return { assetId: asset.id, score: Math.min(score, 1), reasons };
  }).sort((a, b) => b.score - a.score);
  return { trackId: track.id, candidates };
}
