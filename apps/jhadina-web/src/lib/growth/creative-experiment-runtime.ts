import { createHash } from "node:crypto"
import {
  assessBinaryCreativeExperiment,
  assessGrowthEvidenceFeedHealth,
  buildCreativeExperimentFeatureRows,
  buildIsolatedAdCreativeExperimentPlan,
  createAdCreativeVariantLineage,
  type AdCreativeExperimentPlan,
  type AdCreativeVariantLineage,
  type BinaryCreativeExperimentAssessment,
  type BinaryCreativeVariantObservation,
  type GrowthEvidenceFeedHealthAssessment,
  type GrowthEvidenceFeedHealthInput,
} from "@jhadina/growth-core"
import {
  createGrowthCreativeExperimentRepository,
  type GrowthCreativeExperimentRepository,
  type GrowthCreativeExperimentRow,
  type GrowthCreativeExperimentStatus,
} from "./creative-experiment-repository"

export interface CreativeExperimentRuntimeOverrides {
  repository?: GrowthCreativeExperimentRepository
}

export interface PersistCreativeExperimentInput {
  brandId: string
  name: string
  plan: AdCreativeExperimentPlan
  lineages: readonly AdCreativeVariantLineage[]
  status?: GrowthCreativeExperimentStatus
}

export interface PersistedCreativeExperiment {
  experiment: GrowthCreativeExperimentRow
  lineageIds: readonly string[]
  authority: "LEARNING_PLAN_ONLY"
}

export async function persistCreativeExperimentPlan(
  input: PersistCreativeExperimentInput,
  overrides: CreativeExperimentRuntimeOverrides = {},
): Promise<PersistedCreativeExperiment> {
  const repository = overrides.repository ?? createGrowthCreativeExperimentRepository()
  const plan = validatePlanAndLineage(input.plan, input.lineages)
  if (!input.brandId.trim() || !input.name.trim()) throw new Error("GROWTH_CREATIVE_EXPERIMENT_BRAND_NAME_REQUIRED")

  const requestFingerprint = fingerprint({
    brandId: input.brandId.trim(),
    name: input.name.trim(),
    plan,
  })
  const experiment = await repository.recordExperiment({
    experimentKey: String(plan.id),
    brandId: input.brandId.trim(),
    name: input.name.trim(),
    plan,
    requestFingerprint,
    idempotencyKey: `growth-creative-experiment:${plan.id}:${requestFingerprint}`,
    status: input.status ?? "planned",
  })

  const lineageIds: string[] = []
  for (const lineage of input.lineages) {
    const row = await repository.recordVariantLineage({
      experimentId: experiment.id,
      lineage,
      lineageFingerprint: fingerprint(lineage),
    })
    lineageIds.push(row.id)
  }

  return Object.freeze({
    experiment,
    lineageIds: Object.freeze(lineageIds),
    authority: "LEARNING_PLAN_ONLY",
  })
}

export async function recordValidatedCreativeObservation(
  input: {
    userId: string
    experimentId: string
    observationKey: string
    observation: BinaryCreativeVariantObservation
    clicks?: number
    payments?: number
  },
  overrides: CreativeExperimentRuntimeOverrides = {},
) {
  if (!input.observationKey.trim()) throw new Error("GROWTH_CREATIVE_OBSERVATION_KEY_REQUIRED")
  const repository = overrides.repository ?? createGrowthCreativeExperimentRepository()
  const experiment = await repository.getExperiment(input.userId, input.experimentId)
  const lineage = await repository.listVariantLineage(input.userId, input.experimentId)
  if (!lineage.some((row) => row.variant_id === input.observation.variantId)) {
    throw new Error("GROWTH_CREATIVE_OBSERVATION_VARIANT_NOT_IN_EXPERIMENT")
  }

  buildCreativeExperimentFeatureRows([{
    variantId: input.observation.variantId,
    stratum: `experiment:${experiment.experiment_key}`,
    exposures: input.observation.exposures,
    clicks: input.clicks,
    conversions: input.observation.conversions,
    payments: input.payments,
    spend: input.observation.spend,
    contributionMargin: input.observation.contributionMargin,
    observedAt: input.observation.observedAt,
    evidenceRefs: input.observation.evidenceRefs,
  }])

  const observationFingerprint = fingerprint({
    experimentId: input.experimentId,
    observationKey: input.observationKey,
    observation: input.observation,
    clicks: input.clicks ?? null,
    payments: input.payments ?? null,
  })

  return repository.recordObservation({
    experimentId: input.experimentId,
    observation: input.observation,
    observationKey: input.observationKey,
    observationFingerprint,
    clicks: input.clicks,
    payments: input.payments,
  })
}

export interface PersistedExperimentAssessment {
  health: GrowthEvidenceFeedHealthAssessment
  assessments: readonly BinaryCreativeExperimentAssessment[]
  learningCandidates: readonly string[]
  canPromoteLearning: boolean
  authority: "LEARNING_ONLY"
}

export async function assessPersistedCreativeExperiment(
  input: {
    userId: string
    experimentId: string
    healthInput: GrowthEvidenceFeedHealthInput
    assessedAt: string
  },
  overrides: CreativeExperimentRuntimeOverrides = {},
): Promise<PersistedExperimentAssessment> {
  const repository = overrides.repository ?? createGrowthCreativeExperimentRepository()
  if (!Number.isFinite(Date.parse(input.assessedAt))) throw new Error("GROWTH_CREATIVE_ASSESSED_AT_INVALID")

  const experiment = await repository.getExperiment(input.userId, input.experimentId)
  const plan = experiment.plan
  if (plan.authority !== "LEARNING_PLAN_ONLY") throw new Error("GROWTH_CREATIVE_EXPERIMENT_AUTHORITY_INVALID")

  const health = assessGrowthEvidenceFeedHealth(input.healthInput)
  const healthFingerprint = fingerprint({
    experimentId: input.experimentId,
    assessment: health,
  })
  const persistedHealth = await repository.recordEvidenceHealth({
    experimentId: input.experimentId,
    assessment: health,
    assessmentKey: `health:${health.id}:${health.checkedAt}`,
    assessmentFingerprint: healthFingerprint,
  })

  const observationRows = await repository.listExperimentObservations(input.userId, input.experimentId)
  const observations: BinaryCreativeVariantObservation[] = observationRows.map((row) => ({
    variantId: row.variant_id,
    exposures: Number(row.exposures),
    conversions: Number(row.conversions),
    spend: Number(row.spend),
    contributionMargin: Number(row.contribution_margin),
    observedAt: row.observed_at,
    evidenceRefs: row.evidence_refs,
  }))

  const assessments: BinaryCreativeExperimentAssessment[] = []
  for (const binary of plan.binaryExperiments) {
    const assessment = assessBinaryCreativeExperiment({
      experiment: binary,
      observations,
    })
    if (assessment.authority !== "LEARNING_ONLY") throw new Error("GROWTH_CREATIVE_ASSESSMENT_AUTHORITY_INVALID")
    const assessmentFingerprint = fingerprint({
      experimentId: input.experimentId,
      healthAssessmentId: persistedHealth.id,
      assessedAt: input.assessedAt,
      assessment,
    })
    await repository.recordAssessment({
      experimentId: input.experimentId,
      assessment,
      assessmentKey: `assessment:${assessment.experimentId}:${assessment.treatmentVariantId}:${input.assessedAt}`,
      assessmentFingerprint,
      healthAssessmentId: persistedHealth.id,
      assessedAt: input.assessedAt,
    })
    assessments.push(assessment)
  }

  const learningCandidates = health.allowedForLearning
    ? assessments
      .filter((assessment) =>
        assessment.status === "statistically_supported"
        && assessment.decision === "promote_treatment_for_next_test",
      )
      .map((assessment) => String(assessment.treatmentVariantId))
    : []

  return Object.freeze({
    health,
    assessments: Object.freeze(assessments),
    learningCandidates: Object.freeze(learningCandidates),
    canPromoteLearning: health.allowedForLearning && learningCandidates.length > 0,
    authority: "LEARNING_ONLY",
  })
}

export async function transitionCreativeExperimentStatus(
  input: {
    experimentId: string
    expectedStatus: GrowthCreativeExperimentStatus
    status: GrowthCreativeExperimentStatus
  },
  overrides: CreativeExperimentRuntimeOverrides = {},
) {
  const repository = overrides.repository ?? createGrowthCreativeExperimentRepository()
  return repository.setStatus(input)
}

function validatePlanAndLineage(
  plan: AdCreativeExperimentPlan,
  lineages: readonly AdCreativeVariantLineage[],
): AdCreativeExperimentPlan {
  if (plan.authority !== "LEARNING_PLAN_ONLY") throw new Error("GROWTH_CREATIVE_EXPERIMENT_AUTHORITY_INVALID")
  if (!plan.binaryExperiments.length || !plan.treatmentVariantIds.length) {
    throw new Error("GROWTH_CREATIVE_EXPERIMENT_BINARY_PLAN_REQUIRED")
  }
  if (plan.binaryExperiments.some((item) => !item.requireNonNegativeIncrementalContribution)) {
    throw new Error("GROWTH_CREATIVE_EXPERIMENT_ECONOMIC_GATE_REQUIRED")
  }

  const validated = lineages.map((lineage) => {
    if (lineage.authority !== "EXPERIMENT_INPUT_ONLY") {
      throw new Error("GROWTH_CREATIVE_VARIANT_AUTHORITY_INVALID")
    }
    const { authority: _authority, ...raw } = lineage
    return createAdCreativeVariantLineage(raw)
  })

  const control = validated.find((lineage) => lineage.id === plan.controlVariantId)
  if (!control) throw new Error("GROWTH_CREATIVE_EXPERIMENT_CONTROL_LINEAGE_REQUIRED")
  const treatments = plan.treatmentVariantIds.map((id) => {
    const lineage = validated.find((candidate) => candidate.id === id)
    if (!lineage) throw new Error(`GROWTH_CREATIVE_EXPERIMENT_TREATMENT_LINEAGE_MISSING:${id}`)
    return lineage
  })

  const expectedIds = new Set([String(plan.controlVariantId), ...plan.treatmentVariantIds.map(String)])
  if (validated.length !== expectedIds.size || validated.some((lineage) => !expectedIds.has(String(lineage.id)))) {
    throw new Error("GROWTH_CREATIVE_EXPERIMENT_LINEAGE_SET_MISMATCH")
  }

  const first = plan.binaryExperiments[0]!
  const rebuilt = buildIsolatedAdCreativeExperimentPlan({
    id: plan.id,
    control,
    treatments,
    hypotheses: plan.hypotheses,
    minimumExposuresPerVariant: first.minimumExposuresPerVariant,
    minimumConversionsPerVariant: first.minimumConversionsPerVariant,
    alpha: first.alpha * treatments.length,
    minimumRelativeLift: first.minimumRelativeLift,
    evidenceRefs: plan.evidenceRefs,
  })

  if (fingerprint(rebuilt) !== fingerprint(plan)) {
    throw new Error("GROWTH_CREATIVE_EXPERIMENT_PLAN_VALIDATION_MISMATCH")
  }
  return rebuilt
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex")
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    )
  }
  return value
}
