import type { GrowthId, ISODateTime } from "../domain/types.js";
import type { ViralCampaignHypothesis } from "./viral-campaign-intelligence.js";
import type { PaidAccelerationReadiness } from "./social-paid-acceleration-readiness.js";
import type {
  CrossPortfolioMarketingLearning,
  NicheAlgorithmProfile,
  PortfolioExperimentDecision,
  PortfolioPaidExperimentPlan,
  ReadyBuyerAudiencePlan,
} from "./social-portfolio-autopilot.js";

export interface WeeklyMarketingCampaignReportInput {
  campaignId: GrowthId;
  brandId: GrowthId;
  campaignName: string;
  objective: string;
  ownerIdeaRefs: readonly string[];
  nicheProfile: NicheAlgorithmProfile;
  viralHypothesis: ViralCampaignHypothesis;
  readyBuyerPlan?: ReadyBuyerAudiencePlan;
  paidPlans?: readonly PortfolioPaidExperimentPlan[];
  paidReadiness?: PaidAccelerationReadiness;
  priorDecisions?: readonly PortfolioExperimentDecision[];
  admittedLearnings?: readonly CrossPortfolioMarketingLearning[];
  plannedActionRefs: readonly string[];
  evidenceRefs: readonly string[];
}

export interface WeeklyMarketingCampaignReportSection {
  campaignId: GrowthId;
  brandId: GrowthId;
  campaignName: string;
  objective: string;
  nicheKey: string;
  platform: string;
  viral: Readonly<{
    pursuitScore: number;
    phase: string;
    decision: string;
    mechanic: string;
    shareMotives: readonly string[];
  }>;
  algorithm: Readonly<{
    sampleSize: number;
    strongestMechanics: readonly string[];
    strongestFormats: readonly string[];
    strongestTimeWindows: readonly string[];
    conversionRate: number;
    contributionMarginPerThousandImpressions: number;
  }>;
  audience: Readonly<{
    selectedSeedCount: number;
    hotCount: number;
    warmCount: number;
    lookalikeRequested: boolean;
    providerIntentExpansionRequested: boolean;
  }>;
  paid: Readonly<{
    experimentCount: number;
    plannedLifetimeBudgetMinor: number;
    currencies: readonly string[];
    channels: readonly string[];
    readinessStatus?: PaidAccelerationReadiness["status"];
    eligibleForBoundedPaidTest: boolean;
    eligibleForAcceleration: boolean;
    readinessBlockers: readonly string[];
  }>;
  learning: Readonly<{
    scaleNextTest: number;
    killTreatment: number;
    iterate: number;
    hold: number;
    promotedPrinciples: readonly string[];
  }>;
  ownerIdeaRefs: readonly string[];
  plannedActionRefs: readonly string[];
  blockers: readonly string[];
  evidenceRefs: readonly string[];
}

export interface WeeklyMarketingReport {
  id: GrowthId;
  weekStartsAt: ISODateTime;
  weekEndsAt: ISODateTime;
  generatedAt: ISODateTime;
  approvalPacketRef: string;
  sections: readonly WeeklyMarketingCampaignReportSection[];
  totals: Readonly<{
    campaigns: number;
    plannedActions: number;
    paidExperiments: number;
    plannedPaidBudgetMinor: number;
    buyerSeeds: number;
    scaleNextTest: number;
    killTreatment: number;
    iterate: number;
    hold: number;
  }>;
  portfolioLearnings: readonly string[];
  blockers: readonly string[];
  evidenceRefs: readonly string[];
  policy: Readonly<{
    ownerApprovalCadence: "WEEKLY";
    executionAfterApproval: "BOUNDED_TO_EXACT_PACKET";
    changedPacketRequiresReapproval: true;
    spendIncreaseRequiresReapproval: true;
    newPublicCommentRequiresReapproval: true;
    crossPortfolioLearningMayInformButNotOverrideNicheEvidence: true;
  }>;
  authority: "WEEKLY_OWNER_REPORT_ONLY";
}

export function compileWeeklyMarketingReport(input: {
  id: GrowthId;
  weekStartsAt: ISODateTime;
  weekEndsAt: ISODateTime;
  generatedAt?: ISODateTime;
  approvalPacketRef: string;
  campaigns: readonly WeeklyMarketingCampaignReportInput[];
  evidenceRefs: readonly string[];
}): WeeklyMarketingReport {
  requireText(input.id, "id");
  requireText(input.approvalPacketRef, "approvalPacketRef");
  requireDate(input.weekStartsAt, "weekStartsAt");
  requireDate(input.weekEndsAt, "weekEndsAt");
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  requireDate(generatedAt, "generatedAt");
  if (Date.parse(input.weekEndsAt) <= Date.parse(input.weekStartsAt)) {
    throw new Error("GROWTH_WEEKLY_REPORT_WINDOW_INVALID");
  }
  if (!input.campaigns.length) {
    throw new Error("GROWTH_WEEKLY_REPORT_CAMPAIGN_REQUIRED");
  }
  if (!input.evidenceRefs.length) {
    throw new Error("GROWTH_WEEKLY_REPORT_EVIDENCE_REQUIRED");
  }

  const sections = input.campaigns.map(buildSection);
  const allLearnings = unique(
    input.campaigns.flatMap((campaign) =>
      (campaign.admittedLearnings ?? [])
        .filter((learning) => learning.promotableToJhadinaIntelligence)
        .map((learning) => learning.reusablePrinciple),
    ),
  );
  const blockers = unique(sections.flatMap((section) => section.blockers));

  return Object.freeze({
    id: input.id,
    weekStartsAt: input.weekStartsAt,
    weekEndsAt: input.weekEndsAt,
    generatedAt,
    approvalPacketRef: input.approvalPacketRef,
    sections: Object.freeze(sections),
    totals: Object.freeze({
      campaigns: sections.length,
      plannedActions: sections.reduce(
        (sum, section) => sum + section.plannedActionRefs.length,
        0,
      ),
      paidExperiments: sections.reduce(
        (sum, section) => sum + section.paid.experimentCount,
        0,
      ),
      plannedPaidBudgetMinor: sections.reduce(
        (sum, section) => sum + section.paid.plannedLifetimeBudgetMinor,
        0,
      ),
      buyerSeeds: sections.reduce(
        (sum, section) => sum + section.audience.selectedSeedCount,
        0,
      ),
      scaleNextTest: sections.reduce(
        (sum, section) => sum + section.learning.scaleNextTest,
        0,
      ),
      killTreatment: sections.reduce(
        (sum, section) => sum + section.learning.killTreatment,
        0,
      ),
      iterate: sections.reduce(
        (sum, section) => sum + section.learning.iterate,
        0,
      ),
      hold: sections.reduce(
        (sum, section) => sum + section.learning.hold,
        0,
      ),
    }),
    portfolioLearnings: Object.freeze(allLearnings),
    blockers: Object.freeze(blockers),
    evidenceRefs: Object.freeze(unique([
      ...input.evidenceRefs,
      ...sections.flatMap((section) => section.evidenceRefs),
    ])),
    policy: Object.freeze({
      ownerApprovalCadence: "WEEKLY" as const,
      executionAfterApproval: "BOUNDED_TO_EXACT_PACKET" as const,
      changedPacketRequiresReapproval: true as const,
      spendIncreaseRequiresReapproval: true as const,
      newPublicCommentRequiresReapproval: true as const,
      crossPortfolioLearningMayInformButNotOverrideNicheEvidence: true as const,
    }),
    authority: "WEEKLY_OWNER_REPORT_ONLY" as const,
  });
}

function buildSection(
  campaign: WeeklyMarketingCampaignReportInput,
): WeeklyMarketingCampaignReportSection {
  for (const value of [
    campaign.campaignId,
    campaign.brandId,
    campaign.campaignName,
    campaign.objective,
  ]) requireText(value, "campaign");
  if (!campaign.plannedActionRefs.length || !campaign.evidenceRefs.length) {
    throw new Error("GROWTH_WEEKLY_REPORT_CAMPAIGN_EVIDENCE_REQUIRED");
  }

  const paid = campaign.paidPlans ?? [];
  const decisions = campaign.priorDecisions ?? [];
  const learnings = (campaign.admittedLearnings ?? [])
    .filter((learning) => learning.promotableToJhadinaIntelligence);
  const blockers: string[] = [];

  if (campaign.viralHypothesis.testDecision === "HOLD") {
    blockers.push("VIRAL_HYPOTHESIS_HOLD");
  }
  if (campaign.nicheProfile.sampleSize < 2) {
    blockers.push("NICHE_SAMPLE_THIN");
  }
  if (paid.length && !campaign.readyBuyerPlan) {
    blockers.push("PAID_AUDIENCE_PLAN_MISSING");
  }
  if (paid.length && !campaign.paidReadiness) {
    blockers.push("PAID_ACCELERATION_READINESS_MISSING");
  }
  if (
    campaign.paidReadiness
    && campaign.paidReadiness.brandId !== campaign.brandId
  ) {
    throw new Error("GROWTH_WEEKLY_REPORT_PAID_READINESS_BRAND_MISMATCH");
  }
  if (
    paid.length
    && campaign.paidReadiness
    && !campaign.paidReadiness.eligibleForBoundedPaidTest
  ) {
    blockers.push(
      "PAID_ACCELERATION_HOLD",
      ...campaign.paidReadiness.blockers,
    );
  }

  return Object.freeze({
    campaignId: campaign.campaignId,
    brandId: campaign.brandId,
    campaignName: campaign.campaignName,
    objective: campaign.objective,
    nicheKey: campaign.nicheProfile.nicheKey,
    platform: campaign.nicheProfile.platform,
    viral: Object.freeze({
      pursuitScore: campaign.viralHypothesis.pursuitScore,
      phase: campaign.viralHypothesis.phase,
      decision: campaign.viralHypothesis.testDecision,
      mechanic: campaign.viralHypothesis.mechanic,
      shareMotives: Object.freeze([...campaign.viralHypothesis.shareMotives]),
    }),
    algorithm: Object.freeze({
      sampleSize: campaign.nicheProfile.sampleSize,
      strongestMechanics: Object.freeze(
        campaign.nicheProfile.strongestMechanics.map((row) => row.mechanic),
      ),
      strongestFormats: Object.freeze(
        campaign.nicheProfile.strongestFormats.map((row) => row.format),
      ),
      strongestTimeWindows: Object.freeze(
        campaign.nicheProfile.strongestTimeWindows.map((row) => row.timeWindow),
      ),
      conversionRate: campaign.nicheProfile.baselines.conversionRate,
      contributionMarginPerThousandImpressions:
        campaign.nicheProfile.baselines.contributionMarginPerThousandImpressions,
    }),
    audience: Object.freeze({
      selectedSeedCount: campaign.readyBuyerPlan?.selectedSeedEntityIds.length ?? 0,
      hotCount: campaign.readyBuyerPlan?.hotCount ?? 0,
      warmCount: campaign.readyBuyerPlan?.warmCount ?? 0,
      lookalikeRequested:
        campaign.readyBuyerPlan?.providerLookalikeRequested ?? false,
      providerIntentExpansionRequested:
        campaign.readyBuyerPlan?.providerIntentExpansionRequested ?? false,
    }),
    paid: Object.freeze({
      experimentCount: paid.length,
      plannedLifetimeBudgetMinor: paid.reduce(
        (sum, plan) => sum + plan.lifetimeBudgetMinor,
        0,
      ),
      currencies: Object.freeze(unique(paid.map((plan) => plan.currency))),
      channels: Object.freeze(unique(paid.map((plan) => plan.channel))),
      readinessStatus: campaign.paidReadiness?.status,
      eligibleForBoundedPaidTest:
        campaign.paidReadiness?.eligibleForBoundedPaidTest ?? false,
      eligibleForAcceleration:
        campaign.paidReadiness?.eligibleForAcceleration ?? false,
      readinessBlockers: Object.freeze([
        ...(campaign.paidReadiness?.blockers ?? []),
      ]),
    }),
    learning: Object.freeze({
      scaleNextTest: decisions.filter((d) => d.decision === "SCALE_NEXT_TEST").length,
      killTreatment: decisions.filter((d) => d.decision === "KILL_TREATMENT").length,
      iterate: decisions.filter((d) => d.decision === "ITERATE").length,
      hold: decisions.filter((d) => d.decision === "HOLD").length,
      promotedPrinciples: Object.freeze(
        learnings.map((learning) => learning.reusablePrinciple),
      ),
    }),
    ownerIdeaRefs: Object.freeze([...campaign.ownerIdeaRefs]),
    plannedActionRefs: Object.freeze([...campaign.plannedActionRefs]),
    blockers: Object.freeze(blockers),
    evidenceRefs: Object.freeze(unique([
      ...campaign.evidenceRefs,
      ...campaign.nicheProfile.evidenceRefs,
      ...campaign.viralHypothesis.evidenceRefs,
      ...(campaign.readyBuyerPlan?.evidenceRefs ?? []),
      ...(campaign.paidReadiness?.evidenceRefs ?? []),
      ...paid.flatMap((plan) => plan.evidenceRefs),
      ...decisions.flatMap((decision) => decision.evidenceRefs),
      ...learnings.flatMap((learning) => learning.evidenceRefs),
    ])),
  });
}

function requireText(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`GROWTH_WEEKLY_REPORT_FIELD_REQUIRED:${field}`);
  }
}

function requireDate(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`GROWTH_WEEKLY_REPORT_DATE_INVALID:${field}`);
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
