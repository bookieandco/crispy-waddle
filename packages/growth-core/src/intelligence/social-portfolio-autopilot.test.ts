import { describe, expect, it } from "vitest";
import type { GrowthId } from "../domain/types.js";
import {
  assessPortfolioPaidExperiment,
  buildNicheAlgorithmProfile,
  buildReadyBuyerAudiencePlan,
  compilePortfolioPaidExperiment,
  createCrossPortfolioMarketingLearning,
  type NicheAlgorithmObservation,
} from "./social-portfolio-autopilot.js";

const nicheRows: NicheAlgorithmObservation[] = [
  {
    id: "obs:1" as GrowthId,
    brandId: "brand:pupsonstuff" as GrowthId,
    platform: "instagram",
    nicheKey: "personalized-pet-products",
    contentFormat: "short_video",
    creativeMechanic: "humor_surprise",
    audienceRef: "audience:pet-owners",
    placement: "reels",
    publishedAt: "2026-10-01T17:00:00.000Z",
    observedAt: "2026-10-03T17:00:00.000Z",
    impressions: 10000,
    views: 8000,
    watchSeconds: 80000,
    completions: 4200,
    shares: 800,
    saves: 500,
    comments: 220,
    profileVisits: 700,
    destinationActions: 300,
    conversions: 60,
    contributionMargin: 1200,
    evidenceRefs: ["provider:ig:1", "commerce:orders:1"],
  },
  {
    id: "obs:2" as GrowthId,
    brandId: "brand:pupsonstuff" as GrowthId,
    platform: "instagram",
    nicheKey: "personalized-pet-products",
    contentFormat: "carousel",
    creativeMechanic: "utility_proof",
    audienceRef: "audience:gift-buyers",
    placement: "feed",
    publishedAt: "2026-10-02T17:00:00.000Z",
    observedAt: "2026-10-04T17:00:00.000Z",
    impressions: 8000,
    views: 5000,
    watchSeconds: 0,
    completions: 0,
    shares: 150,
    saves: 420,
    comments: 90,
    profileVisits: 380,
    destinationActions: 190,
    conversions: 35,
    contributionMargin: 720,
    evidenceRefs: ["provider:ig:2", "commerce:orders:2"],
  },
];

describe("portfolio social autopilot intelligence", () => {
  it("learns niche/platform baselines from observed outcomes instead of declaring platform laws", () => {
    const profile = buildNicheAlgorithmProfile({
      id: "algorithm:ig:pet" as GrowthId,
      platform: "instagram",
      nicheKey: "personalized-pet-products",
      observations: nicheRows,
      asOf: "2026-10-07T18:00:00.000Z",
    });

    expect(profile.sampleSize).toBe(2);
    expect(profile.baselines.shareRate).toBeGreaterThan(0);
    expect(profile.strongestMechanics[0]?.mechanic).toBe("humor_surprise");
    expect(profile.policy.observedBehaviorNotPlatformLaw).toBe(true);
    expect(profile.policy.vanityMetricsCannotOverrideBusinessOutcomes).toBe(true);
  });

  it("builds a ready-buyer seed from first-party/provider evidence without direct-contact authority", () => {
    const plan = buildReadyBuyerAudiencePlan({
      id: "audience:pupson:ready" as GrowthId,
      brandId: "brand:pupsonstuff" as GrowthId,
      candidates: [
        {
          entityId: "customer:1" as GrowthId,
          source: "first_party_behavior",
          intentScore: 0.91,
          lookalikeScore: 0.88,
          evidenceRefs: ["first-party:checkout-started"],
        },
        {
          entityId: "segment:provider:1" as GrowthId,
          source: "provider_intent_segment",
          intentScore: 0.70,
          lookalikeScore: 0.72,
          evidenceRefs: ["provider:intent:pet-gifts"],
        },
        {
          entityId: "customer:weak" as GrowthId,
          source: "first_party_behavior",
          intentScore: 0.10,
          lookalikeScore: 0.20,
          evidenceRefs: ["first-party:page-view"],
        },
      ],
      minimumCombinedScore: 0.55,
      evidenceRefs: ["audience:pupson:source"],
    });

    expect(plan.selectedSeedEntityIds).toContain("customer:1");
    expect(plan.selectedSeedEntityIds).not.toContain("customer:weak");
    expect(plan.policy.sensitiveFeatureTargetingAllowed).toBe(false);
    expect(plan.policy.directContactAuthority).toBe("NONE");
    expect(plan.providerLookalikeRequested).toBe(true);
  });

  it("creates one-variable paid experiments with no automatic budget expansion", () => {
    const plan = compilePortfolioPaidExperiment({
      id: "experiment:pupson:meta:creative" as GrowthId,
      brandId: "brand:pupsonstuff" as GrowthId,
      channel: "meta",
      objective: "sales",
      audienceIds: ["audience:pupson:ready" as GrowthId],
      controlCreativeId: "creative:control" as GrowthId,
      treatmentCreativeId: "creative:treatment" as GrowthId,
      testAxis: "creative",
      dailyBudgetMinor: 2500,
      lifetimeBudgetMinor: 15000,
      currency: "USD",
      landingPageRef: "storefront:pupsonstuff",
      minimumExposuresPerVariant: 1000,
      minimumConversionsPerVariant: 10,
      minimumRelativeLift: 0.10,
      evidenceRefs: ["experiment:brief"],
    });

    expect(plan.policy.oneMeaningfulVariableAtATime).toBe(true);
    expect(plan.policy.autoBudgetIncreaseAllowed).toBe(false);
    expect(plan.policy.autoSpendAuthority).toBe("NONE");
  });

  it("scales a supported treatment only into the next approved test", () => {
    const plan = compilePortfolioPaidExperiment({
      id: "experiment:pupson:meta:creative" as GrowthId,
      brandId: "brand:pupsonstuff" as GrowthId,
      channel: "meta",
      objective: "sales",
      audienceIds: ["audience:pupson:ready" as GrowthId],
      controlCreativeId: "creative:control" as GrowthId,
      treatmentCreativeId: "creative:treatment" as GrowthId,
      testAxis: "creative",
      dailyBudgetMinor: 2500,
      lifetimeBudgetMinor: 15000,
      currency: "USD",
      minimumExposuresPerVariant: 1000,
      minimumConversionsPerVariant: 10,
      minimumRelativeLift: 0.10,
      evidenceRefs: ["experiment:brief"],
    });

    const decision = assessPortfolioPaidExperiment({
      plan,
      observations: [
        {
          variantId: "creative:control" as GrowthId,
          exposures: 5000,
          conversions: 200,
          spend: 1000,
          contributionMargin: 1200,
          observedAt: "2026-10-07T18:00:00.000Z",
          evidenceRefs: ["meta:control"],
        },
        {
          variantId: "creative:treatment" as GrowthId,
          exposures: 5000,
          conversions: 300,
          spend: 1000,
          contributionMargin: 2000,
          observedAt: "2026-10-07T18:00:00.000Z",
          evidenceRefs: ["meta:treatment"],
        },
      ],
    });

    expect(decision.decision).toBe("SCALE_NEXT_TEST");
    expect(decision.winnerVariantId).toBe("creative:treatment");
    expect(decision.policy.scaleMeansNextApprovedTestNotUnboundedSpend).toBe(true);

    const learning = createCrossPortfolioMarketingLearning({
      id: "learning:pupson:meta:1" as GrowthId,
      decision,
      brandId: "brand:pupsonstuff" as GrowthId,
      nicheKey: "personalized-pet-products",
      platform: "instagram",
      objective: "sales",
      audienceRef: "audience:pupson:ready",
      creativeMechanic: "humor_surprise",
      contentFormat: "short_video",
      placement: "reels",
      timeWindow: "weekday-evening",
      transferScope: [
        "brand:pupsonstuff",
        "venture:etsy-personalized-gifts",
      ],
      evidenceRefs: ["learning:context"],
    });

    expect(learning.result).toBe("promote");
    expect(learning.promotableToJhadinaIntelligence).toBe(true);
    expect(learning.reusablePrinciple).toContain("humor_surprise");
  });

  it("retires an underperforming treatment without deleting its evidence", () => {
    const plan = compilePortfolioPaidExperiment({
      id: "experiment:truckeros:meta" as GrowthId,
      brandId: "brand:truckeros" as GrowthId,
      channel: "meta",
      objective: "lead_generation",
      audienceIds: ["audience:truckeros:owner-operators" as GrowthId],
      controlCreativeId: "creative:truck:control" as GrowthId,
      treatmentCreativeId: "creative:truck:treatment" as GrowthId,
      testAxis: "creative",
      dailyBudgetMinor: 2000,
      lifetimeBudgetMinor: 12000,
      currency: "USD",
      evidenceRefs: ["experiment:truck"],
    });

    const decision = assessPortfolioPaidExperiment({
      plan,
      observations: [
        {
          variantId: "creative:truck:control" as GrowthId,
          exposures: 5000,
          conversions: 250,
          spend: 900,
          contributionMargin: 1800,
          observedAt: "2026-10-07T18:00:00.000Z",
          evidenceRefs: ["meta:truck:control"],
        },
        {
          variantId: "creative:truck:treatment" as GrowthId,
          exposures: 5000,
          conversions: 120,
          spend: 900,
          contributionMargin: 500,
          observedAt: "2026-10-07T18:00:00.000Z",
          evidenceRefs: ["meta:truck:treatment"],
        },
      ],
    });

    expect(decision.decision).toBe("KILL_TREATMENT");
    expect(decision.policy.killMeansRetireTreatmentNotDeleteEvidence).toBe(true);
  });
});
