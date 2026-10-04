import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  VentureDiscoveryCandidate,
  VentureOpportunity,
  VentureWorkItem,
} from "@jhadina/opportunity-core";
import {
  ingestTikTokBusinessFactoryEvidence,
  queueTikTokBusinessFactoryWorkForOwner,
  type TikTokBusinessFactoryPersistence,
} from "./tiktok-business-factory-runtime";

const now = "2026-10-04T08:00:00Z";

function repo() {
  const signals: unknown[] = [];
  const candidates: VentureDiscoveryCandidate[] = [];
  const work: VentureWorkItem[] = [];
  const venture = {
    id: "venture:tiktok:1",
    opportunityId: "opportunity:tiktok:1",
    family: "commerce_affiliate",
    lifecycle: "validated",
  } as VentureOpportunity;

  const repository: TikTokBusinessFactoryPersistence = {
    async upsertScoutSignals(records) {
      signals.push(...records);
      return records.length;
    },
    async upsertCandidates(records) {
      candidates.push(...records);
      return records.length;
    },
    async getVentureByOpportunity(ownerUserId, opportunityId) {
      if (ownerUserId !== "user-1" || opportunityId !== venture.opportunityId) return null;
      return venture;
    },
    async upsertWorkItems(ownerUserId, records) {
      expect(ownerUserId).toBe("user-1");
      work.push(...records);
      return records.length;
    },
  };
  return { repository, signals, candidates, work };
}

function evidence() {
  return {
    lane: "affiliate" as const,
    product: {
      observationId: "product:1",
      source: "tiktok_shop" as const,
      provider: "tiktok_shop",
      productRef: "sku:1",
      productName: "Example Product",
      price: { value: 39, currency: "USD", provenance: "provider_reported" as const, sourceRef: "https://shop.tiktok.com/product/1" },
      gmv: { value: 100000, currency: "USD", provenance: "provider_reported" as const, sourceRef: "https://seller-us.tiktok.com/analytics/1" },
      weeklyGmvGrowthRate: { value: 0.2, provenance: "provider_reported" as const, sourceRef: "https://seller-us.tiktok.com/analytics/1" },
      creatorCount: { value: 20, provenance: "provider_reported" as const, sourceRef: "provider:creator-count" },
      commissionRate: { value: 0.15, provenance: "provider_reported" as const, sourceRef: "provider:commission" },
      creatorContributions: [],
      evidenceRefs: ["evidence:product"],
      observedAt: now,
    },
    searchOpportunity: {
      observationId: "search:1",
      query: "example product",
      region: "US",
      searchDemand: { value: 4000, provenance: "provider_reported" as const, sourceRef: "provider:search" },
      competingProductCount: { value: 40, provenance: "provider_reported" as const, sourceRef: "provider:search" },
      label: "fast_growing_keyword" as const,
      sourceRef: "provider:product-opportunity",
      evidenceRefs: ["evidence:search"],
      observedAt: now,
    },
    generatedAt: now,
  };
}

describe("TikTok Business Factory runtime", () => {
  it("persists TikTok evidence into the canonical scout/candidate inboxes", async () => {
    const { repository, signals, candidates } = repo();
    const result = await ingestTikTokBusinessFactoryEvidence(
      {} as SupabaseClient,
      { evidence: evidence(), repository },
    );
    expect(result.seedId).toBe("tiktok-affiliate-commerce-market");
    expect(result.persistedSignals).toBeGreaterThanOrEqual(3);
    expect(signals.length).toBe(result.signalCount);
    expect(candidates).toHaveLength(1);
    expect(result.externalActionAuthorized).toBe(false);
  });

  it("writes execution planning into the shared owner-scoped Venture work ledger", async () => {
    const { repository, work } = repo();
    const result = await queueTikTokBusinessFactoryWorkForOwner(
      {} as SupabaseClient,
      {
        ownerUserId: "user-1",
        opportunityId: "opportunity:tiktok:1",
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
          evidenceRefs: ["evidence:factory"],
        },
        createdAt: now,
        repository,
      },
    );
    expect(result.queued).toBeGreaterThan(0);
    expect(result.blocked).toBeGreaterThan(0);
    expect(work.every((item) => item.authorizationEffect === "NONE")).toBe(true);
  });

  it("does not resolve work across the wrong owner boundary", async () => {
    const { repository } = repo();
    await expect(
      queueTikTokBusinessFactoryWorkForOwner(
        {} as SupabaseClient,
        {
          ownerUserId: "user-2",
          opportunityId: "opportunity:tiktok:1",
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
            evidenceRefs: ["evidence:factory"],
          },
          createdAt: now,
          repository,
        },
      ),
    ).rejects.toThrow(/VENTURE_NOT_FOUND/);
  });
});
