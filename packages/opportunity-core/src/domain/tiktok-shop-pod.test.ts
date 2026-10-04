import { describe, expect, it } from "vitest";
import {
  assessTikTokPodListingReadiness,
  computeTikTokPodContribution,
  type TikTokPodFulfillmentObservation,
} from "./tiktok-shop-pod.js";

function fulfillment(): TikTokPodFulfillmentObservation {
  return {
    observationId: "pod:eligibility:blanket:1",
    productRef: "printify:blanket",
    providerRef: "printify:provider:us-1",
    merchantRegion: "US",
    destinationRegion: "US",
    providerRegion: "US",
    salesChannelConnection: "connected",
    channelEligibility: "eligible",
    taxInfoState: "ready",
    shippingMode: "seller_shipping",
    madeToOrderState: "enabled",
    estimatedHandlingBusinessDays: 4,
    maxPermittedHandlingBusinessDays: 7,
    trackingCompatible: true,
    providerSupportsDestination: true,
    sourceRef: "printify:tiktok-eligibility",
    evidenceRefs: ["evidence:printify", "evidence:tiktok-fulfillment-policy"],
    observedAt: "2026-10-03T23:30:00Z",
  };
}

describe("TikTok Shop POD admission", () => {
  it("admits only fulfillment configurations with current eligibility and SLA evidence", () => {
    expect(assessTikTokPodListingReadiness(fulfillment()).ready).toBe(true);
  });

  it("fails closed when Printify/TikTok compatibility is unknown", () => {
    const unknown = {
      ...fulfillment(),
      channelEligibility: "unknown" as const,
      trackingCompatible: undefined,
    };
    const decision = assessTikTokPodListingReadiness(unknown);
    expect(decision.ready).toBe(false);
    expect(decision.reasons).toEqual(expect.arrayContaining([
      "TIKTOK_POD_CHANNEL_ELIGIBILITY_UNKNOWN",
      "TIKTOK_POD_TRACKING_COMPATIBILITY_UNKNOWN",
    ]));
  });

  it("rejects a POD product whose observed handling window exceeds the platform allowance", () => {
    const late = { ...fulfillment(), estimatedHandlingBusinessDays: 9 };
    const decision = assessTikTokPodListingReadiness(late);
    expect(decision.ready).toBe(false);
    expect(decision.reasons).toContain("TIKTOK_POD_HANDLING_WINDOW_EXCEEDED");
  });

  it("computes seller contribution from observed costs and account-specific fee rates", () => {
    const result = computeTikTokPodContribution({
      observationId: "econ:blanket:1",
      productRef: "printify:blanket",
      retailPrice: { value: 50, currency: "USD", sourceRef: "seller:list-price" },
      podUnitCost: { value: 18, currency: "USD", sourceRef: "printify:cost" },
      shippingCost: { value: 7, currency: "USD", sourceRef: "printify:shipping" },
      effectiveReferralFeeRate: { value: 0.06, sourceRef: "tiktok:settlement-policy" },
      affiliateCommissionRate: { value: 0.15, sourceRef: "seller:affiliate-plan" },
      promotionFeeRate: { value: 0.035, sourceRef: "seller:promotion-enrollment" },
      sellerFundedDiscount: { value: 2, currency: "USD", sourceRef: "seller:offer" },
      returnRefundReserve: { value: 1.5, currency: "USD", sourceRef: "finance:reserve-policy" },
      evidenceRefs: ["evidence:costs", "evidence:fees"],
      observedAt: "2026-10-03T23:30:00Z",
    });
    expect(result.referralFee).toBeCloseTo(3, 5);
    expect(result.affiliateCommission).toBeCloseTo(7.5, 5);
    expect(result.promotionFee).toBeCloseTo(1.75, 5);
    expect(result.estimatedContribution).toBeCloseTo(9.25, 5);
    expect(result.estimatedContributionMargin).toBeCloseTo(0.185, 5);
  });
});
