import type { GrowthId, PatternExperimentEvidence, PatternExperimentEvidenceStore } from "@jhadina/growth-core"

type SupabaseLike = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>
  from(table: string): {
    select(columns?: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: { message: string } | null }>
      }
    }
  }
}

const TABLE = "growth_social_pattern_experiment_evidence"

function toRow(evidence: PatternExperimentEvidence): Record<string, unknown> {
  return {
    execution_id: evidence.executionId,
    experiment_id: evidence.experimentId,
    hypothesis_id: evidence.hypothesisId,
    target_account_id: evidence.targetAccountId,
    target_audience_id: evidence.targetAudienceId,
    target_voice_id: evidence.targetVoiceId,
    success_metric: evidence.successMetric,
    control_metric: evidence.controlMetric,
    treatment_metric: evidence.treatmentMetric,
    control_observations: evidence.controlObservations,
    treatment_observations: evidence.treatmentObservations,
    observed_at: evidence.observedAt,
    source: evidence.source,
  }
}

function fromRow(row: Record<string, unknown>): PatternExperimentEvidence {
  return {
    executionId: row.execution_id as GrowthId,
    experimentId: row.experiment_id as GrowthId,
    hypothesisId: row.hypothesis_id as GrowthId,
    targetAccountId: row.target_account_id as GrowthId,
    targetAudienceId: row.target_audience_id as GrowthId,
    targetVoiceId: row.target_voice_id as GrowthId,
    successMetric: row.success_metric as PatternExperimentEvidence["successMetric"],
    controlMetric: Number(row.control_metric),
    treatmentMetric: Number(row.treatment_metric),
    controlObservations: Number(row.control_observations),
    treatmentObservations: Number(row.treatment_observations),
    observedAt: row.observed_at as string,
    source: "experiment-execution",
  }
}

/**
 * Trusted execution adapter. The database RPC is service-role-only; this class
 * must not be exposed directly to untrusted client actions.
 */
export class SupabasePatternExperimentEvidenceStore implements PatternExperimentEvidenceStore {
  constructor(private readonly client: SupabaseLike) {}

  async getByExecutionId(executionId: GrowthId): Promise<PatternExperimentEvidence | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("execution_id", executionId)
      .maybeSingle()
    if (error) throw new Error(`experiment evidence lookup failed: ${error.message}`)
    return data ? fromRow(data) : null
  }

  async put(evidence: PatternExperimentEvidence): Promise<void> {
    const { error } = await this.client.rpc("insert_social_pattern_experiment_evidence", {
      payload: toRow(evidence),
    })
    if (error) throw new Error(`experiment evidence insert failed: ${error.message}`)
  }
}
