import type { RestorationCandidate, RestorationPlan, RestorationQcResult } from "./types.js";
import type { ListeningABComparison } from "./listening-ab.js";

export type MusicDirectorDecision = "keep-original" | "restore" | "replace" | "review" | "abstain";

export interface MusicDirectorJudgment {
  id: string;
  planId: string;
  candidateId?: string;
  sourceArtifactId: string;
  candidateArtifactId?: string;
  decision: MusicDirectorDecision;
  confidence: number;
  evidenceIds: string[];
  reasons: string[];
  hardConstraintFailures: string[];
  requiresHumanReview: boolean;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const unique = (values: string[]): string[] => [...new Set(values)];

function candidate(plan: RestorationPlan, candidateId?: string): RestorationCandidate | undefined {
  return candidateId ? plan.candidates.find((item) => item.id === candidateId) : undefined;
}

/**
 * Converts A/B evidence into a conservative director decision.
 * This layer may choose keep/restore/replace/review/abstain, but it never renders audio.
 */
export function judgeMusicRestoration(input: {
  plan: RestorationPlan;
  comparison: ListeningABComparison;
  candidateId?: string;
  qc?: RestorationQcResult;
}): MusicDirectorJudgment {
  const c = candidate(input.plan, input.candidateId);
  const failures: string[] = [];
  const reasons: string[] = [];

  if (!c) failures.push("Candidate is missing from the restoration plan.");
  if (c && c.operationClass === "production") failures.push("Production operations cannot be judged as restoration.");
  if (c && c.operationClass === "simulation") failures.push("Simulation output cannot be promoted as historical restoration.");
  if (input.comparison.abstained || input.comparison.status === "insufficient-evidence") failures.push("A/B evidence is insufficient.");
  if (input.comparison.sourceArtifactId !== input.plan.candidates.find((x) => x.id === c?.id)?.inputArtifactId && c) failures.push("Candidate input does not match the planned source artifact.");
  if (input.qc && (!input.qc.passed || !input.qc.conservationPassed || !input.qc.authenticityPassed || !input.qc.artifactFree)) failures.push("QC gate has not passed all mandatory restoration checks.");
  if (input.plan.requiresApproval) reasons.push("Restoration plan requires approval.");

  const evidence = unique(input.comparison.evidenceIds);
  const confidence = clamp01(Math.min(input.comparison.confidence, evidence.length ? 1 : 0));
  const regressions = input.comparison.regressions.length;
  const improvements = input.comparison.improvements.length;

  let decision: MusicDirectorDecision = "abstain";
  if (failures.length > 0) {
    decision = input.comparison.abstained ? "abstain" : "review";
  } else if (input.plan.requiresApproval || input.comparison.status === "changed" || regressions > 0) {
    decision = "review";
  } else if (improvements > 0 && input.comparison.status === "improved") {
    decision = c?.operation === "instrument-replacement" ? "replace" : "restore";
  } else if (input.comparison.status === "unchanged") {
    decision = "keep-original";
  } else {
    decision = "review";
  }

  if (decision === "restore" || decision === "replace") {
    reasons.push("A/B evidence reports improvement without detected regression.");
    reasons.push("Decision remains subject to the deterministic restoration gate and artifact execution controls.");
  }
  if (decision === "keep-original") reasons.push("No material evidence establishes a benefit over the original.");
  if (decision === "review") reasons.push("Human review is required because evidence is ambiguous, changed, or constrained.");
  if (decision === "abstain") reasons.push("Insufficient evidence prevents a reliable restoration judgment.");

  return {
    id: `director:${input.plan.id}:${c?.id ?? "none"}:${input.comparison.id}`,
    planId: input.plan.id,
    candidateId: c?.id,
    sourceArtifactId: input.comparison.sourceArtifactId,
    candidateArtifactId: input.comparison.candidateArtifactId,
    decision,
    confidence,
    evidenceIds: evidence,
    reasons: unique(reasons),
    hardConstraintFailures: unique(failures),
    requiresHumanReview: decision === "review" || decision === "abstain" || input.plan.requiresApproval,
  };
}
