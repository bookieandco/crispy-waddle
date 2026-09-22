import type { GrowthId, ISODateTime } from "../domain/types.js";
import type { CreativeEvidenceSignal } from "../intelligence/creative-evidence-engine.js";
import {
  assertGrowthEvidenceHealthyForLearning,
  type GrowthEvidenceFeedHealthAssessment,
} from "../evidence/evidence-health.js";

export interface BinaryCreativeVariantObservation {
  variantId: GrowthId;
  exposures: number;
  conversions: number;
  spend: number;
  contributionMargin: number;
  observedAt: ISODateTime;
  evidenceRefs: readonly string[];
}

export interface BinaryCreativeExperiment {
  id: GrowthId;
  controlVariantId: GrowthId;
  treatmentVariantId: GrowthId;
  hypothesis: string;
  minimumExposuresPerVariant: number;
  minimumConversionsPerVariant: number;
  alpha: number;
  minimumRelativeLift: number;
  requireNonNegativeIncrementalContribution: boolean;
}

export interface BinaryCreativeExperimentAssessment {
  experimentId: GrowthId;
  controlVariantId: GrowthId;
  treatmentVariantId: GrowthId;
  controlRate: number;
  treatmentRate: number;
  absoluteLift: number;
  relativeLift?: number;
  zScore?: number;
  pValue?: number;
  confidenceInterval95?: readonly [number, number];
  incrementalContribution: number;
  incrementalContributionPerExposure: number;
  evidenceRefs: readonly string[];
  status:
    | "insufficient_evidence"
    | "inconclusive"
    | "statistically_supported"
    | "statistically_supported_but_economically_weak"
    | "treatment_underperformed";
  decision:
    | "keep_collecting"
    | "preserve_control"
    | "promote_treatment_for_next_test"
    | "do_not_scale_treatment";
  authority: "LEARNING_ONLY";
}

export function assessBinaryCreativeExperiment(input: {
  experiment: BinaryCreativeExperiment;
  observations: readonly BinaryCreativeVariantObservation[];
}): BinaryCreativeExperimentAssessment {
  const { experiment } = input;
  assertExperiment(experiment);

  const control = aggregateVariant(input.observations, experiment.controlVariantId);
  const treatment = aggregateVariant(input.observations, experiment.treatmentVariantId);
  if (!control || !treatment) throw new Error("GROWTH_AB_VARIANTS_REQUIRED");

  const evidenceRefs = Object.freeze([
    ...new Set([...control.evidenceRefs, ...treatment.evidenceRefs]),
  ]);
  const controlRate = control.conversions / Math.max(1, control.exposures);
  const treatmentRate = treatment.conversions / Math.max(1, treatment.exposures);
  const absoluteLift = treatmentRate - controlRate;
  const relativeLift = controlRate > 0 ? absoluteLift / controlRate : undefined;
  const incrementalContribution = treatment.contributionMargin - control.contributionMargin;
  const incrementalContributionPerExposure =
    treatment.contributionMargin / Math.max(1, treatment.exposures)
    - control.contributionMargin / Math.max(1, control.exposures);

  const enoughEvidence =
    control.exposures >= experiment.minimumExposuresPerVariant
    && treatment.exposures >= experiment.minimumExposuresPerVariant
    && control.conversions >= experiment.minimumConversionsPerVariant
    && treatment.conversions >= experiment.minimumConversionsPerVariant;

  if (!enoughEvidence) {
    return {
      experimentId: experiment.id,
      controlVariantId: experiment.controlVariantId,
      treatmentVariantId: experiment.treatmentVariantId,
      controlRate,
      treatmentRate,
      absoluteLift,
      relativeLift,
      incrementalContribution,
      incrementalContributionPerExposure,
      evidenceRefs,
      status: "insufficient_evidence",
      decision: "keep_collecting",
      authority: "LEARNING_ONLY",
    };
  }

  const pooledRate =
    (control.conversions + treatment.conversions) / (control.exposures + treatment.exposures);
  const standardError = Math.sqrt(
    pooledRate * (1 - pooledRate)
    * (1 / control.exposures + 1 / treatment.exposures),
  );
  const zScore = standardError > 0 ? absoluteLift / standardError : undefined;
  const pValue = zScore === undefined ? undefined : 2 * (1 - normalCdf(Math.abs(zScore)));

  const unpooledSe = Math.sqrt(
    controlRate * (1 - controlRate) / control.exposures
    + treatmentRate * (1 - treatmentRate) / treatment.exposures,
  );
  const confidenceInterval95 = Object.freeze([
    absoluteLift - 1.96 * unpooledSe,
    absoluteLift + 1.96 * unpooledSe,
  ] as const);

  const statisticallySupported = pValue !== undefined && pValue <= experiment.alpha;
  const practicallyMeaningful =
    relativeLift !== undefined && relativeLift >= experiment.minimumRelativeLift;
  const economicPass =
    !experiment.requireNonNegativeIncrementalContribution
    || incrementalContributionPerExposure >= 0;

  let status: BinaryCreativeExperimentAssessment["status"];
  let decision: BinaryCreativeExperimentAssessment["decision"];

  if (absoluteLift < 0 && statisticallySupported) {
    status = "treatment_underperformed";
    decision = "do_not_scale_treatment";
  } else if (statisticallySupported && practicallyMeaningful && economicPass) {
    status = "statistically_supported";
    decision = "promote_treatment_for_next_test";
  } else if (statisticallySupported && practicallyMeaningful && !economicPass) {
    status = "statistically_supported_but_economically_weak";
    decision = "do_not_scale_treatment";
  } else {
    status = "inconclusive";
    decision = "preserve_control";
  }

  return {
    experimentId: experiment.id,
    controlVariantId: experiment.controlVariantId,
    treatmentVariantId: experiment.treatmentVariantId,
    controlRate,
    treatmentRate,
    absoluteLift,
    relativeLift,
    zScore,
    pValue,
    confidenceInterval95,
    incrementalContribution,
    incrementalContributionPerExposure,
    evidenceRefs,
    status,
    decision,
    authority: "LEARNING_ONLY",
  };
}

export interface CreativeExperimentFeatureRow {
  variantId: GrowthId;
  stratum: string;
  exposures: number;
  clicks?: number;
  conversions: number;
  payments?: number;
  spend: number;
  contributionMargin: number;
  observedAt: ISODateTime;
  evidenceRefs: readonly string[];
}

/**
 * Produces a covariate/stratum-aware dataset for downstream regression or ML.
 * Model output is advisory: randomization and causal experiment assignment remain
 * the source of treatment-effect evidence.
 */
export function buildCreativeExperimentFeatureRows(
  rows: readonly CreativeExperimentFeatureRow[],
): readonly CreativeExperimentFeatureRow[] {
  if (!rows.length) throw new Error("GROWTH_AB_FEATURE_ROWS_REQUIRED");
  return Object.freeze(rows.map((row) => {
    if (!row.variantId.trim() || !row.stratum.trim() || !row.evidenceRefs.length) {
      throw new Error("GROWTH_AB_FEATURE_ROW_INVALID");
    }
    for (const value of [row.exposures, row.conversions, row.spend, row.contributionMargin]) {
      if (!Number.isFinite(value)) throw new Error("GROWTH_AB_FEATURE_VALUE_INVALID");
    }
    if (row.exposures < 0 || row.conversions < 0 || row.conversions > row.exposures || row.spend < 0) {
      throw new Error("GROWTH_AB_FEATURE_VALUE_INVALID");
    }
    if (row.clicks !== undefined && (row.clicks < 0 || row.clicks > row.exposures)) {
      throw new Error("GROWTH_AB_FEATURE_VALUE_INVALID");
    }
    if (row.payments !== undefined && (row.payments < 0 || row.payments > row.conversions)) {
      throw new Error("GROWTH_AB_FEATURE_VALUE_INVALID");
    }
    if (!Number.isFinite(Date.parse(row.observedAt))) {
      throw new Error("GROWTH_AB_FEATURE_TIMESTAMP_INVALID");
    }
    return Object.freeze({ ...row, evidenceRefs: Object.freeze([...row.evidenceRefs]) });
  }));
}

function aggregateVariant(
  rows: readonly BinaryCreativeVariantObservation[],
  variantId: GrowthId,
): BinaryCreativeVariantObservation | undefined {
  const matching = rows.filter((row) => row.variantId === variantId);
  if (!matching.length) return undefined;
  let exposures = 0;
  let conversions = 0;
  let spend = 0;
  let contributionMargin = 0;
  const evidenceRefs = new Set<string>();
  let observedAt = matching[0]!.observedAt;

  for (const row of matching) {
    if (!row.evidenceRefs.length || !Number.isFinite(Date.parse(row.observedAt))) {
      throw new Error("GROWTH_AB_OBSERVATION_INVALID");
    }
    if (
      !Number.isInteger(row.exposures) || row.exposures < 0
      || !Number.isInteger(row.conversions) || row.conversions < 0
      || row.conversions > row.exposures
      || !Number.isFinite(row.spend) || row.spend < 0
      || !Number.isFinite(row.contributionMargin)
    ) {
      throw new Error("GROWTH_AB_OBSERVATION_INVALID");
    }
    exposures += row.exposures;
    conversions += row.conversions;
    spend += row.spend;
    contributionMargin += row.contributionMargin;
    row.evidenceRefs.forEach((ref) => evidenceRefs.add(ref));
    if (Date.parse(row.observedAt) > Date.parse(observedAt)) observedAt = row.observedAt;
  }

  return {
    variantId,
    exposures,
    conversions,
    spend,
    contributionMargin,
    observedAt,
    evidenceRefs: Object.freeze([...evidenceRefs]),
  };
}

function assertExperiment(experiment: BinaryCreativeExperiment): void {
  if (!experiment.id.trim() || !experiment.controlVariantId.trim() || !experiment.treatmentVariantId.trim()) {
    throw new Error("GROWTH_AB_EXPERIMENT_ID_REQUIRED");
  }
  if (experiment.controlVariantId === experiment.treatmentVariantId) {
    throw new Error("GROWTH_AB_VARIANTS_MUST_DIFFER");
  }
  if (!experiment.hypothesis.trim()) throw new Error("GROWTH_AB_HYPOTHESIS_REQUIRED");
  if (!Number.isInteger(experiment.minimumExposuresPerVariant) || experiment.minimumExposuresPerVariant < 1) {
    throw new Error("GROWTH_AB_MIN_EXPOSURES_INVALID");
  }
  if (!Number.isInteger(experiment.minimumConversionsPerVariant) || experiment.minimumConversionsPerVariant < 0) {
    throw new Error("GROWTH_AB_MIN_CONVERSIONS_INVALID");
  }
  if (!(experiment.alpha > 0 && experiment.alpha < 1)) {
    throw new Error("GROWTH_AB_ALPHA_INVALID");
  }
  if (!Number.isFinite(experiment.minimumRelativeLift) || experiment.minimumRelativeLift < 0) {
    throw new Error("GROWTH_AB_MIN_LIFT_INVALID");
  }
}

function normalCdf(x: number): number {
  // Abramowitz-Stegun approximation; deterministic and dependency-free.
  const t = 1 / (1 + 0.2316419 * x);
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const polynomial =
    t * (0.319381530
      + t * (-0.356563782
        + t * (1.781477937
          + t * (-1.821255978 + t * 1.330274429))));
  return 1 - d * polynomial;
}


export function promoteSupportedCreativeExperimentToEvidence(input: {
  assessment: BinaryCreativeExperimentAssessment;
  bigIdea: string;
  observedAt: ISODateTime;
  spend: number;
  conversions: number;
  contributionMargin: number;
  sourceRefs?: readonly string[];
  dataHealth: GrowthEvidenceFeedHealthAssessment;
}): CreativeEvidenceSignal {
  assertGrowthEvidenceHealthyForLearning(input.dataHealth);
  if (input.assessment.status !== "statistically_supported"
    || input.assessment.decision !== "promote_treatment_for_next_test") {
    throw new Error("GROWTH_AB_NOT_PROMOTABLE");
  }
  if (!input.bigIdea.trim()) throw new Error("GROWTH_AB_BIG_IDEA_REQUIRED");
  if (!Number.isFinite(Date.parse(input.observedAt))) {
    throw new Error("GROWTH_AB_OBSERVED_AT_INVALID");
  }
  if (!Number.isFinite(input.spend) || input.spend < 0
    || !Number.isInteger(input.conversions) || input.conversions < 0
    || !Number.isFinite(input.contributionMargin)) {
    throw new Error("GROWTH_AB_PROMOTION_METRICS_INVALID");
  }

  return Object.freeze({
    id: `ab-evidence:${input.assessment.experimentId}:${input.assessment.treatmentVariantId}`,
    evidenceClass: "first_party_performance",
    bigIdea: input.bigIdea.trim(),
    sourceRefs: Object.freeze([
      ...input.assessment.evidenceRefs,
      ...(input.sourceRefs ?? []),
      `data-health:${input.dataHealth.id}`,
      ...input.dataHealth.evidenceRefs,
      `experiment:${input.assessment.experimentId}`,
      `variant:${input.assessment.treatmentVariantId}`,
    ]),
    observedAt: input.observedAt,
    recurrence: 1,
    spend: input.spend,
    conversions: input.conversions,
    contributionMargin: input.contributionMargin,
  });
}
