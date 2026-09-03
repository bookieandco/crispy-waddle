import type { MusicDirectorDecision, MusicDirectorJudgment } from "./music-director-judgment.js";
import type { MusicPerceptionMemory } from "./music-perception-memory.js";

export type MusicFeedbackKind = "preference" | "correction" | "approval" | "rejection" | "override";

export interface MusicHumanFeedback {
  id: string;
  sourceArtifactId: string;
  candidateArtifactId?: string;
  judgmentId?: string;
  comparisonId?: string;
  kind: MusicFeedbackKind;
  selectedDecision?: MusicDirectorDecision;
  statement: string;
  region?: { startSample: number; endSample: number };
  evidenceIds: string[];
  confidence: number;
  approvedForLearning: boolean;
  createdAt: string;
  immutableEvidence: true;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const unique = (values: string[]): string[] => [...new Set(values)];

/**
 * Human feedback is training evidence, never an authorization mechanism.
 * It may describe a preference or correct a prior judgment, but it cannot
 * mutate source audio, erase evidence, or bypass restoration policy.
 */
export function createMusicHumanFeedback(input: {
  id: string;
  sourceArtifactId: string;
  candidateArtifactId?: string;
  judgment?: MusicDirectorJudgment;
  comparisonId?: string;
  kind: MusicFeedbackKind;
  selectedDecision?: MusicDirectorDecision;
  statement: string;
  region?: { startSample: number; endSample: number };
  evidenceIds?: string[];
  confidence?: number;
  approvedForLearning: boolean;
  createdAt?: string;
}): MusicHumanFeedback {
  if (!input.statement.trim()) throw new Error("Human feedback statement cannot be empty.");
  if (input.region && (input.region.startSample < 0 || input.region.endSample <= input.region.startSample)) {
    throw new Error("Human feedback region must be a positive sample range.");
  }
  if (input.judgment && input.judgment.sourceArtifactId !== input.sourceArtifactId) {
    throw new Error("Human feedback judgment must reference the same source artifact.");
  }

  return {
    id: input.id,
    sourceArtifactId: input.sourceArtifactId,
    candidateArtifactId: input.candidateArtifactId,
    judgmentId: input.judgment?.id,
    comparisonId: input.comparisonId,
    kind: input.kind,
    selectedDecision: input.selectedDecision,
    statement: input.statement.trim(),
    region: input.region,
    evidenceIds: unique(input.evidenceIds ?? []),
    confidence: clamp01(input.confidence ?? 1),
    approvedForLearning: input.approvedForLearning,
    createdAt: input.createdAt ?? new Date().toISOString(),
    immutableEvidence: true,
  };
}

export function feedbackAsMemory(feedback: MusicHumanFeedback): MusicPerceptionMemory {
  return {
    id: `human-feedback:${feedback.id}`,
    kind: feedback.kind === "correction" || feedback.kind === "override" ? "correction" : "human-preference",
    sourceArtifactId: feedback.sourceArtifactId,
    createdAt: feedback.createdAt,
    statement: feedback.statement,
    evidenceIds: feedback.evidenceIds,
    confidence: feedback.confidence,
    scope: "source-specific",
    approved: feedback.approvedForLearning,
    immutableEvidence: true,
  };
}

/** Approved feedback may inform learning, but never becomes a hard policy rule. */
export function canUseFeedbackForLearning(feedback: MusicHumanFeedback): boolean {
  return feedback.approvedForLearning && feedback.evidenceIds.length > 0 && feedback.immutableEvidence;
}
