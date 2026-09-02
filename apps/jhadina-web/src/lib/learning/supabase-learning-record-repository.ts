import type { LearningRecord, LearningRecordRepository } from "@jhadina/core-spine"
import { createServiceRoleClient } from "../supabase/service-role"

type LearningRecordRow = {
  id: string
  schema_version: string
  occurred_at: string
  domain: string
  experience_id: string | null
  proposal_id: string
  policy_decision_id: string | null
  action_request_id: string | null
  action_result_id: string | null
  correlation_id: string
  source: string
  actor: LearningRecord["provenance"]["actor"]
  evidence: LearningRecord["evidence"]
  prediction: LearningRecord["prediction"] | null
  outcome: LearningRecord["outcome"]
  learning_update: LearningRecord["learningUpdate"]
  provenance: LearningRecord["provenance"]
  created_at: string
}

function toLearningRecord(row: LearningRecordRow): LearningRecord {
  return {
    id: row.id,
    schemaVersion: row.schema_version,
    occurredAt: row.occurred_at,
    domain: row.domain,
    experienceId: row.experience_id ?? undefined,
    decision: {
      proposalId: row.proposal_id,
      policyDecisionId: row.policy_decision_id ?? undefined,
      actionRequestId: row.action_request_id ?? undefined,
      actionResultId: row.action_result_id ?? undefined,
    },
    evidence: row.evidence,
    prediction: row.prediction ?? undefined,
    outcome: row.outcome,
    learningUpdate: row.learning_update,
    provenance: row.provenance,
  }
}

function toRow(record: LearningRecord): Omit<LearningRecordRow, "created_at"> {
  return {
    id: record.id,
    schema_version: record.schemaVersion,
    occurred_at: record.occurredAt,
    domain: record.domain,
    experience_id: record.experienceId ?? null,
    proposal_id: record.decision.proposalId,
    policy_decision_id: record.decision.policyDecisionId ?? null,
    action_request_id: record.decision.actionRequestId ?? null,
    action_result_id: record.decision.actionResultId ?? null,
    correlation_id: record.provenance.correlationId,
    source: record.provenance.source,
    actor: record.provenance.actor,
    evidence: record.evidence,
    prediction: record.prediction ?? null,
    outcome: record.outcome,
    learning_update: record.learningUpdate,
    provenance: record.provenance,
  }
}

/**
 * Server-only durable LearningRecordRepository.
 *
 * This adapter deliberately uses the existing privileged Supabase client.
 * The learning-record table has no anon/authenticated grants, and the
 * database trigger independently rejects UPDATE/DELETE. There is therefore
 * no browser/client write path and no mutable learned-state API hiding behind
 * this repository.
 */
export function createSupabaseLearningRecordRepository(): LearningRecordRepository {
  const supabase = createServiceRoleClient()
  if (!supabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY_REQUIRED_FOR_LEARNING_RECORDS")
  }

  return {
    async append(record) {
      const { error } = await supabase.from("jhadina_learning_records").insert(toRow(record))
      if (error) throw new Error(`DURABLE_LEARNING_RECORD_APPEND_FAILED:${error.message}`)
    },

    async get(id) {
      const { data, error } = await supabase
        .from("jhadina_learning_records")
        .select("*")
        .eq("id", id)
        .maybeSingle<LearningRecordRow>()

      if (error) throw new Error(`DURABLE_LEARNING_RECORD_GET_FAILED:${error.message}`)
      return data ? toLearningRecord(data) : undefined
    },

    async listByCorrelation(correlationId) {
      const { data, error } = await supabase
        .from("jhadina_learning_records")
        .select("*")
        .eq("correlation_id", correlationId)
        .order("occurred_at", { ascending: true })

      if (error) throw new Error(`DURABLE_LEARNING_RECORD_LIST_FAILED:${error.message}`)
      return (data as LearningRecordRow[]).map(toLearningRecord)
    },

    async listByDomain(domain) {
      const { data, error } = await supabase
        .from("jhadina_learning_records")
        .select("*")
        .eq("domain", domain)
        .order("occurred_at", { ascending: true })

      if (error) throw new Error(`DURABLE_LEARNING_RECORD_LIST_FAILED:${error.message}`)
      return (data as LearningRecordRow[]).map(toLearningRecord)
    },
  }
}
