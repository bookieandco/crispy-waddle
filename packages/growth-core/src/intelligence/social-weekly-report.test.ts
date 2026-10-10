import { describe, expect, it } from "vitest";
import type { GrowthId } from "../domain/types.js";
import {
  compileWeeklyMarketingReport,
  type WeeklyMarketingCampaignReportInput,
} from "./social-weekly-report.js";
import type {
  CrossPortfolioMarketingLearning,
  NicheAlgorithmProfile,
  PortfolioExperimentDecision,
  PortfolioPaidExperimentPlan,
  ReadyBuyerAudiencePlan,
} from "./social-portfolio-autopilot.js";
import type { ViralCampaignHypothesis } from "./viral-campaign-intelligence.js";
import { assessPaidAccelerationReadiness } from "./social-paid-acceleration-readiness.js";

const nicheProfile: NicheAlgorithmProfile = {
  id: "algorithm:pupson:ig" as GrowthId,
  platform: "instagram",
  nicheKey: "personalized-pet-products",
  sampleSize: 12,
  observedFrom: "2026-09-20T00:00:00.000Z",
  observedThrough: "2026-10-06T20:00:00.000Z",
  baselines: {
    shareRate: 0.06,
    saveRate: 0.05,
    commentRate: 0.02,
    profileVisitRate: 0.04,
    destinationActionRate: 0.015,
    conversionRate: 0.005,
    completionRate: 0.42,
    contributionMarginPerThousandImpressions: 80,
  },
  strongestMechanics: [{
    mechanic: "humor_surprise",
    score: 1.2,
    sampleSize: 5,
    evidenceRefs: ["mechanic:humor"],
  }],
  strongestFormats: [{
    format: "short_video",
    score: 1.1,
    sampleSize: 7,
    evidenceRefs: ["format:short"],
  }],
  strongestTimeWindows: [{
    timeWindow: "weekday-evening",
    score: 1.3,
    sampleSize: 6,
    evidenceRefs: ["time:evening"],
  }],
  evidenceRefs: ["algorithm:source"],
  policy: {
    observedBehaviorNotPlatformLaw: true,
    staleProfilesMustBeRelearned: true,
    vanityMetricsCannotOverrideBusinessOutcomes: true,
  },
  authority: "ALGORITHM_LEARNING_ONLY",
};

const viral = {
  pursuitScore: 84,
  phase: "SEARCH",
  testDecision: "TEST",
  mechanic: "humor_surprise",
  shareMotives: ["humor", "identity"],
  evidenceRefs: ["viral:evidence"],
} as unknown as ViralCampaignHypothesis;

const buyers: ReadyBuyerAudiencePlan = {
  id: "buyers:pupson" as GrowthId,
  brandId: "brand:pupsonstuff" as GrowthId,
  selectedSeedEntityIds: [
    "customer:1" as GrowthId,
    "segment:1" as GrowthId,
  ],
  hotCount: 1,
  warmCount: 1,
  providerLookalikeRequested: true,
  providerIntentExpansionRequested: true,
  minimumCombinedScore: 0.55,
  evidenceRefs: ["buyers:evidence"],
  policy: {
    firstPartyOrProviderAggregateOnly: true,
    sensitiveFeatureTargetingAllowed: false,
    covertSensitiveInferenceAllowed: false,
    directContactAuthority: "NONE",
    providerLookalikeUsesPlatformNativeControls: true,
  },
  authority: "AUDIENCE_PLANNING_ONLY",
};

const paid: PortfolioPaidExperimentPlan = {
  id: "experiment:pupson:meta" as GrowthId,
  brandId: "brand:pupsonstuff" as GrowthId,
  channel: "meta",
  objective: "sales",
  audienceIds: ["buyers:pupson" as GrowthId],
  controlCreativeId: "creative:control" as GrowthId,
  treatmentCreativeId: "creative:treatment" as GrowthId,
  testAxis: "creative",
  minimumExposuresPerVariant: 1000,
  minimumConversionsPerVariant: 10,
  minimumRelativeLift: 0.1,
  requireNonNegativeIncrementalContribution: true,
  dailyBudgetMinor: 2500,
  lifetimeBudgetMinor: 15000,
  currency: "USD",
  landingPageRef: "storefront:pupsonstuff",
  evidenceRefs: ["paid:evidence"],
  policy: {
    oneMeaningfulVariableAtATime: true,
    autoBudgetIncreaseAllowed: false,
    autoSpendAuthority: "NONE",
    winnerMustPassStatisticalAndEconomicGate: true,
  },
  authority: "PAID_EXPERIMENT_PLAN_ONLY",
};

const paidReadiness = assessPaidAccelerationReadiness({
  brandId: "brand:pupsonstuff" as GrowthId,
  proof: {
    offerRef: "offer:pupson:portrait",
    qualifiedConversions: 4,
    repeatOrReferralSignals: 0,
    winningContentPieces: 2,
    distinctSharedSurfaces: 1,
    evidenceRefs: ["organic:sales:4", "organic:winners:2"],
  },
  owned: {
    destinationRef: "storefront:pupsonstuff",
    consentedCaptureReady: true,
    nurtureReady: true,
    consentedAudienceCount: 120,
    evidenceRefs: ["owned:storefront", "owned:email"],
  },
  economics: {
    currency: "USD",
    customerLifetimeValueMinor: 12000,
    contributionPerCustomerMinor: 7000,
    maxAcquisitionCostMinor: 3000,
    evidenceRefs: ["economics:pupson"],
  },
  peso: {
    sharedRefs: ["instagram:organic:winner"],
    ownedRefs: ["storefront:pupsonstuff", "email:pupson"],
    earnedRefs: [],
  },
});

const scaleDecision = {
  experimentId: paid.id,
  decision: "SCALE_NEXT_TEST",
  reason: "Treatment passed the bounded evidence gate.",
  evidenceRefs: ["decision:scale"],
} as unknown as PortfolioExperimentDecision;

const learning = {
  id: "learning:pupson:1" as GrowthId,
  sourceExperimentId: paid.id,
  brandId: "brand:pupsonstuff" as GrowthId,
  nicheKey: "personalized-pet-products",
  platform: "instagram",
  objective: "sales",
  audienceRef: "buyers:pupson",
  creativeMechanic: "humor_surprise",
  contentFormat: "short_video",
  timeWindow: "weekday-evening",
  result: "promote",
  reusablePrinciple:
    "instagram/personalized-pet-products; mechanic=humor_surprise; result=promote",
  transferScope: ["brand:pupsonstuff"],
  evidenceRefs: ["learning:evidence"],
  promotableToJhadinaIntelligence: true,
  authority: "CROSS_PORTFOLIO_LEARNING_ONLY",
} as CrossPortfolioMarketingLearning;

function healthyCampaign(): WeeklyMarketingCampaignReportInput {
  return {
    campaignId: "campaign:pupson:weekly" as GrowthId,
    brandId: "brand:pupsonstuff" as GrowthId,
    campaignName: "PupsonStuff weekly growth",
    objective: "Qualified sales",
    ownerIdeaRefs: ["owner-idea:pupson"],
    nicheProfile,
    viralHypothesis: viral,
    readyBuyerPlan: buyers,
    paidPlans: [paid],
    paidReadiness,
    priorDecisions: [scaleDecision],
    admittedLearnings: [learning],
    plannedActionRefs: [
      "action:director",
      "action:organic",
      "action:paid",
    ],
    evidenceRefs: ["campaign:evidence"],
  };
}

describe("weekly owner marketing report", () => {
  it("summarizes plan, buyers, spend, decisions and admitted learning for weekly approval", () => {
    const report = compileWeeklyMarketingReport({
      id: "report:2026-10-12" as GrowthId,
      weekStartsAt: "2026-10-12T00:00:00.000Z",
      weekEndsAt: "2026-10-19T00:00:00.000Z",
      generatedAt: "2026-10-11T20:00:00.000Z",
      approvalPacketRef: "weekly:2026-10-12",
      campaigns: [healthyCampaign()],
      evidenceRefs: ["report:evidence"],
    });

    expect(report.totals.campaigns).toBe(1);
    expect(report.totals.plannedActions).toBe(3);
    expect(report.totals.paidExperiments).toBe(1);
    expect(report.totals.plannedPaidBudgetMinor).toBe(15000);
    expect(report.totals.buyerSeeds).toBe(2);
    expect(report.totals.scaleNextTest).toBe(1);
    expect(report.sections[0]?.algorithm.strongestTimeWindows)
      .toContain("weekday-evening");
    expect(report.sections[0]?.audience.lookalikeRequested).toBe(true);
    expect(report.sections[0]?.paid.readinessStatus)
      .toBe("BOUNDED_PAID_TEST_READY");
    expect(report.sections[0]?.paid.eligibleForBoundedPaidTest).toBe(true);
    expect(report.portfolioLearnings).toContain(
      learning.reusablePrinciple,
    );
    expect(report.policy.ownerApprovalCadence).toBe("WEEKLY");
    expect(report.policy.executionAfterApproval)
      .toBe("BOUNDED_TO_EXACT_PACKET");
  });

  it("surfaces blockers instead of hiding weak campaign evidence", () => {
    const weak: WeeklyMarketingCampaignReportInput = {
      ...healthyCampaign(),
      campaignId: "campaign:weak" as GrowthId,
      campaignName: "Weak evidence campaign",
      nicheProfile: {
        ...nicheProfile,
        id: "algorithm:weak" as GrowthId,
        sampleSize: 1,
      },
      viralHypothesis: {
        ...viral,
        testDecision: "HOLD",
      } as unknown as ViralCampaignHypothesis,
      readyBuyerPlan: undefined,
      paidReadiness: assessPaidAccelerationReadiness({
        brandId: "brand:pupsonstuff" as GrowthId,
        proof: {
          offerRef: "offer:pupson:portrait",
          qualifiedConversions: 0,
          repeatOrReferralSignals: 0,
          winningContentPieces: 0,
          distinctSharedSurfaces: 1,
          evidenceRefs: ["organic:no-proof"],
        },
        owned: {
          destinationRef: "storefront:pupsonstuff",
          consentedCaptureReady: true,
          nurtureReady: true,
          consentedAudienceCount: 20,
          evidenceRefs: ["owned:weak"],
        },
        economics: {
          currency: "USD",
          customerLifetimeValueMinor: 12000,
          contributionPerCustomerMinor: 7000,
          maxAcquisitionCostMinor: 3000,
          evidenceRefs: ["economics:pupson"],
        },
        peso: {
          sharedRefs: ["instagram:organic:weak"],
          ownedRefs: ["storefront:pupsonstuff"],
          earnedRefs: [],
        },
      }),
      admittedLearnings: [],
    };

    const report = compileWeeklyMarketingReport({
      id: "report:weak" as GrowthId,
      weekStartsAt: "2026-10-12T00:00:00.000Z",
      weekEndsAt: "2026-10-19T00:00:00.000Z",
      generatedAt: "2026-10-11T20:00:00.000Z",
      approvalPacketRef: "weekly:weak",
      campaigns: [weak],
      evidenceRefs: ["report:weak:evidence"],
    });

    expect(report.blockers).toContain("VIRAL_HYPOTHESIS_HOLD");
    expect(report.blockers).toContain("NICHE_SAMPLE_THIN");
    expect(report.blockers).toContain("PAID_AUDIENCE_PLAN_MISSING");
    expect(report.blockers).toContain("PAID_ACCELERATION_HOLD");
    expect(report.blockers).toContain(
      "QUALIFIED_ORGANIC_PROOF_INSUFFICIENT",
    );
  });

  it("does not promote unadmitted learning into the portfolio report", () => {
    const unpromoted = {
      ...learning,
      id: "learning:unpromoted" as GrowthId,
      reusablePrinciple: "unvalidated principle",
      promotableToJhadinaIntelligence: false,
    };

    const report = compileWeeklyMarketingReport({
      id: "report:filter" as GrowthId,
      weekStartsAt: "2026-10-12T00:00:00.000Z",
      weekEndsAt: "2026-10-19T00:00:00.000Z",
      generatedAt: "2026-10-11T20:00:00.000Z",
      approvalPacketRef: "weekly:filter",
      campaigns: [{
        ...healthyCampaign(),
        admittedLearnings: [learning, unpromoted],
      }],
      evidenceRefs: ["report:filter:evidence"],
    });

    expect(report.portfolioLearnings).toContain(
      learning.reusablePrinciple,
    );
    expect(report.portfolioLearnings).not.toContain(
      unpromoted.reusablePrinciple,
    );
  });
});
