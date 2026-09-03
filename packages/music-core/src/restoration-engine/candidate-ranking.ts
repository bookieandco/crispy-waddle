import type { RestorationCandidate, RestorationEvidence } from "./types.js";

export interface CandidateScore {
  candidateId: string;
  score: number;
  reasons: string[];
}

/** Conservative baseline ranking. Higher evidence confidence and lower generative risk win. */
export function rankRestorationCandidates(
  candidates: readonly RestorationCandidate[],
  evidence: readonly RestorationEvidence[],
): readonly CandidateScore[] {
  const confidence = evidence.length
    ? evidence.reduce((sum, item) => sum + item.confidence, 0) / evidence.length
    : 0;

  return candidates
    .map((candidate) => {
      const generativePenalty =
        candidate.provenance === "synthetic" ? 0.35 :
        candidate.provenance === "reconstructed" ? 0.2 :
        candidate.provenance === "external" ? 0.15 : 0;
      const score = Math.max(0, Math.min(1, confidence - generativePenalty));
      return {
        candidateId: candidate.id,
        score,
        reasons: [
          `evidence-confidence=${confidence.toFixed(3)}`,
          `generative-penalty=${generativePenalty.toFixed(2)}`,
        ],
      };
    })
    .sort((a, b) => b.score - a.score);
}
