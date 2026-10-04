import { describe, expect, it } from "vitest";
import type {
  SideHustleCommerceRecord,
  SideHustleCommerceRecordKind,
} from "@jhadina/opportunity-core";
import { buildSideHustleProfile } from "@jhadina/opportunity-core";
import type { SideHustleCommercePersistence } from "./side-hustle-commerce-runtime";
import { ingestTikTokAffiliateFinanceRuntime } from "./tiktok-affiliate-finance-runtime";

function repository() {
  const saved: SideHustleCommerceRecord[] = [];
  const repo: SideHustleCommercePersistence = {
    async get() {
      return {
        userId: "user-1",
        triageState: "pending",
        opportunity: {
          id: "opportunity-1",
          title: "TikTok affiliate",
          family: "business",
          type: "commercial",
          sourceName: "test",
          sourceUrl: "https://example.test",
          claims: [],
          evidence: [],
          verificationStatus: "unverified",
          sourceConfidence: 0.9,
          riskFlags: [],
          metadata: {
            sideHustleProfile: buildSideHustleProfile({ family: "commerce_affiliate" }),
          },
          status: "ready",
          createdAt: "2026-10-01T00:00:00Z",
          updatedAt: "2026-10-01T00:00:00Z",
        },
      } as never;
    },
    async getSideHustleCommerceRecord() { return undefined; },
    async listSideHustleCommerceRecords() { return []; },
    async saveSideHustleCommerceRecord(_kind: SideHustleCommerceRecordKind, record) {
      saved.push(record);
      return record;
    },
  };
  return { repo, saved };
}

describe("TikTok affiliate finance ingestion", () => {
  it("persists conversion and paid payout evidence without treating seller auth as creator finance auth", async () => {
    const { repo, saved } = repository();
    const result = await ingestTikTokAffiliateFinanceRuntime({
      opportunityId: "opportunity-1",
      orders: [{
        id: "conversion-1",
        opportunityId: "opportunity-1",
        programRef: "collab-1",
        affiliateOrderId: "order-1",
        productRef: "product-1",
        creatorAccountRef: "creator-1",
        providerStatus: "approved",
        economicState: "approved",
        commissionAmount: 9,
        currency: "USD",
        attributedAt: "2026-10-02T12:00:00Z",
        sourceRef: "tiktok:creator-affiliate-orders",
        evidenceRefs: ["evidence:order"],
      }],
      payouts: [{
        id: "payout-1",
        opportunityId: "opportunity-1",
        programRef: "collab-1",
        payoutId: "pay-1",
        affiliateOrderId: "order-1",
        conversionExternalRef: "tiktok:affiliate-order:order-1",
        conversionAt: "2026-10-02T12:00:00Z",
        creatorAccountRef: "creator-1",
        providerStatus: "paid",
        amount: 9,
        currency: "USD",
        paidAt: "2026-10-04T12:00:00Z",
        sourceRef: "tiktok:creator-settlement-report",
        evidenceRefs: ["evidence:payout"],
        sourceKind: "affiliate_settlement_report",
      }],
    }, repo);

    expect(result.persisted).toBe(2);
    expect(saved).toHaveLength(2);
    expect(result.creatorAuthorizationRequired).toBe(true);
    expect(result.sellerTokenSufficientForCreatorFinance).toBe(false);
    expect(result.moneyMovementAuthorized).toBe(false);
  });
});
