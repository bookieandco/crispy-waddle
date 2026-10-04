import { describe, expect, it, vi } from "vitest";
import {
  publishTikTokSkuWithApproval,
  type TikTokSkuPublisher,
} from "./tiktok-sku-publication-runtime";

const qc = {
  id: "qc:1",
  productRef: "product-1",
  status: "pass" as const,
  reasons: [],
  truthMatchedAssertionRefs: ["color:primary:blue"],
  approvedClaimRefs: [],
  approvedOfferRefs: [],
  evidenceIds: ["evidence:qc"],
  evaluatedAt: "2026-10-04T10:00:00Z",
  publicationAuthorized: false as const,
  moneyMovementAuthorized: false as const,
};

const action = {
  id: "action:tiktok-sku:1",
  userId: "user-1",
  opportunityId: "opportunity-1",
  ventureId: "venture-1",
  shopRef: "tiktok-shop-1",
  productRef: "product-1",
  skuRefs: ["sku-1"],
  qc,
  creativeArtifactRefs: ["asset:creative-1"],
  provider: "printify" as const,
  providerShopId: "printify-shop-1",
  providerProductId: "printify-product-1",
  evidenceRefs: ["evidence:qc"],
  requestedAt: "2026-10-04T10:05:00Z",
};

describe("TikTok SKU publication runtime", () => {
  it("requires and consumes a matching approval before provider mutation", async () => {
    const verifier = {
      verifyAndConsume: vi.fn(async () => true),
    };
    const publisher: TikTokSkuPublisher = {
      publish: vi.fn(async () => ({
        provider: "printify",
        providerShopId: "printify-shop-1",
        providerProductId: "printify-product-1",
        providerListingRef: "printify-product-1",
        state: "submitted" as const,
        observedAt: "2026-10-04T10:06:00Z",
        evidenceRefs: ["printify:publish:receipt"],
      })),
    };

    const receipt = await publishTikTokSkuWithApproval({
      action,
      approvalReceiptId: "approval-1",
      verifier,
      publisher,
    });
    expect(verifier.verifyAndConsume).toHaveBeenCalledTimes(1);
    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(receipt.state).toBe("submitted");
    expect(receipt.authorizationEffect).toBe("NONE");
  });

  it("does not call the provider when approval is absent or invalid", async () => {
    const verifier = {
      verifyAndConsume: vi.fn(async () => false),
    };
    const publisher: TikTokSkuPublisher = {
      publish: vi.fn(),
    };
    await expect(publishTikTokSkuWithApproval({
      action,
      approvalReceiptId: "approval-bad",
      verifier,
      publisher,
    })).rejects.toThrow(/APPROVAL_INVALID/);
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});
