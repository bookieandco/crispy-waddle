import { describe, expect, it } from "vitest";
import {
  evaluateTikTokCreativeOfferFreshness,
  evaluateTikTokNewReleaseForTest,
  type TikTokOfferObservation,
} from "./tiktok-shop-offer-governance.js";

function offer(state: "active" | "inactive" | "unknown" = "active"): TikTokOfferObservation {
  return {
    observationId: "offer-observation:sku-1:fall",
    productRef: "sku-1",
    offerRef: "offer:fall-sale",
    kind: "discount_percent",
    displayText: "20% off",
    state,
    percentOff: { value: 0.2, provenance: "provider_reported" },
    validFrom: "2026-10-01T00:00:00Z",
    validUntil: "2026-10-10T23:59:59Z",
    sourceRef: "tiktok:product-offer",
    evidenceRefs: ["evidence:offer"],
    observedAt: "2026-10-04T00:00:00Z",
  };
}

describe("TikTok offer governance", () => {
  it("keeps creative live only while every bound offer remains current", () => {
    const result = evaluateTikTokCreativeOfferFreshness({
      binding: {
        bindingId: "binding:video-1",
        contentRef: "video-1",
        productRef: "sku-1",
        offerRefs: ["offer:fall-sale"],
        invalidOfferAction: "retire_content",
        createdAt: "2026-10-04T00:00:00Z",
      },
      offers: [offer()],
      now: "2026-10-05T00:00:00Z",
    });
    expect(result.fresh).toBe(true);
    expect(result.action).toBe("keep");
  });

  it("proposes retirement when an on-screen discount expires", () => {
    const result = evaluateTikTokCreativeOfferFreshness({
      binding: {
        bindingId: "binding:video-1",
        contentRef: "video-1",
        productRef: "sku-1",
        offerRefs: ["offer:fall-sale"],
        invalidOfferAction: "retire_content",
        createdAt: "2026-10-04T00:00:00Z",
      },
      offers: [offer()],
      now: "2026-10-11T00:00:00Z",
    });
    expect(result.fresh).toBe(false);
    expect(result.action).toBe("retire_content");
    expect(result.reasons).toContain("TIKTOK_OFFER_EXPIRED:offer:fall-sale");
  });

  it("treats historical paid support as a test signal rather than guaranteed future ad spend", () => {
    const result = evaluateTikTokNewReleaseForTest({
      observation: {
        observationId: "release:sku-new",
        productRef: "sku-new",
        sellerRef: "seller:brand-1",
        releasedAt: "2026-10-02T00:00:00Z",
        creatorCount: { value: 2, provenance: "provider_reported" },
        commissionRate: { value: 0.15, provenance: "provider_reported" },
        sellerPaidSupport: {
          sellerRef: "seller:brand-1",
          lookbackDays: 7,
          sampledTopCreativeCount: 10,
          paidSupportedTopCreativeCount: 9,
          sourceRef: "provider:creative-observation",
          evidenceRefs: ["evidence:paid-badges"],
          observedAt: "2026-10-04T00:00:00Z",
        },
        evidenceRefs: ["evidence:new-release"],
        observedAt: "2026-10-04T00:00:00Z",
      },
      policy: {
        maximumAgeDays: 14,
        maximumCreatorCount: 50,
        minimumHistoricalPaidSupportShare: 0.7,
        minimumCommissionRate: 0.1,
      },
      now: "2026-10-04T00:00:00Z",
    });

    expect(result.qualifiesForTest).toBe(true);
    expect(result.historicalPaidSupportShare).toBeCloseTo(0.9, 5);
  });
});
