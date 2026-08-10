import { rankContinuity, type ContinuityCandidate, type ContinuityScore } from './continuity-qc.js';
import type { ContinuityManifest } from './continuity-manifest.js';

export type RankedCandidate = ContinuityScore & {
  rank: number;
  variation?: string;
  provider?: string;
  providerJobId?: string;
};

export function rankCandidates(previous: ContinuityManifest, candidates: Array<ContinuityCandidate & { variation?: string; provider?: string; providerJobId?: string }>): RankedCandidate[] {
  const ranked = rankContinuity(previous, candidates);
  const byId = new Map(candidates.map((candidate) => [candidate.takeId, candidate]));
  return ranked.map((score, index) => {
    const source = byId.get(score.takeId);
    return { ...score, rank: index + 1, variation: source?.variation, provider: source?.provider, providerJobId: source?.providerJobId };
  });
}

export function summarizeRanking(candidate: RankedCandidate) {
  return `${candidate.rank}. ${candidate.takeId} — ${candidate.score}% continuity${candidate.changed.length ? `; changed: ${candidate.changed.join(', ')}` : '; no locked dimensions changed'}`;
}
