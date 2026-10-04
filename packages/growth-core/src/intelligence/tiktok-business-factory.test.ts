import { describe, expect, it } from "vitest";
import type { VentureOpportunity } from "@jhadina/opportunity-core";
import {
  buildTikTokBusinessFactoryIntake,
  buildTikTokBusinessFactoryWorkItems,
} from "./tiktok-business-factory.js";

const now = "2026-10-04T07:30:00Z";

function product() {
  return {
    observationId: "product:1",
    source: "tiktok_shop" as const,
    provider: "tiktok_shop",
    productRef: "sku:1",
    productName: "Example Product",
    price: { value: 39, currency: "USD", provenance: "provider_reported" as const, sourceRef: "tiktok:pdp" },
    gmv: { value: 120000, currency: "USD", provenance: "provider_reported" as const, sourceRef: "tiktok:analytics" },
    weeklyGmvGrowthRate: { value: 0.2, provenance: "provider_reported" as const, sourceRef: "tiktok:analytics" },
    creatorCount: { value: 20, provenance: "provider_reported" as const, sourceRef: "tiktok:analytics" },
    shoppableContentCount: { value: 100, provenance: "provider_reported" as const, sourceRef: "tiktok:analytics" },
    commissionRate: { value: 0.15, provenance: "provider_reported" as const, sourceRef: "tiktok:affiliate" },
    creatorContributions: [],
    evidenceRefs: ["evidence:product"],
    observedAt: now,
  };
}

describe("TikTok Business Factory bridge", () => {
  it("turns TikTok affiliate evidence into a canonical Side Hustle discovery candidate", () => {
    const intake = buildTikTokBusinessFactoryIntake({
      lane: "affiliate",
      product: product(),
      searchOpportunity: {
        observationId: "search:1",
        query: "example product",
        region: "US",
        searchDemand: { value: 4000, provenance: "provider_reported", sourceRef: "tiktok:search" },
        competingProductCount: { value: 40, provenance: "provider_reported", sourceRef: "tiktok:search" },
        label: "fast_growing_keyword",
        sourceRef: "tiktok:seller-center",
        evidenceRefs: ["evidence:search"],
        observedAt: now,
      },
      gmvMax: {
        observationId: "gmv:1",
        productRef: "sku:1",
        affiliateCreativeAuthorized: true,
        observedInGmvMax: true,
        sourceRef: "tiktok:shop-ads",
        evidenceRefs: ["evidence:gmv-max"],
        observedAt: now,
      },
      generatedAt: now,
    });

    expect(intake.profile.family).toBe("commerce_affiliate");
    expect(intake.candidate.family).toBe("commerce_affiliate");
    expect(intake.signals.map((signal) => signal.kind)).toEqual(
      expect.arrayContaining(["sales", "search", "competition", "platform_velocity"]),
    );
    expect(intake.externalActionAuthorized).toBe(false);
    expect(intake.automaticExperimentAuthorized).toBe(false);
  });

  it("requires fulfillment evidence before POD seller intake can enter the Business Factory", () => {
    expect(() =>
      buildTikTokBusinessFactoryIntake({
        lane: "pod_seller",
        product: product(),
        generatedAt: now,
      }),
    ).toThrow(/POD_FULFILLMENT_REQUIRED/);
  });

  it("projects TikTok execution into the shared Venture work ledger without granting authority", () => {
    const venture = {
      id: "venture:tiktok-affiliate",
      family: "commerce_affiliate",
      lifecycle: "validated",
    } as VentureOpportunity;

    const items = buildTikTokBusinessFactoryWorkItems({
      venture,
      lane: "affiliate",
      readiness: {
        productResearchReady: true,
        boundedExperimentApproved: true,
        productTruthLocked: true,
        accountCapabilityReady: true,
        offerEvidenceReady: true,
        creativeReady: true,
        publicationReceiptPresent: false,
        settlementEvidenceReady: false,
        evidenceRefs: ["evidence:pipeline"],
      },
      createdAt: now,
    });

    expect(items.find((item) => item.step === "tiktok_product_research")?.status).toBe("queued");
    expect(items.find((item) => item.step === "tiktok_governed_publication")?.status).toBe("queued");
    expect(items.find((item) => item.step === "tiktok_affiliate_payout_outcome")?.status).toBe("blocked");
    expect(items.every((item) => item.authorizationEffect === "NONE")).toBe(true);
    expect(items.every((item) => item.spendUsd === 0)).toBe(true);
  });

  it("keeps execution blocked before Venture validation even when creative inputs exist", () => {
    const venture = {
      id: "venture:tiktok-affiliate",
      family: "commerce_affiliate",
      lifecycle: "researched",
    } as VentureOpportunity;

    const items = buildTikTokBusinessFactoryWorkItems({
      venture,
      lane: "affiliate",
      readiness: {
        productResearchReady: true,
        boundedExperimentApproved: false,
        productTruthLocked: true,
        accountCapabilityReady: true,
        offerEvidenceReady: true,
        creativeReady: true,
        publicationReceiptPresent: false,
        settlementEvidenceReady: false,
        evidenceRefs: ["evidence:pipeline"],
      },
      createdAt: now,
    });

    expect(items.find((item) => item.step === "tiktok_commercial_creative_batch")?.status).toBe("blocked");
    expect(items.find((item) => item.step === "tiktok_governed_publication")?.status).toBe("blocked");
  });
});
