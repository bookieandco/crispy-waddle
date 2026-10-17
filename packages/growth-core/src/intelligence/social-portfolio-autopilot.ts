import type { GrowthId, ISODateTime } from "../domain/types.js";
import {
  assessBinaryCreativeExperiment,
  type BinaryCreativeExperiment,
  type BinaryCreativeExperimentAssessment,
  type BinaryCreativeVariantObservation,
} from "../experiments/creative-ab-experiment.js";
import { rankProspects } from "./audience-intelligence.js";

export type PortfolioSocialPlatform =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x"
  | "linkedin"
  | "threads"
  | "reddit"
  | "pinterest"
  | "snapchat";

export interface NicheAlgorithmObservation {
  id: GrowthId;
  brandId: GrowthId;
  platform: PortfolioSocialPlatform;
  nicheKey: string;
  contentFormat: string;
  creativeMechanic: string;
  audienceRef: string;
  placement?: string;
  audienceLocalWindow: string;
  publishedAt: ISODateTime;
  observedAt: ISODateTime;
  impressions: number;
  views: number;
  watchSeconds?: number;
  completions?: number;
  shares: number;
  saves: number;
  comments: number;
  profileVisits: number;
  destinationActions: number;
  conversions: number;
  contributionMargin: number;
  evidenceRefs: readonly string[];
}

export interface NicheAlgorithmProfile {
  id: GrowthId;
  platform: PortfolioSocialPlatform;
  nicheKey: string;
  sampleSize: number;
  observedFrom: ISODateTime;
  observedThrough: ISODateTime;
  baselines: Readonly<{
    shareRate: number;
    saveRate: number;
    commentRate: number;
    profileVisitRate: number;
    destinationActionRate: number;
    conversionRate: number;
    completionRate?: number;
    contributionMarginPerThousandImpressions: number;
  }>;
  strongestMechanics: readonly Readonly<{
    mechanic: string;
    score: number;
    sampleSize: number;
    evidenceRefs: readonly string[];
  }>[];
  strongestFormats: readonly Readonly<{
    format: string;
    score: number;
    sampleSize: number;
    evidenceRefs: readonly string[];
  }>[];
  strongestTimeWindows: readonly Readonly<{
    timeWindow: string;
    score: number;
    sampleSize: number;
    evidenceRefs: readonly string[];
  }>[];
  evidenceRefs: readonly string[];
  policy: Readonly<{
    observedBehaviorNotPlatformLaw: true;
    staleProfilesMustBeRelearned: true;
    vanityMetricsCannotOverrideBusinessOutcomes: true;
  }>;
  authority: "ALGORITHM_LEARNING_ONLY";
}

export interface ReadyBuyerCandidate {
  entityId: GrowthId;
  source: "first_party_behavior" | "provider_intent_segment";
  intentScore: number;
  lookalikeScore: number;
  evidenceRefs: readonly string[];
}

export interface ReadyBuyerAudiencePlan {
  id: GrowthId;
  brandId: GrowthId;
  selectedSeedEntityIds: readonly GrowthId[];
  hotCount: number;
  warmCount: number;
  providerLookalikeRequested: boolean;
  providerIntentExpansionRequested: boolean;
  minimumCombinedScore: number;
  evidenceRefs: readonly string[];
  policy: Readonly<{
    firstPartyOrProviderAggregateOnly: true;
    sensitiveFeatureTargetingAllowed: false;
    covertSensitiveInferenceAllowed: false;
    directContactAuthority: "NONE";
    providerLookalikeUsesPlatformNativeControls: true;
  }>;
  authority: "AUDIENCE_PLANNING_ONLY";
}

export interface PortfolioPaidExperimentPlan {
  id: GrowthId;
  brandId: GrowthId;
  channel: "meta" | "google" | "tiktok" | "linkedin" | "reddit" | "pinterest";
  objective: string;
  audienceIds: readonly GrowthId[];
  controlCreativeId: GrowthId;
  treatmentCreativeId: GrowthId;
  testAxis: "creative" | "audience" | "placement" | "landing_page";
  minimumExposuresPerVariant: number;
  minimumConversionsPerVariant: number;
  minimumRelativeLift: number;
  requireNonNegativeIncrementalContribution: true;
  dailyBudgetMinor: number;
  lifetimeBudgetMinor: number;
  currency: string;
  landingPageRef?: string;
  evidenceRefs: readonly string[];
  policy: Readonly<{
    oneMeaningfulVariableAtATime: true;
    autoBudgetIncreaseAllowed: false;
    autoSpendAuthority: "NONE";
    winnerMustPassStatisticalAndEconomicGate: true;
  }>;
  authority: "PAID_EXPERIMENT_PLAN_ONLY";
}

export interface PortfolioExperimentDecision {
  experimentId: GrowthId;
  decision: "SCALE_NEXT_TEST" | "ITERATE" | "KILL_TREATMENT" | "HOLD";
  reason: string;
  winnerVariantId?: GrowthId;
  assessment: BinaryCreativeExperimentAssessment;
  evidenceRefs: readonly string[];
  policy: Readonly<{
    killMeansRetireTreatmentNotDeleteEvidence: true;
    scaleMeansNextApprovedTestNotUnboundedSpend: true;
    learningOnly: true;
  }>;
  authority: "PORTFOLIO_LEARNING_ONLY";
}

export interface CrossPortfolioMarketingLearning {
  id: GrowthId;
  sourceExperimentId: GrowthId;
  brandId: GrowthId;
  nicheKey: string;
  platform: PortfolioSocialPlatform;
  objective: string;
  audienceRef: string;
  creativeMechanic: string;
  contentFormat: string;
  placement?: string;
  timeWindow: string;
  result: "promote" | "iterate" | "retire";
  reusablePrinciple: string;
  transferScope: readonly string[];
  evidenceRefs: readonly string[];
  promotableToJhadinaIntelligence: boolean;
  authority: "CROSS_PORTFOLIO_LEARNING_ONLY";
}

export function buildNicheAlgorithmProfile(input: {
  id: GrowthId;
  platform: PortfolioSocialPlatform;
  nicheKey: string;
  observations: readonly NicheAlgorithmObservation[];
  asOf?: ISODateTime;
  maxAgeDays?: number;
}): NicheAlgorithmProfile {
  requireText(input.id, "id");
  requireText(input.nicheKey, "nicheKey");
  if (!input.observations.length) {
    throw new Error("GROWTH_NICHE_ALGORITHM_OBSERVATIONS_REQUIRED");
  }
  const asOf = input.asOf ?? new Date().toISOString();
  requireDate(asOf, "asOf");
  const maxAgeDays = input.maxAgeDays ?? 45;
  if (!Number.isFinite(maxAgeDays) || maxAgeDays <= 0) {
    throw new Error("GROWTH_NICHE_ALGORITHM_MAX_AGE_INVALID");
  }

  const cutoff = Date.parse(asOf) - maxAgeDays * 86_400_000;
  const rows = input.observations
    .map(validateAlgorithmObservation)
    .filter((row) =>
      row.platform === input.platform
      && row.nicheKey === input.nicheKey
      && Date.parse(row.observedAt) >= cutoff,
    );

  if (!rows.length) {
    throw new Error("GROWTH_NICHE_ALGORITHM_FRESH_OBSERVATIONS_REQUIRED");
  }

  const impressions = sum(rows, (row) => row.impressions);
  const views = sum(rows, (row) => row.views);
  const completions = sum(rows, (row) => row.completions ?? 0);
  const baselines = Object.freeze({
    shareRate: rate(sum(rows, (row) => row.shares), views),
    saveRate: rate(sum(rows, (row) => row.saves), views),
    commentRate: rate(sum(rows, (row) => row.comments), views),
    profileVisitRate: rate(sum(rows, (row) => row.profileVisits), impressions),
    destinationActionRate: rate(
      sum(rows, (row) => row.destinationActions),
      impressions,
    ),
    conversionRate: rate(sum(rows, (row) => row.conversions), impressions),
    completionRate: completions > 0 ? rate(completions, views) : undefined,
    contributionMarginPerThousandImpressions:
      impressions > 0
        ? sum(rows, (row) => row.contributionMargin) / impressions * 1000
        : 0,
  });

  return Object.freeze({
    id: input.id,
    platform: input.platform,
    nicheKey: input.nicheKey,
    sampleSize: rows.length,
    observedFrom: [...rows].sort((a, b) =>
      Date.parse(a.observedAt) - Date.parse(b.observedAt))[0]!.observedAt,
    observedThrough: [...rows].sort((a, b) =>
      Date.parse(b.observedAt) - Date.parse(a.observedAt))[0]!.observedAt,
    baselines,
    strongestMechanics: Object.freeze(rankDimension(rows, "creativeMechanic").map((row) => ({
      mechanic: row.value,
      score: row.score,
      sampleSize: row.sampleSize,
      evidenceRefs: row.evidenceRefs,
    }))),
    strongestFormats: Object.freeze(rankDimension(rows, "contentFormat").map((row) => ({
      format: row.value,
      score: row.score,
      sampleSize: row.sampleSize,
      evidenceRefs: row.evidenceRefs,
    }))),
    strongestTimeWindows: Object.freeze(rankDimension(rows, "audienceLocalWindow").map((row) => ({
      timeWindow: row.value,
      score: row.score,
      sampleSize: row.sampleSize,
      evidenceRefs: row.evidenceRefs,
    }))),
    evidenceRefs: Object.freeze(unique(rows.flatMap((row) => row.evidenceRefs))),
    policy: Object.freeze({
      observedBehaviorNotPlatformLaw: true as const,
      staleProfilesMustBeRelearned: true as const,
      vanityMetricsCannotOverrideBusinessOutcomes: true as const,
    }),
    authority: "ALGORITHM_LEARNING_ONLY" as const,
  });
}

export function buildReadyBuyerAudiencePlan(input: {
  id: GrowthId;
  brandId: GrowthId;
  candidates: readonly ReadyBuyerCandidate[];
  minimumCombinedScore?: number;
  maxSeeds?: number;
  providerLookalikeRequested?: boolean;
  providerIntentExpansionRequested?: boolean;
  evidenceRefs: readonly string[];
}): ReadyBuyerAudiencePlan {
  requireText(input.id, "id");
  requireText(input.brandId, "brandId");
  if (!input.candidates.length) {
    throw new Error("GROWTH_READY_BUYER_CANDIDATES_REQUIRED");
  }
  if (!input.evidenceRefs.length) {
    throw new Error("GROWTH_READY_BUYER_EVIDENCE_REQUIRED");
  }
  const minimumCombinedScore = input.minimumCombinedScore ?? 0.55;
  if (
    !Number.isFinite(minimumCombinedScore)
    || minimumCombinedScore < 0
    || minimumCombinedScore > 1
  ) {
    throw new Error("GROWTH_READY_BUYER_THRESHOLD_INVALID");
  }
  const maxSeeds = input.maxSeeds ?? 1000;
  if (!Number.isInteger(maxSeeds) || maxSeeds < 1 || maxSeeds > 10_000) {
    throw new Error("GROWTH_READY_BUYER_MAX_SEEDS_INVALID");
  }

  for (const candidate of input.candidates) {
    requireText(candidate.entityId, "candidate.entityId");
    if (
      candidate.source !== "first_party_behavior"
      && candidate.source !== "provider_intent_segment"
    ) {
      throw new Error("GROWTH_READY_BUYER_SOURCE_INVALID");
    }
    for (const score of [candidate.intentScore, candidate.lookalikeScore]) {
      if (!Number.isFinite(score) || score < 0 || score > 1) {
        throw new Error("GROWTH_READY_BUYER_SCORE_INVALID");
      }
    }
    if (!candidate.evidenceRefs.length) {
      throw new Error("GROWTH_READY_BUYER_CANDIDATE_EVIDENCE_REQUIRED");
    }
  }

  const ranked = rankProspects(input.candidates.map((candidate) => ({
    entityId: candidate.entityId,
    lookalikeScore: candidate.lookalikeScore,
    intentScore: candidate.intentScore,
  })));

  const selected = ranked
    .filter((candidate) => candidate.combinedScore >= minimumCombinedScore)
    .slice(0, maxSeeds);
  const selectedById = new Map(input.candidates.map((candidate) => [
    candidate.entityId,
    candidate,
  ]));

  return Object.freeze({
    id: input.id,
    brandId: input.brandId,
    selectedSeedEntityIds: Object.freeze(selected.map((candidate) => candidate.entityId)),
    hotCount: selected.filter((candidate) => candidate.intentScore >= 0.75).length,
    warmCount: selected.filter((candidate) =>
      candidate.intentScore >= 0.45 && candidate.intentScore < 0.75).length,
    providerLookalikeRequested: input.providerLookalikeRequested ?? true,
    providerIntentExpansionRequested:
      input.providerIntentExpansionRequested ?? true,
    minimumCombinedScore,
    evidenceRefs: Object.freeze(unique([
      ...input.evidenceRefs,
      ...selected.flatMap((candidate) =>
        selectedById.get(candidate.entityId)?.evidenceRefs ?? []),
    ])),
    policy: Object.freeze({
      firstPartyOrProviderAggregateOnly: true as const,
      sensitiveFeatureTargetingAllowed: false as const,
      covertSensitiveInferenceAllowed: false as const,
      directContactAuthority: "NONE" as const,
      providerLookalikeUsesPlatformNativeControls: true as const,
    }),
    authority: "AUDIENCE_PLANNING_ONLY" as const,
  });
}

export function compilePortfolioPaidExperiment(input: {
  id: GrowthId;
  brandId: GrowthId;
  channel: PortfolioPaidExperimentPlan["channel"];
  objective: string;
  audienceIds: readonly GrowthId[];
  controlCreativeId: GrowthId;
  treatmentCreativeId: GrowthId;
  testAxis: PortfolioPaidExperimentPlan["testAxis"];
  dailyBudgetMinor: number;
  lifetimeBudgetMinor: number;
  currency: string;
  landingPageRef?: string;
  minimumExposuresPerVariant?: number;
  minimumConversionsPerVariant?: number;
  minimumRelativeLift?: number;
  evidenceRefs: readonly string[];
}): PortfolioPaidExperimentPlan {
  for (const value of [
    input.id,
    input.brandId,
    input.objective,
    input.controlCreativeId,
    input.treatmentCreativeId,
  ]) requireText(value, "paid");
  if (input.controlCreativeId === input.treatmentCreativeId) {
    throw new Error("GROWTH_PORTFOLIO_PAID_VARIANTS_MUST_DIFFER");
  }
  if (!input.audienceIds.length) {
    throw new Error("GROWTH_PORTFOLIO_PAID_AUDIENCE_REQUIRED");
  }
  if (!input.evidenceRefs.length) {
    throw new Error("GROWTH_PORTFOLIO_PAID_EVIDENCE_REQUIRED");
  }
  if (!Number.isSafeInteger(input.dailyBudgetMinor) || input.dailyBudgetMinor <= 0) {
    throw new Error("GROWTH_PORTFOLIO_PAID_DAILY_BUDGET_INVALID");
  }
  if (
    !Number.isSafeInteger(input.lifetimeBudgetMinor)
    || input.lifetimeBudgetMinor < input.dailyBudgetMinor
  ) {
    throw new Error("GROWTH_PORTFOLIO_PAID_LIFETIME_BUDGET_INVALID");
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new Error("GROWTH_PORTFOLIO_PAID_CURRENCY_INVALID");
  }

  return Object.freeze({
    id: input.id,
    brandId: input.brandId,
    channel: input.channel,
    objective: input.objective.trim(),
    audienceIds: Object.freeze(unique(input.audienceIds) as GrowthId[]),
    controlCreativeId: input.controlCreativeId,
    treatmentCreativeId: input.treatmentCreativeId,
    testAxis: input.testAxis,
    minimumExposuresPerVariant: input.minimumExposuresPerVariant ?? 1000,
    minimumConversionsPerVariant: input.minimumConversionsPerVariant ?? 10,
    minimumRelativeLift: input.minimumRelativeLift ?? 0.10,
    requireNonNegativeIncrementalContribution: true as const,
    dailyBudgetMinor: input.dailyBudgetMinor,
    lifetimeBudgetMinor: input.lifetimeBudgetMinor,
    currency: input.currency,
    landingPageRef: input.landingPageRef,
    evidenceRefs: Object.freeze(unique(input.evidenceRefs)),
    policy: Object.freeze({
      oneMeaningfulVariableAtATime: true as const,
      autoBudgetIncreaseAllowed: false as const,
      autoSpendAuthority: "NONE" as const,
      winnerMustPassStatisticalAndEconomicGate: true as const,
    }),
    authority: "PAID_EXPERIMENT_PLAN_ONLY" as const,
  });
}

export function assessPortfolioPaidExperiment(input: {
  plan: PortfolioPaidExperimentPlan;
  observations: readonly BinaryCreativeVariantObservation[];
}): PortfolioExperimentDecision {
  const experiment: BinaryCreativeExperiment = {
    id: input.plan.id,
    controlVariantId: input.plan.controlCreativeId,
    treatmentVariantId: input.plan.treatmentCreativeId,
    hypothesis: `${input.plan.testAxis} treatment improves ${input.plan.objective}`,
    minimumExposuresPerVariant: input.plan.minimumExposuresPerVariant,
    minimumConversionsPerVariant: input.plan.minimumConversionsPerVariant,
    alpha: 0.05,
    minimumRelativeLift: input.plan.minimumRelativeLift,
    requireNonNegativeIncrementalContribution:
      input.plan.requireNonNegativeIncrementalContribution,
  };
  const assessment = assessBinaryCreativeExperiment({
    experiment,
    observations: input.observations,
  });

  let decision: PortfolioExperimentDecision["decision"];
  let reason: string;
  let winnerVariantId: GrowthId | undefined;

  switch (assessment.decision) {
    case "promote_treatment_for_next_test":
      decision = "SCALE_NEXT_TEST";
      reason = "Treatment passed statistical, practical, and contribution gates.";
      winnerVariantId = assessment.treatmentVariantId;
      break;
    case "do_not_scale_treatment":
      decision = "KILL_TREATMENT";
      reason = "Treatment underperformed or failed the economic scale gate.";
      winnerVariantId = assessment.controlVariantId;
      break;
    case "preserve_control":
      decision = "ITERATE";
      reason = "Evidence is inconclusive; preserve the control and test one new variable.";
      winnerVariantId = assessment.controlVariantId;
      break;
    case "keep_collecting":
      decision = "HOLD";
      reason = "Minimum evidence requirements have not been met.";
      break;
  }

  return Object.freeze({
    experimentId: input.plan.id,
    decision,
    reason,
    winnerVariantId,
    assessment,
    evidenceRefs: Object.freeze(unique([
      ...input.plan.evidenceRefs,
      ...assessment.evidenceRefs,
    ])),
    policy: Object.freeze({
      killMeansRetireTreatmentNotDeleteEvidence: true as const,
      scaleMeansNextApprovedTestNotUnboundedSpend: true as const,
      learningOnly: true as const,
    }),
    authority: "PORTFOLIO_LEARNING_ONLY" as const,
  });
}

export function createCrossPortfolioMarketingLearning(input: {
  id: GrowthId;
  decision: PortfolioExperimentDecision;
  brandId: GrowthId;
  nicheKey: string;
  platform: PortfolioSocialPlatform;
  objective: string;
  audienceRef: string;
  creativeMechanic: string;
  contentFormat: string;
  placement?: string;
  timeWindow: string;
  transferScope: readonly string[];
  evidenceRefs: readonly string[];
}): CrossPortfolioMarketingLearning {
  for (const value of [
    input.id,
    input.brandId,
    input.nicheKey,
    input.objective,
    input.audienceRef,
    input.creativeMechanic,
    input.contentFormat,
    input.timeWindow,
  ]) requireText(value, "learning");
  if (!input.transferScope.length || !input.evidenceRefs.length) {
    throw new Error("GROWTH_PORTFOLIO_LEARNING_EVIDENCE_REQUIRED");
  }

  const result: CrossPortfolioMarketingLearning["result"] =
    input.decision.decision === "SCALE_NEXT_TEST"
      ? "promote"
      : input.decision.decision === "KILL_TREATMENT"
        ? "retire"
        : "iterate";

  const reusablePrinciple = [
    `${input.platform}/${input.nicheKey}`,
    `objective=${input.objective}`,
    `audience=${input.audienceRef}`,
    `mechanic=${input.creativeMechanic}`,
    `format=${input.contentFormat}`,
    input.placement ? `placement=${input.placement}` : undefined,
    `time=${input.timeWindow}`,
    `result=${result}`,
  ].filter(Boolean).join("; ");

  return Object.freeze({
    id: input.id,
    sourceExperimentId: input.decision.experimentId,
    brandId: input.brandId,
    nicheKey: input.nicheKey,
    platform: input.platform,
    objective: input.objective,
    audienceRef: input.audienceRef,
    creativeMechanic: input.creativeMechanic,
    contentFormat: input.contentFormat,
    placement: input.placement,
    timeWindow: input.timeWindow,
    result,
    reusablePrinciple,
    transferScope: Object.freeze(unique(input.transferScope)),
    evidenceRefs: Object.freeze(unique([
      ...input.evidenceRefs,
      ...input.decision.evidenceRefs,
    ])),
    promotableToJhadinaIntelligence:
      input.decision.assessment.status === "statistically_supported"
      && input.decision.decision === "SCALE_NEXT_TEST",
    authority: "CROSS_PORTFOLIO_LEARNING_ONLY" as const,
  });
}

function rankDimension(
  rows: readonly NicheAlgorithmObservation[],
  key: "creativeMechanic" | "contentFormat" | "audienceLocalWindow",
): readonly Readonly<{
  value: string;
  score: number;
  sampleSize: number;
  evidenceRefs: readonly string[];
}>[] {
  const groups = new Map<string, NicheAlgorithmObservation[]>();
  for (const row of rows) {
    const value = row[key];
    const group = groups.get(value) ?? [];
    group.push(row);
    groups.set(value, group);
  }

  return [...groups.entries()]
    .map(([value, group]) => {
      const impressions = sum(group, (row) => row.impressions);
      const views = sum(group, (row) => row.views);
      const qualified =
        rate(sum(group, (row) => row.destinationActions), impressions)
        + rate(sum(group, (row) => row.conversions), impressions) * 2
        + rate(sum(group, (row) => row.shares), views) * 0.5
        + rate(sum(group, (row) => row.saves), views) * 0.25;
      const economics =
        impressions > 0
          ? sum(group, (row) => row.contributionMargin) / impressions
          : 0;
      const score = qualified + Math.max(-1, Math.min(1, economics));
      return Object.freeze({
        value,
        score,
        sampleSize: group.length,
        evidenceRefs: Object.freeze(unique(group.flatMap((row) => row.evidenceRefs))),
      });
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function validateAlgorithmObservation(
  row: NicheAlgorithmObservation,
): NicheAlgorithmObservation {
  for (const value of [
    row.id,
    row.brandId,
    row.nicheKey,
    row.contentFormat,
    row.creativeMechanic,
    row.audienceRef,
    row.audienceLocalWindow,
  ]) requireText(value, "observation");
  requireDate(row.publishedAt, "publishedAt");
  requireDate(row.observedAt, "observedAt");
  if (!row.evidenceRefs.length) {
    throw new Error("GROWTH_NICHE_ALGORITHM_EVIDENCE_REQUIRED");
  }
  for (const [name, value] of Object.entries({
    impressions: row.impressions,
    views: row.views,
    watchSeconds: row.watchSeconds ?? 0,
    completions: row.completions ?? 0,
    shares: row.shares,
    saves: row.saves,
    comments: row.comments,
    profileVisits: row.profileVisits,
    destinationActions: row.destinationActions,
    conversions: row.conversions,
  })) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`GROWTH_NICHE_ALGORITHM_METRIC_INVALID:${name}`);
    }
  }
  if (!Number.isFinite(row.contributionMargin)) {
    throw new Error("GROWTH_NICHE_ALGORITHM_MARGIN_INVALID");
  }
  return row;
}

function sum<T>(rows: readonly T[], selector: (row: T) => number): number {
  return rows.reduce((total, row) => total + selector(row), 0);
}

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function requireText(value: string, field: string): void {
  if (!value.trim()) throw new Error(`GROWTH_PORTFOLIO_FIELD_REQUIRED:${field}`);
}

function requireDate(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`GROWTH_PORTFOLIO_DATE_INVALID:${field}`);
  }
}

function unique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean) as T[])];
}
