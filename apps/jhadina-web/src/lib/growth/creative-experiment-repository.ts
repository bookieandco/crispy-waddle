import type {
  AdCreativeExperimentPlan,
  AdCreativeVariantLineage,
  BinaryCreativeExperimentAssessment,
  BinaryCreativeVariantObservation,
  GrowthEvidenceFeedHealthAssessment,
} from "@jhadina/growth-core"
import { createClient } from "../supabase/server"

export type GrowthCreativeExperimentStatus = "planned" | "running" | "paused" | "completed" | "cancelled"

export type GrowthCreativeExperimentRow = {
  id: string
  user_id: string
  experiment_key: string
  brand_id: string
  name: string
  control_variant_id: string
  treatment_variant_ids: string[]
  mutation_axis: AdCreativeExperimentPlan["mutationAxis"]
  hypotheses: Record<string, string>
  plan: AdCreativeExperimentPlan
  status: GrowthCreativeExperimentStatus
  authority: "LEARNING_PLAN_ONLY"
  request_fingerprint: string
  idempotency_key: string
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type GrowthCreativeVariantLineageRow = {
  id: string
  user_id: string
  experiment_id: string
  variant_id: string
  content_project_id: string
  concept_id: string
  platform: AdCreativeVariantLineage["platform"]
  product_identity_ref: string
  style_identity_ref: string
  mutation_axis: AdCreativeVariantLineage["mutationAxis"]
  mutation_ref: string
  control_variant_id: string | null
  fixed_dimension_refs: Record<string, string>
  director_project_id: string
  director_artifact_id: string
  artifact_sha256: string
  director_stage_id: string | null
  director_stage_version: number | null
  review_decision_id: string | null
  evidence_refs: string[]
  lineage_fingerprint: string
  lineage: AdCreativeVariantLineage
  authority: "EXPERIMENT_INPUT_ONLY"
  created_at: string
}

export type GrowthCreativeExperimentObservationRow = {
  id: string
  user_id: string
  experiment_id: string
  variant_id: string
  observation_key: string
  observation_fingerprint: string
  exposures: number
  clicks: number | null
  conversions: number
  payments: number | null
  spend: number
  contribution_margin: number
  observed_at: string
  evidence_refs: string[]
  created_at: string
}

export type GrowthEvidenceHealthAssessmentRow = {
  id: string
  user_id: string
  experiment_id: string | null
  assessment_key: string
  assessment_fingerprint: string
  source: string
  asset_ref: string
  checked_at: string
  age_seconds: number
  freshness: "fresh" | "stale"
  completeness: number
  monitor_coverage: number
  active_incident_count: number
  upstream_issue_count: number
  schema_anomaly: boolean
  volume_anomaly: boolean
  lineage_complete: boolean
  severity: "healthy" | "degraded" | "blocked"
  allowed_for_learning: boolean
  blockers: string[]
  warnings: string[]
  evidence_refs: string[]
  assessment: GrowthEvidenceFeedHealthAssessment
  created_at: string
}

export type GrowthCreativeExperimentAssessmentRow = {
  id: string
  user_id: string
  experiment_id: string
  assessment_key: string
  assessment_fingerprint: string
  control_variant_id: string
  treatment_variant_id: string
  control_rate: number
  treatment_rate: number
  absolute_lift: number
  relative_lift: number | null
  z_score: number | null
  p_value: number | null
  confidence_interval95: [number, number] | null
  incremental_contribution: number
  incremental_contribution_per_exposure: number
  evidence_refs: string[]
  status: BinaryCreativeExperimentAssessment["status"]
  decision: BinaryCreativeExperimentAssessment["decision"]
  health_assessment_id: string | null
  authority: "LEARNING_ONLY"
  assessed_at: string
  assessment: BinaryCreativeExperimentAssessment
  created_at: string
}

export interface GrowthCreativeExperimentRepository {
  recordExperiment(input: {
    experimentKey: string
    brandId: string
    name: string
    plan: AdCreativeExperimentPlan
    requestFingerprint: string
    idempotencyKey: string
    status?: GrowthCreativeExperimentStatus
  }): Promise<GrowthCreativeExperimentRow>
  recordVariantLineage(input: {
    experimentId: string
    lineage: AdCreativeVariantLineage
    lineageFingerprint: string
  }): Promise<GrowthCreativeVariantLineageRow>
  recordObservation(input: {
    experimentId: string
    observation: BinaryCreativeVariantObservation
    observationKey: string
    observationFingerprint: string
    clicks?: number
    payments?: number
  }): Promise<GrowthCreativeExperimentObservationRow>
  recordEvidenceHealth(input: {
    experimentId?: string
    assessment: GrowthEvidenceFeedHealthAssessment
    assessmentKey: string
    assessmentFingerprint: string
  }): Promise<GrowthEvidenceHealthAssessmentRow>
  recordAssessment(input: {
    experimentId: string
    assessment: BinaryCreativeExperimentAssessment
    assessmentKey: string
    assessmentFingerprint: string
    healthAssessmentId?: string
    assessedAt: string
  }): Promise<GrowthCreativeExperimentAssessmentRow>
  setStatus(input: {
    experimentId: string
    expectedStatus: GrowthCreativeExperimentStatus
    status: GrowthCreativeExperimentStatus
  }): Promise<GrowthCreativeExperimentRow>
  getExperiment(userId: string, experimentId: string): Promise<GrowthCreativeExperimentRow>
  listExperiments(userId: string): Promise<GrowthCreativeExperimentRow[]>
  listVariantLineage(userId: string, experimentId: string): Promise<GrowthCreativeVariantLineageRow[]>
  listExperimentObservations(userId: string, experimentId: string): Promise<GrowthCreativeExperimentObservationRow[]>
  listEvidenceHealth(userId: string, experimentId?: string): Promise<GrowthEvidenceHealthAssessmentRow[]>
  listAssessments(userId: string, experimentId?: string): Promise<GrowthCreativeExperimentAssessmentRow[]>
}

export function createGrowthCreativeExperimentRepository(): GrowthCreativeExperimentRepository {
  return {
    async recordExperiment(input) {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_growth_record_creative_experiment", {
        p_experiment_key: input.experimentKey,
        p_brand_id: input.brandId,
        p_name: input.name,
        p_control_variant_id: input.plan.controlVariantId,
        p_treatment_variant_ids: input.plan.treatmentVariantIds,
        p_mutation_axis: input.plan.mutationAxis,
        p_hypotheses: input.plan.hypotheses,
        p_plan: input.plan,
        p_request_fingerprint: input.requestFingerprint,
        p_idempotency_key: input.idempotencyKey,
        p_status: input.status ?? "planned",
      }).single()
      if (error || !data) throw new Error(`GROWTH_CREATIVE_EXPERIMENT_RECORD_FAILED:${error?.message ?? "no row"}`)
      return data as GrowthCreativeExperimentRow
    },

    async recordVariantLineage(input) {
      const { lineage } = input
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_growth_record_creative_variant_lineage", {
        p_experiment_id: input.experimentId,
        p_variant_id: lineage.id,
        p_content_project_id: lineage.contentProjectId,
        p_concept_id: lineage.conceptId,
        p_platform: lineage.platform,
        p_product_identity_ref: lineage.productIdentityRef,
        p_style_identity_ref: lineage.styleIdentityRef,
        p_mutation_axis: lineage.mutationAxis,
        p_mutation_ref: lineage.mutationRef,
        p_control_variant_id: lineage.controlVariantId ?? null,
        p_fixed_dimension_refs: lineage.fixedDimensionRefs,
        p_director_project_id: lineage.director.directorProjectId,
        p_director_artifact_id: lineage.director.directorArtifactId,
        p_artifact_sha256: lineage.director.artifactSha256,
        p_director_stage_id: lineage.director.directorStageId ?? null,
        p_director_stage_version: lineage.director.directorStageVersion ?? null,
        p_review_decision_id: lineage.director.reviewDecisionId ?? null,
        p_evidence_refs: lineage.evidenceRefs,
        p_lineage_fingerprint: input.lineageFingerprint,
        p_lineage: lineage,
      }).single()
      if (error || !data) throw new Error(`GROWTH_CREATIVE_VARIANT_LINEAGE_RECORD_FAILED:${error?.message ?? "no row"}`)
      return data as GrowthCreativeVariantLineageRow
    },

    async recordObservation(input) {
      const { observation } = input
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_growth_record_creative_experiment_observation", {
        p_experiment_id: input.experimentId,
        p_variant_id: observation.variantId,
        p_observation_key: input.observationKey,
        p_observation_fingerprint: input.observationFingerprint,
        p_exposures: observation.exposures,
        p_clicks: input.clicks ?? null,
        p_conversions: observation.conversions,
        p_payments: input.payments ?? null,
        p_spend: observation.spend,
        p_contribution_margin: observation.contributionMargin,
        p_observed_at: observation.observedAt,
        p_evidence_refs: observation.evidenceRefs,
      }).single()
      if (error || !data) throw new Error(`GROWTH_CREATIVE_EXPERIMENT_OBSERVATION_RECORD_FAILED:${error?.message ?? "no row"}`)
      return data as GrowthCreativeExperimentObservationRow
    },

    async recordEvidenceHealth(input) {
      const a = input.assessment
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_growth_record_evidence_health_assessment", {
        p_experiment_id: input.experimentId ?? null,
        p_assessment_key: input.assessmentKey,
        p_assessment_fingerprint: input.assessmentFingerprint,
        p_source: a.source,
        p_asset_ref: a.assetRef,
        p_checked_at: a.checkedAt,
        p_age_seconds: a.ageSeconds,
        p_freshness: a.freshness,
        p_completeness: a.completeness,
        p_monitor_coverage: a.monitorCoverage,
        p_active_incident_count: a.activeIncidentCount,
        p_upstream_issue_count: a.upstreamIssueCount,
        p_schema_anomaly: a.schemaAnomaly,
        p_volume_anomaly: a.volumeAnomaly,
        p_lineage_complete: a.lineageComplete,
        p_severity: a.severity,
        p_allowed_for_learning: a.allowedForLearning,
        p_blockers: a.blockers,
        p_warnings: a.warnings,
        p_evidence_refs: a.evidenceRefs,
        p_assessment: a,
      }).single()
      if (error || !data) throw new Error(`GROWTH_EVIDENCE_HEALTH_RECORD_FAILED:${error?.message ?? "no row"}`)
      return data as GrowthEvidenceHealthAssessmentRow
    },

    async recordAssessment(input) {
      const a = input.assessment
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_growth_record_creative_experiment_assessment", {
        p_experiment_id: input.experimentId,
        p_assessment_key: input.assessmentKey,
        p_assessment_fingerprint: input.assessmentFingerprint,
        p_control_variant_id: a.controlVariantId,
        p_treatment_variant_id: a.treatmentVariantId,
        p_control_rate: a.controlRate,
        p_treatment_rate: a.treatmentRate,
        p_absolute_lift: a.absoluteLift,
        p_relative_lift: a.relativeLift ?? null,
        p_z_score: a.zScore ?? null,
        p_p_value: a.pValue ?? null,
        p_confidence_interval95: a.confidenceInterval95 ?? null,
        p_incremental_contribution: a.incrementalContribution,
        p_incremental_contribution_per_exposure: a.incrementalContributionPerExposure,
        p_evidence_refs: a.evidenceRefs,
        p_status: a.status,
        p_decision: a.decision,
        p_health_assessment_id: input.healthAssessmentId ?? null,
        p_assessed_at: input.assessedAt,
        p_assessment: a,
      }).single()
      if (error || !data) throw new Error(`GROWTH_CREATIVE_EXPERIMENT_ASSESSMENT_RECORD_FAILED:${error?.message ?? "no row"}`)
      return data as GrowthCreativeExperimentAssessmentRow
    },

    async setStatus(input) {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_growth_set_creative_experiment_status", {
        p_experiment_id: input.experimentId,
        p_expected_status: input.expectedStatus,
        p_status: input.status,
      }).single()
      if (error || !data) throw new Error(`GROWTH_CREATIVE_EXPERIMENT_STATUS_FAILED:${error?.message ?? "no row"}`)
      return data as GrowthCreativeExperimentRow
    },

    async getExperiment(userId, experimentId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_growth_creative_experiments")
        .select("*")
        .eq("user_id", userId)
        .eq("id", experimentId)
        .single()
      if (error || !data) throw new Error(`GROWTH_CREATIVE_EXPERIMENT_NOT_FOUND:${experimentId}`)
      return data as GrowthCreativeExperimentRow
    },

    async listExperiments(userId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_growth_creative_experiments")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
      if (error) throw new Error(`GROWTH_CREATIVE_EXPERIMENT_LIST_FAILED:${error.message}`)
      return (data ?? []) as GrowthCreativeExperimentRow[]
    },

    async listVariantLineage(userId, experimentId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_growth_creative_variant_lineage")
        .select("*")
        .eq("user_id", userId)
        .eq("experiment_id", experimentId)
        .order("created_at", { ascending: true })
      if (error) throw new Error(`GROWTH_CREATIVE_VARIANT_LINEAGE_LIST_FAILED:${error.message}`)
      return (data ?? []) as GrowthCreativeVariantLineageRow[]
    },

    async listExperimentObservations(userId, experimentId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_growth_creative_experiment_observations")
        .select("*")
        .eq("user_id", userId)
        .eq("experiment_id", experimentId)
        .order("observed_at", { ascending: true })
      if (error) throw new Error(`GROWTH_CREATIVE_EXPERIMENT_OBSERVATION_LIST_FAILED:${error.message}`)
      return (data ?? []) as GrowthCreativeExperimentObservationRow[]
    },

    async listEvidenceHealth(userId, experimentId) {
      const supabase = await createClient()
      let query = supabase
        .from("jhadina_growth_evidence_health_assessments")
        .select("*")
        .eq("user_id", userId)
        .order("checked_at", { ascending: false })
      if (experimentId) query = query.eq("experiment_id", experimentId)
      const { data, error } = await query
      if (error) throw new Error(`GROWTH_EVIDENCE_HEALTH_LIST_FAILED:${error.message}`)
      return (data ?? []) as GrowthEvidenceHealthAssessmentRow[]
    },

    async listAssessments(userId, experimentId) {
      const supabase = await createClient()
      let query = supabase
        .from("jhadina_growth_creative_experiment_assessments")
        .select("*")
        .eq("user_id", userId)
        .order("assessed_at", { ascending: false })
      if (experimentId) query = query.eq("experiment_id", experimentId)
      const { data, error } = await query
      if (error) throw new Error(`GROWTH_CREATIVE_EXPERIMENT_ASSESSMENT_LIST_FAILED:${error.message}`)
      return (data ?? []) as GrowthCreativeExperimentAssessmentRow[]
    },
  }
}
