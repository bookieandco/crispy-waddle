import { describe, expect, it } from "vitest";
import type { GrowthId } from "../domain/types.js";
import type { NicheAlgorithmProfile } from "./social-portfolio-autopilot.js";
import { rankNicheSocialSchedule } from "./social-scheduling-intelligence.js";

const profile: NicheAlgorithmProfile = {
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
  strongestMechanics: [
    { mechanic: "humor_surprise", score: 1.2, sampleSize: 5, evidenceRefs: ["mechanic:humor"] },
    { mechanic: "utility_proof", score: 0.8, sampleSize: 4, evidenceRefs: ["mechanic:proof"] },
  ],
  strongestFormats: [
    { format: "short_video", score: 1.1, sampleSize: 7, evidenceRefs: ["format:short"] },
    { format: "carousel", score: 0.7, sampleSize: 3, evidenceRefs: ["format:carousel"] },
  ],
  strongestTimeWindows: [
    { timeWindow: "weekday-evening", score: 1.3, sampleSize: 6, evidenceRefs: ["time:evening"] },
    { timeWindow: "weekend-morning", score: 0.9, sampleSize: 4, evidenceRefs: ["time:weekend"] },
  ],
  evidenceRefs: ["algorithm:source"],
  policy: {
    observedBehaviorNotPlatformLaw: true,
    staleProfilesMustBeRelearned: true,
    vanityMetricsCannotOverrideBusinessOutcomes: true,
  },
  authority: "ALGORITHM_LEARNING_ONLY",
};

describe("niche-aware social scheduling", () => {
  it("ranks the niche's learned time/mechanic/format fit above a generic slot", () => {
    const recommendation = rankNicheSocialSchedule({
      profile,
      asOf: "2026-10-07T18:00:00.000Z",
      slots: [
        {
          id: "slot:best" as GrowthId,
          platform: "instagram",
          scheduledAt: "2026-10-08T18:00:00.000Z",
          audienceLocalWindow: "weekday-evening",
          contentFormat: "short_video",
          creativeMechanic: "humor_surprise",
          capacityRef: "calendar:ig:1",
          evidenceRefs: ["calendar:1"],
        },
        {
          id: "slot:generic" as GrowthId,
          platform: "instagram",
          scheduledAt: "2026-10-08T12:00:00.000Z",
          audienceLocalWindow: "weekday-midday",
          contentFormat: "image",
          creativeMechanic: "generic_announcement",
          capacityRef: "calendar:ig:2",
          evidenceRefs: ["calendar:2"],
        },
      ],
    });

    expect(recommendation.rankedSlots[0]?.id).toBe("slot:best");
    expect(recommendation.rankedSlots[0]?.score).toBeGreaterThan(
      recommendation.rankedSlots[1]?.score ?? 0,
    );
    expect(recommendation.policy.universalBestTimeAssumptionAllowed).toBe(false);
    expect(recommendation.policy.rankingDoesNotGuaranteeDistribution).toBe(true);
  });

  it("refuses stale niche evidence", () => {
    expect(() => rankNicheSocialSchedule({
      profile,
      asOf: "2027-01-07T18:00:00.000Z",
      maxProfileAgeDays: 45,
      slots: [
        {
          id: "slot:future" as GrowthId,
          platform: "instagram",
          scheduledAt: "2027-01-08T18:00:00.000Z",
          audienceLocalWindow: "weekday-evening",
          contentFormat: "short_video",
          creativeMechanic: "humor_surprise",
          capacityRef: "calendar:ig:future",
          evidenceRefs: ["calendar:future"],
        },
      ],
    })).toThrow(/PROFILE_STALE/);
  });
});
