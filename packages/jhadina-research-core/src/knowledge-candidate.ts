export type KnowledgeCandidateStatus = "pending" | "validated" | "disputed" | "rejected" | "admitted";
export type KnowledgeContradictionState = "none" | "unresolved" | "resolved";

export type KnowledgeCandidate = {
  id: string;
  planId: string;
  executionEventId: string;
  subject: string;
  claim: string;
  predicate: string;
  object: unknown;
  confidence: number;
  evidenceIds: string[];
  minimumAuthorityScore: number;
  minimumSources: number;
  requireFresh: boolean;
  contradictionState: KnowledgeContradictionState;
  status: KnowledgeCandidateStatus;
};

export type CandidateEvidenceAssessment = {
  evidenceCount: number;
  distinctSources: number;
  minimumAuthorityScore: number;
  allVerified: boolean;
  allFresh: boolean;
};

export type KnowledgeCandidateDecision =
  | { status: "validated"; reasons: string[] }
  | { status: "disputed"; reasons: string[] }
  | { status: "rejected"; reasons: string[] };

export function evaluateKnowledgeCandidate(
  candidate: KnowledgeCandidate,
  evidence: CandidateEvidenceAssessment,
): KnowledgeCandidateDecision {
  if (!candidate.subject || !candidate.claim || !candidate.predicate) {
    return { status: "rejected", reasons: ["candidate_identity_incomplete"] };
  }
  if (!Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1) {
    return { status: "rejected", reasons: ["candidate_confidence_invalid"] };
  }
  if (candidate.contradictionState === "unresolved") {
    return { status: "disputed", reasons: ["unresolved_contradiction"] };
  }

  const reasons: string[] = [];
  if (evidence.evidenceCount < 1) reasons.push("evidence_required");
  if (evidence.distinctSources < candidate.minimumSources) reasons.push("insufficient_source_corroboration");
  if (evidence.minimumAuthorityScore < candidate.minimumAuthorityScore) reasons.push("authority_below_threshold");
  if (!evidence.allVerified) reasons.push("unverified_evidence");
  if (candidate.requireFresh && !evidence.allFresh) reasons.push("stale_or_changed_evidence");

  return reasons.length > 0
    ? { status: "rejected", reasons }
    : { status: "validated", reasons: [] };
}
