import { describe, expect, it } from "vitest";
import {
  assessTikTokCreatorConcentration,
  assertTikTokShopProductObservation,
  classifyTikTokCommerceLane,
  classifyTikTokProductTrend,
  computeTikTokCreativeCommerceMetrics,
  type TikTokShopProductObservation,
} from "./tiktok-shop-intelligence.js";

function product(): TikTokShopProductObservation {
  return {
    observationId: "tiktok-product:sku-1:2026-10-03",
    source: "shopshark",
    provider: "shopshark",
    productRef: "sku-1",
    productName: "Example Product",
    shopRef: "shop-1",
    category: "home",
    listingUrl: "https://shop.tiktok.com/example",
    price: {
      value: 49.99,
      currency: "USD",
      provenance: "provider_reported",
    },
    gmv: {
      value: 120000,
      currency: "USD",
      provenance: "provider_estimated",
    },
    weeklyGmvGrowthRate: {
      value: 0.22,
      provenance: "provider_estimated",
    },
    creatorCount: {
      value: 12,
      provenance: "provider_reported",
    },
    creatorContributions: [
      {
        creatorRef: "creator-a",
        attributedGmv: {
          value: 40000,
          currency: "USD",
          provenance: "provider_estimated",
        },
        evidenceRefs: ["evidence:a"],
      },
      {
        creatorRef: "creator-b",
        attributedGmv: {
          value: 30000,
          currency: "USD",
          provenance: "provider_estimated",
        },
        evidenceRefs: ["evidence:b"],
      },
      {
        creatorRef: "creator-c",
        attributedGmv: {
          value: 25000,
          currency: "USD",
          provenance: "provider_estimated",
        },
        evidenceRefs: ["evidence:c"],
      },
      {
        creatorRef: "creator-d",
        attributedGmv: {
          value: 25000,
          currency: "USD",
          provenance: "provider_estimated",
        },
        evidenceRefs: ["evidence:d"],
      },
    ],
    evidenceRefs: ["evidence:product"],
    observedAt: "2026-10-03T20:00:00Z",
  };
}

describe("TikTok Shop product intelligence", () => {
  it("preserves estimated provider metrics instead of treating them as verified truth", () => {
    const observation = product();
    expect(() => assertTikTokShopProductObservation(observation)).not.toThrow();
    expect(observation.gmv?.provenance).toBe("provider_estimated");
  });

  it("classifies rising momentum from a source-labeled weekly growth metric", () => {
    expect(classifyTikTokProductTrend(product().weeklyGmvGrowthRate)).toBe("rising");
  });

  it("detects diversified creator demand when product GMV is spread across creators", () => {
    const result = assessTikTokCreatorConcentration(product().creatorContributions);
    expect(result.distribution).toBe("diversified");
    expect(result.topCreatorShare).toBeCloseTo(1 / 3, 3);
  });

  it("flags creator-concentrated demand when one creator carries the product", () => {
    const result = assessTikTokCreatorConcentration([
      {
        creatorRef: "creator-a",
        attributedGmv: {
          value: 90000,
          currency: "USD",
          provenance: "provider_estimated",
        },
        evidenceRefs: ["a"],
      },
      {
        creatorRef: "creator-b",
        attributedGmv: {
          value: 10000,
          currency: "USD",
          provenance: "provider_estimated",
        },
        evidenceRefs: ["b"],
      },
    ]);

    expect(result.distribution).toBe("creator_concentrated");
    expect(result.topCreatorShare).toBeCloseTo(0.9, 5);
  });

  it("keeps seller inventory economics separate from affiliate commission economics", () => {
    expect(
      classifyTikTokCommerceLane({
        ownsInventory: true,
        sellerEconomics: {
          landedUnitCost: {
            value: 8,
            currency: "USD",
            provenance: "user_reported",
          },
        },
      }).lane,
    ).toBe("seller_acquisition");

    expect(
      classifyTikTokCommerceLane({
        ownsInventory: false,
        affiliateEconomics: {
          commissionRate: 0.15,
        },
      }).lane,
    ).toBe("affiliate_commission");
  });

  it("scores creative formats on commerce outcomes rather than views alone", () => {
    const metrics = computeTikTokCreativeCommerceMetrics({
      observationId: "creative:1",
      productRef: "sku-1",
      contentRef: "video-1",
      format: "ai_video",
      views: 10000,
      productClicks: 500,
      orders: 25,
      commissionEarned: {
        value: 125,
        currency: "USD",
        provenance: "provider_reported",
      },
      contentCost: {
        value: 15,
        currency: "USD",
        provenance: "user_reported",
      },
      evidenceRefs: ["evidence:creative-1"],
      observedAt: "2026-10-03T21:00:00Z",
    });

    expect(metrics.productClickRate).toBeCloseTo(0.05, 5);
    expect(metrics.orderConversionRate).toBeCloseTo(0.05, 5);
    expect(metrics.ordersPerThousandViews).toBeCloseTo(2.5, 5);
    expect(metrics.commissionPerThousandViews).toBeCloseTo(12.5, 5);
    expect(metrics.contribution).toBe(110);
  });
});
