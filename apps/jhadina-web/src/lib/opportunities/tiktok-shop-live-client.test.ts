import { describe, expect, it } from "vitest";
import {
  buildTikTokOfferObservations,
  buildTikTokProductObservation,
  signTikTokShopRequest,
  TikTokShopLiveClient,
} from "./tiktok-shop-live-client";

const config = {
  appKey: "app-key",
  appSecret: "app-secret",
  accessToken: "access-token",
  shopCipher: "cipher-1",
  shopRegion: "US",
  accountRef: "account-1",
};

describe("TikTok Shop live client", () => {
  it("signs deterministically and excludes sign/access_token query keys", () => {
    const a = signTikTokShopRequest({
      path: "/product/202309/products/search",
      query: {
        timestamp: "1700000000",
        app_key: "app-key",
        shop_cipher: "cipher-1",
        sign: "ignore-me",
        access_token: "ignore-me-too",
      },
      bodyText: "{}",
      appSecret: "app-secret",
    });
    const b = signTikTokShopRequest({
      path: "/product/202309/products/search",
      query: {
        shop_cipher: "cipher-1",
        app_key: "app-key",
        timestamp: "1700000000",
      },
      bodyText: "{}",
      appSecret: "app-secret",
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verifies the configured shop without exposing secrets", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({
        code: 0,
        data: { shops: [{ id: "shop-1", cipher: "cipher-1", region: "US", name: "Shop" }] },
      }), { status: 200 }),
    ) as unknown as typeof fetch;
    const client = new TikTokShopLiveClient(config, fetchImpl);
    const observation = await client.verifyConfiguredShop(new Date("2026-10-04T08:30:00Z"));
    expect(observation.authorized).toBe(true);
    expect(observation.matchedShop?.id).toBe("shop-1");
    expect(observation.secretMaterialExposed).toBe(false);
    const request = fetchImpl.mock.calls[0]![0] as URL;
    expect(request.toString()).not.toContain("app-secret");
    expect(request.toString()).not.toContain("access-token");
  });

  it("maps provider product and promotion snapshots into canonical evidence", () => {
    const product = buildTikTokProductObservation({
      snapshot: {
        productId: "product-1",
        title: "Example",
        skus: [{ id: "sku-1", price: { amount: "39.99", currency: "USD" } }],
        raw: {},
      },
      shopRef: "shop-1",
      observedAt: "2026-10-04T08:30:00Z",
      commissionRate: 0.15,
      evidenceRefs: ["tts:get-product:product-1"],
    });
    expect(product.price.value).toBe(39.99);
    expect(product.commissionRate?.value).toBe(0.15);

    const offers = buildTikTokOfferObservations({
      activity: {
        activityId: "activity-1",
        title: "Sale",
        activityType: "DIRECT_DISCOUNT",
        status: "ONGOING",
        beginTime: 1791090000,
        endTime: 1791176400,
        products: [{ id: "product-1", discount: "10" }],
        raw: {},
      },
      productRef: "product-1",
      observedAt: "2026-10-04T08:30:00Z",
      sourceRef: "tts:activity:activity-1",
      evidenceRefs: ["tts:activity:activity-1"],
    });
    expect(offers).toHaveLength(1);
    expect(offers[0]?.state).toBe("active");
    expect(offers[0]?.percentOff?.value).toBe(0.1);
  });
});
