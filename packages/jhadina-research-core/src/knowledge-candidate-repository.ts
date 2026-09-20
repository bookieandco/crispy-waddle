import type { KnowledgeCandidateDecision, KnowledgeContradictionState } from "./knowledge-candidate.js";

export type EvidenceVerificationInput = {
  evidenceId: string;
  verificationState: "unverified" | "provisional" | "verified" | "disputed" | "stale" | "rejected";
  authorityScore: number;
  freshnessState: "fresh" | "stale" | "expired" | "changed" | "unknown";
  lastVerifiedAt?: string;
};

export type CreateKnowledgeCandidateInput = {
  planId: string;
  executionEventId: string;
  subject: string;
  claim: string;
  predicate: string;
  object: unknown;
  confidence: number;
  evidenceIds: string[];
  minimumAuthorityScore?: number;
  minimumSources?: number;
  requireFresh?: boolean;
  observedAt?: string;
};

export interface KnowledgeCandidateRepository {
  verifyEvidence(input: EvidenceVerificationInput): Promise<boolean>;
  createCandidate(input: CreateKnowledgeCandidateInput): Promise<string | undefined>;
  setContradiction(candidateId: string, state: KnowledgeContradictionState): Promise<boolean>;
  evaluateCandidate(candidateId: string): Promise<KnowledgeCandidateDecision | undefined>;
  admitCandidate(candidateId: string): Promise<string | undefined>;
}
