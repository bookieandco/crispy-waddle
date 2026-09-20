import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ResearchCommitResult,
  ResearchProviderSubmission,
  ResearchRuntimeRepository,
} from "../../../../../packages/jhadina-research-core/src/runtime-repository.js";
import type {
  PersistedResearchPlan,
  ResearchRuntimeAdmission,
} from "../../../../../packages/jhadina-research-core/src/runtime-reconciliation.js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type JsonObject = Record<string, unknown>;

function requireServiceRole(client?: SupabaseClient | null): SupabaseClient {
  const resolved = client ?? createServiceRoleClient();
  if (!resolved) throw new Error("Research runtime requires SUPABASE_SERVICE_ROLE_KEY");
  return resolved;
}

function asPlan(data: unknown): PersistedResearchPlan | undefined {
  if (!data || typeof data !== "object") return undefined;
  const row = data as JsonObject;
  if (typeof row.id !== "string" || typeof row.intent_id !== "string" || !Array.isArray(row.tasks)) return undefined;
  return {
    id: row.id,
    intentId: row.intent_id,
    planVersion: Number(row.plan_version),
    tasks: row.tasks as PersistedResearchPlan["tasks"],
    budget: (row.budget && typeof row.budget === "object" ? row.budget : {}) as Record<string, unknown>,
    status: String(row.status ?? ""),
  };
}

function asAdmission(data: unknown): ResearchRuntimeAdmission | undefined {
  if (!data || typeof data !== "object") return undefined;
  const row = data as JsonObject;
  const required = ["planId", "policyDecisionId", "leaseId", "leaseToken", "workerId", "expiresAt"] as const;
  if (!required.every((key) => typeof row[key] === "string")) return undefined;
  return {
    planId: row.planId as string,
    policyDecisionId: row.policyDecisionId as string,
    leaseId: row.leaseId as string,
    leaseToken: row.leaseToken as string,
    workerId: row.workerId as string,
    expiresAt: row.expiresAt as string,
  };
}

function asSubmission(data: unknown): ResearchProviderSubmission | undefined {
  if (!data || typeof data !== "object") return undefined;
  const row = data as JsonObject;
  if (typeof row.id !== "string" || typeof row.planId !== "string" || typeof row.leaseId !== "string"
    || typeof row.taskId !== "string" || typeof row.providerId !== "string" || typeof row.idempotencyKey !== "string"
    || !["reserved", "submitted", "recovery_required"].includes(String(row.status))) return undefined;
  return {
    id: row.id,
    planId: row.planId,
    leaseId: row.leaseId,
    taskId: row.taskId,
    providerId: row.providerId,
    idempotencyKey: row.idempotencyKey,
    status: row.status as ResearchProviderSubmission["status"],
    providerJobId: typeof row.providerJobId === "string" ? row.providerJobId : undefined,
  };
}

export function createSupabaseResearchRuntimeRepository(client?: SupabaseClient | null): ResearchRuntimeRepository {
  const supabase = requireServiceRole(client);
  return {
    async loadPlan(planId) {
      const { data, error } = await supabase.rpc("jhadina_get_research_runtime_plan", { p_plan_id: planId });
      if (error) throw new Error(`Unable to load research plan: ${error.message}`);
      return asPlan(data);
    },
    async claimExecution(input) {
      const { data, error } = await supabase.rpc("jhadina_claim_research_execution", {
        p_plan_id: input.planId,
        p_policy_decision_id: input.policyDecisionId,
        p_worker_id: input.workerId,
        p_lease_seconds: input.leaseSeconds,
      });
      if (error) throw new Error(`Unable to claim research execution: ${error.message}`);
      return asAdmission(data);
    },
    async renewExecutionLease(admission, leaseSeconds) {
      const { data, error } = await supabase.rpc("jhadina_renew_research_execution_lease", {
        p_lease_id: admission.leaseId,
        p_worker_id: admission.workerId,
        p_lease_token: admission.leaseToken,
        p_lease_seconds: leaseSeconds,
      });
      if (error) throw new Error(`Unable to renew research execution: ${error.message}`);
      return asAdmission(data);
    },
    async reserveProviderSubmission(input) {
      const { data, error } = await supabase.rpc("jhadina_reserve_research_provider_submission", {
        p_plan_id: input.admission.planId,
        p_lease_id: input.admission.leaseId,
        p_worker_id: input.admission.workerId,
        p_lease_token: input.admission.leaseToken,
        p_task_id: input.taskId,
        p_provider_id: input.providerId,
        p_idempotency_key: input.idempotencyKey,
        p_request_hash: input.requestHash,
      });
      if (error) throw new Error(`Unable to reserve research provider submission: ${error.message}`);
      return asSubmission(data);
    },
    async acknowledgeProviderSubmission(input) {
      const { data, error } = await supabase.rpc("jhadina_ack_research_provider_submission", {
        p_submission_id: input.submissionId,
        p_lease_id: input.admission.leaseId,
        p_worker_id: input.admission.workerId,
        p_lease_token: input.admission.leaseToken,
        p_provider_job_id: input.providerJobId ?? null,
      });
      if (error) throw new Error(`Unable to acknowledge research provider submission: ${error.message}`);
      return asSubmission(data);
    },
    async markProviderRecoveryRequired(input) {
      const { data, error } = await supabase.rpc("jhadina_mark_research_provider_recovery", {
        p_submission_id: input.submissionId,
        p_lease_id: input.admission.leaseId,
        p_worker_id: input.admission.workerId,
        p_lease_token: input.admission.leaseToken,
        p_error: input.error,
      });
      if (error) throw new Error(`Unable to mark research provider recovery: ${error.message}`);
      return data === true;
    },
    async commitExecutionEvent(input) {
      const { data, error } = await supabase.rpc("jhadina_commit_research_execution_event", {
        p_plan_id: input.admission.planId,
        p_lease_id: input.admission.leaseId,
        p_worker_id: input.admission.workerId,
        p_lease_token: input.admission.leaseToken,
        p_event_type: input.eventType,
        p_task_id: input.taskId ?? null,
        p_payload: input.payload ?? {},
        p_usage: input.usage ?? {},
        p_content_hash: input.contentHash ?? null,
      });
      if (error) throw new Error(`Unable to commit research execution event: ${error.message}`);
      return (data ?? { accepted: false, stopped: false, reason: "no_result" }) as ResearchCommitResult;
    },
    async captureEvidence(input) {
      const evidence = input.evidence;
      const { data, error } = await supabase.rpc("jhadina_capture_research_evidence", {
        p_plan_id: input.planId,
        p_execution_event_id: input.executionEventId,
        p_source_kind: evidence.sourceKind ?? "web",
        p_source_uri: evidence.sourceUri,
        p_publisher: evidence.publisher ?? null,
        p_authority: evidence.authority ?? "unknown",
        p_trust_score: evidence.trustScore ?? 0,
        p_locator: evidence.locator ?? {},
        p_excerpt: evidence.excerpt ?? null,
        p_content_hash: evidence.contentHash,
        p_metadata: evidence.metadata ?? {},
      });
      if (error) throw new Error(`Unable to capture research evidence: ${error.message}`);
      return typeof data === "string" ? data : undefined;
    },
    async releaseExecution(admission, state) {
      const { data, error } = await supabase.rpc("jhadina_release_research_execution", {
        p_lease_id: admission.leaseId,
        p_worker_id: admission.workerId,
        p_lease_token: admission.leaseToken,
        p_state: state,
      });
      if (error) throw new Error(`Unable to release research execution: ${error.message}`);
      return data === true;
    },
  };
}
