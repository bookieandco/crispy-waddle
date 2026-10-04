import { describe, expect, it } from "vitest";
import {
  classifyTikTokCampaignTiming,
  computeTikTokLiveCommerceMetrics,
  computeTikTokPublishingAllowance,
  type TikTokCampaignWindowObservation,
  type TikTokShopCapabilityObservation,
} from "./tiktok-shop-operations.js";

function capability(): TikTokShopCapabilityObservation {
  return {
    observationId: "cap:acct:1",
    accountRef: "acct:1",
    region: "US",
    creatorType: "affiliate",
    pilotState: "affiliate_pilot",
    dailyShoppableVideoLimit: 3,
    weeklyShoppableLiveLimit: 3,
    campaignEligible: false,
    sourceRef: "tiktok-shop-policy",
    evidenceRefs: ["evidence:eligibility-policy"],
    observedAt: "2026-10-03T20:00:00Z",
  };
}

describe("TikTok Shop operations evidence", () => {
  it("uses observed account limits instead of hard-coded posting advice", () => {
    const allowance = computeTikTokPublishingAllowance(capability(), {
      shoppableVideosToday: 2,
      shoppableLivesThisWeek: 1,
    });
    expect(allowance.canPublishShoppableVideo).toBe(true);
    expect(allowance.remainingShoppableVideos).toBe(1);
    expect(allowance.remainingShoppableLives).toBe(2);
  });

  it("fails closed when the current account limit is unknown", () => {
    const unknown = {
      ...capability(),
      dailyShoppableVideoLimit: undefined,
    };
    const allowance = computeTikTokPublishingAllowance(unknown, {
      shoppableVideosToday: 0,
      shoppableLivesThisWeek: 0,
    });
    expect(allowance.canPublishShoppableVideo).toBe(false);
    expect(allowance.reasons).toContain("TIKTOK_SHOPPABLE_VIDEO_LIMIT_UNKNOWN");
  });

  it("classifies a configurable campaign preheat window without hard-coding dates", () => {
    const campaign: TikTokCampaignWindowObservation = {
      observationId: "campaign:black-friday:us:2026",
      campaignRef: "black-friday:us:2026",
      name: "Black Friday",
      region: "US",
      startsAt: "2026-11-20T00:00:00Z",
      endsAt: "2026-11-30T23:59:59Z",
      sourceRef: "official-campaign-calendar",
      evidenceRefs: ["evidence:campaign"],
      observedAt: "2026-10-03T20:00:00Z",
    };
    expect(
      classifyTikTokCampaignTiming({
        campaign,
        now: "2026-11-08T12:00:00Z",
        preheatDays: 14,
      }),
    ).toBe("preheat");
  });

  it("measures LIVE commerce instead of treating hours streamed as success", () => {
    const result = computeTikTokLiveCommerceMetrics({
      observationId: "live:1",
      sessionRef: "session:1",
      productRef: "sku:1",
      durationSeconds: 7200,
      uniqueViewers: 1000,
      basketClicks: 100,
      orders: 10,
      attributedRevenue: {
        value: 500,
        currency: "USD",
        provenance: "provider_reported",
      },
      commissionEarned: {
        value: 75,
        currency: "USD",
        provenance: "provider_reported",
      },
      billboardUsed: true,
      scriptRef: "script:1",
      evidenceRefs: ["evidence:live"],
      observedAt: "2026-10-03T22:00:00Z",
    });
    expect(result.basketClickRate).toBeCloseTo(0.1, 5);
    expect(result.orderConversionRate).toBeCloseTo(0.1, 5);
    expect(result.revenuePerLiveHour).toBe(250);
    expect(result.commissionPerLiveHour).toBe(37.5);
  });
});
