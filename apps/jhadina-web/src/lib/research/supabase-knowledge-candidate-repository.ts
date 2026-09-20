import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateKnowledgeCandidateInput,
  EvidenceVerificationInput,
  KnowledgeCandidateRepository,
} from "../../../../../packages/jhadina-research-core/src/knowledge-candidate-repository.js";
import type { KnowledgeCandidateDecision } from "../../../../../packages/jhadina-research-core/src/knowledge-candidate.js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function requireServiceRole(client?: SupabaseClient | null): SupabaseClient {
  const resolved = client ?? createServiceRoleClient();
  if (!resolved) throw new Error("Knowledge candidate admission requires SUPABASE_SERVICE_ROLE_KEY");
  return resolved;
}

function asDecision(data: unknown): KnowledgeCandidateDecision | undefined {
  if (!data || typeof data !== "object") return undefined;
  const row = data as { status?: unknown; reasons?: unknown };
  if (!["validated", "disputed", "rejected"].includes(String(row.status))) return undefined;
  return {
    status: row.status as KnowledgeCandidateDecision["status"],
    reasons: Array.isArray(row.reasons) ? row.reasons.map(String) : [],
  } as KnowledgeCandidateDecision;
}

export function createSupabaseKnowledgeCandidateRepository(
  client?: SupabaseClient | null,
): KnowledgeCandidateRepository {
  const supabase = requireServiceRole(client);
  return {
    async verifyEvidence(input: EvidenceVerificationInput) {
      const { data, error } = await supabase.rpc("jhadina_verify_knowledge_evidence", {
        p_evidence_id: input.evidenceId,
        p_verification_state: input.verificationState,
        p_authority_score: input.authorityScore,
        p_freshness_state: input.freshnessState,
        p_last_verified_at: input.lastVerifiedAt ?? new Date().toISOString(),
      });
      if (error) throw new Error(`Unable to verify knowledge evidence: ${error.message}`);
      return data === true;
    },

    async createCandidate(input: CreateKnowledgeCandidateInput) {
      const { data, error } = await supabase.rpc("jhadina_create_knowledge_candidate", {
        p_plan_id: input.planId,
        p_execution_event_id: input.executionEventId,
        p_subject: input.subject,
        p_claim: input.claim,
        p_predicate: input.predicate,
        p_object_json: input.object ?? {},
        p_confidence: input.confidence,
        p_evidence_ids: input.evidenceIds,
        p_minimum_authority_score: input.minimumAuthorityScore ?? 0,
        p_minimum_sources: input.minimumSources ?? 1,
        p_require_fresh: input.requireFresh ?? true,
        p_observed_at: input.observedAt ?? new Date().toISOString(),
      });
      if (error) throw new Error(`Unable to create knowledge candidate: ${error.message}`);
      return typeof data === "string" ? data : undefined;
    },

    async setContradiction(candidateId, state) {
      const { data, error } = await supabase.rpc("jhadina_set_candidate_contradiction", {
        p_candidate_id: candidateId,
        p_state: state,
      });
      if (error) throw new Error(`Unable to set candidate contradiction: ${error.message}`);
      return data === true;
    },

    async evaluateCandidate(candidateId) {
      const { data, error } = await supabase.rpc("jhadina_evaluate_knowledge_candidate", {
        p_candidate_id: candidateId,
      });
      if (error) throw new Error(`Unable to evaluate knowledge candidate: ${error.message}`);
      return asDecision(data);
    },

    async admitCandidate(candidateId) {
      const { data, error } = await supabase.rpc("jhadina_admit_knowledge_candidate", {
        p_candidate_id: candidateId,
      });
      if (error) throw new Error(`Unable to admit knowledge candidate: ${error.message}`);
      return typeof data === "string" ? data : undefined;
    },
  };
}
