import type { ListeningABComparison } from "./listening-ab.js";
import type { MusicHumanFeedback } from "./music-human-feedback.js";
import type { MusicDirectorJudgment } from "./music-director-judgment.js";

export type MusicEvaluationOutcome = "accepted" | "rejected" | "mixed" | "insufficient-evidence";

export interface MusicEvaluationSample {
  id: string;
  sourceArtifactId: string;
  candidateArtifactId?: string;
  comparisonId?: string;
  judgmentId?: string;
  feedbackIds: string[];
  outcome: MusicEvaluationOutcome;
  score: number;
  confidence: number;
  evidenceIds: string[];
  regressions: string[];
  improvements: string[];
}

export interface MusicLearningSignal {
  id: string;
  sourceArtifactId?: string;
  operation?: string;
  signal: "positive" | "negative" | "ambiguous";
  strength: number;
  evidenceIds: string[];
  feedbackIds: string[];
  immutable: true;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const unique = (v: string[]) => [...new Set(v)];

/**
 * Evaluates an existing Director A/B result against approved human feedback.
 * This produces evaluation evidence only; it never promotes a model, changes
 * restoration policy, or authorizes an audio mutation.
 */
export function evaluateMusicOutcome(input: {
  comparison: ListeningABComparison;
  judgment?: MusicDirectorJudgment;
  feedback?: MusicHumanFeedback[];
}): MusicEvaluationSample {
  const feedback = (input.feedback ?? []).filter((f) => f.approvedForLearning && f.immutableEvidence);
  const evidenceIds = unique([...input.comparison.evidenceIds, ...feedback.flatMap((f) => f.evidenceIds)]);
  const positiveFeedback = feedback.filter((f) => f.kind === "approval" || f.kind === "preference").length;
  const negativeFeedback = feedback.filter((f) => f.kind === "rejection" || f.kind === "correction" || f.kind === "override").length;
  const feedbackDelta = positiveFeedback + negativeFeedback === 0 ? 0 : (positiveFeedback - negativeFeedback) / (positiveFeedback + negativeFeedback);
  const objectiveSignal = input.comparison.status === "improved" ? 1 : input.comparison.status === "regressed" ? -1 : 0;
  const score = clamp01(0.5 + 0.25 * objectiveSignal + 0.25 * feedbackDelta);
  const outcome: MusicEvaluationOutcome = input.comparison.abstained || !evidenceIds.length
    ? "insufficient-evidence"
    : score >= 0.65
      ? "accepted"
      : score <= 0.35
        ? "rejected"
        : "mixed";

  return {
    id: `evaluation:${input.comparison.id}`,
    sourceArtifactId: input.comparison.sourceArtifactId,
    candidateArtifactId: input.comparison.candidateArtifactId,
    comparisonId: input.comparison.id,
    judgmentId: input.judgment?.id,
    feedbackIds: feedback.map((f) => f.id),
    outcome,
    score,
    confidence: clamp01(input.comparison.confidence * (feedback.length ? 1 : 0.75)),
    evidenceIds,
    regressions: unique(input.comparison.regressions),
    improvements: unique(input.comparison.improvements),
  };
}

/**
 * Converts an evaluated outcome into a bounded learning signal. Repeated signals
 * may be aggregated by a future evaluator, but cannot become hard policy rules.
 */
export function buildMusicLearningSignal(input: {
  evaluation: MusicEvaluationSample;
  operation?: string;
}): MusicLearningSignal {
  const signal = input.evaluation.outcome === "accepted"
    ? "positive"
    : input.evaluation.outcome === "rejected"
      ? "negative"
      : "ambiguous";
  return {
    id: `learning:${input.evaluation.id}`,
    sourceArtifactId: input.evaluation.sourceArtifactId,
    operation: input.operation,
    signal,
    strength: clamp01(Math.abs(input.evaluation.score - 0.5) * 2 * input.evaluation.confidence),
    evidenceIds: unique(input.evaluation.evidenceIds),
    feedbackIds: unique(input.evaluation.feedbackIds),
    immutable: true,
  };
}
