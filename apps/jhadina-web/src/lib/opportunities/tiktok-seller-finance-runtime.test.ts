import { describe, expect, it, vi } from "vitest";
import {
  mapTikTokOrderStatementToSettlements,
  mapTikTokRefundEvidence,
  ingestTikTokSellerOrderFinance,
} from "./tiktok-seller-finance-runtime";

describe("TikTok seller settlement/refund ingestion", () => {
  it("maps signed TikTok finance components into positive accounting observations", () => {
    const rows = mapTikTokOrderStatementToSettlements({
      opportunityId: "opportunity-1",
      statement: {
        orderId: "order-1",
        currency: "USD",
        revenueAmount: "100.00",
        feeAndTaxAmount: "-15.00",
        shippingCostAmount: "-5.00",
        settlementAmount: "80.00",
        skuTransactions: [],
        raw: {},
      },
      observedAt: "2026-10-04T12:00:00Z",
      evidenceRefs: ["evidence:statement"],
    });
    expect(rows.map((row) => row.kind)).toEqual([
      "sale_settlement",
      "fee_and_tax",
      "platform_shipping_cost",
    ]);
    expect(rows.map((row) => row.amount)).toEqual([100, 15, 5]);
  });

  it("marks refunds already represented in statement aggregates as informational", () => {
    const refund = mapTikTokRefundEvidence({
      id: "refund-1",
      opportunityId: "opportunity-1",
      orderRef: "order-1",
      refundRef: "tiktok:refund:1",
      amount: 20,
      currency: "USD",
      sourceRef: "tiktok:return-refund:1",
      evidenceRefs: ["evidence:refund"],
      occurredAt: "2026-10-04T13:00:00Z",
      alreadyIncludedInStatementRevenue: true,
    });
    expect(refund.accountingEffect).toBe("informational");
  });

  it("persists only provider-derived observations and grants no money authority", async () => {
    const client = {
      getOrderStatementTransactions: vi.fn(async () => ({
        orderId: "order-1",
        currency: "USD",
        revenueAmount: "100",
        feeAndTaxAmount: "-10",
        shippingCostAmount: "-5",
        settlementAmount: "85",
        skuTransactions: [],
        raw: {},
      })),
    };
    const repository = {
      upsert: vi.fn(async (_owner: string, rows: unknown[]) => rows.length),
    };
    const result = await ingestTikTokSellerOrderFinance({
      ownerUserId: "user-1",
      opportunityId: "opportunity-1",
      orderId: "order-1",
      client,
      repository,
      observedAt: "2026-10-04T12:00:00Z",
    });
    expect(result.persisted).toBe(3);
    expect(result.moneyMovementAuthorized).toBe(false);
  });
});
