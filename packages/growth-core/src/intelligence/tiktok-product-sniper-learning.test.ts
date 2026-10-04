import { describe, expect, it } from "vitest";
import {
  learnTikTokProductSniperFromRealizedOutcomes,
  scoreTikTokProductSniperWithRealizedLearning,
} from "./tiktok-product-sniper-learning.js";

function sample(id: string, profit: number, result: "won" | "lost") {
  return {
    id,
    productRef: `product-${id}`,
    lane: "affiliate" as const,
    category: "Home",
    price: 220,
    currency: "USD",
    creatorCount: 20,
    creativeFormat: "faceless_product_demo",
    outcome: {
      result,
      profit,
      margin: profit > 0 ? 0.5 : -0.2,
      dollarsPerHour: profit / 2,
      observedAt: "2026-10-04T12:00:00Z",
      evidenceRefs: [`outcome:${id}`],
    },
    evidenceRefs: [`evidence:${id}`],
  };
}

describe("TikTok Product Sniper realized learning", () => {
  it("learns only from realized Opportunity outcomes and produces bounded ranking adjustments", () => {
    const profile = learnTikTokProductSniperFromRealizedOutcomes({
      samples: [
        sample("1", 60, "won"),
        sample("2", 40, "won"),
        sample("3", 30, "won"),
      ],
      learnedAt: "2026-10-04T13:00:00Z",
    });
    const scored = scoreTikTokProductSniperWithRealizedLearning({
      profile,
      candidate: {
        lane: "affiliate",
        category: "Home",
        price: 250,
        creatorCount: 10,
        creativeFormat: "faceless_product_demo",
      },
    });
    expect(profile.projectedGmvUsedAsOutcome).toBe(false);
    expect(scored.adjustment).toBeGreaterThan(0);
    expect(scored.adjustment).toBeLessThanOrEqual(15);
    expect(scored.externalActionAuthorized).toBe(false);
  });

  it("penalizes segments with realized losses", () => {
    const profile = learnTikTokProductSniperFromRealizedOutcomes({
      samples: [
        sample("1", -20, "lost"),
        sample("2", -30, "lost"),
        sample("3", -10, "lost"),
      ],
      learnedAt: "2026-10-04T13:00:00Z",
    });
    const scored = scoreTikTokProductSniperWithRealizedLearning({
      profile,
      candidate: {
        lane: "affiliate",
        category: "Home",
        price: 250,
        creatorCount: 10,
        creativeFormat: "faceless_product_demo",
      },
    });
    expect(scored.adjustment).toBeLessThan(0);
  });
});
