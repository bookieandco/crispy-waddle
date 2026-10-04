import { describe, expect, it } from "vitest";
import {
  observeTikTokPodFulfillmentFromPrintify,
  type TikTokPrintifyReadClient,
} from "./tiktok-printify-fulfillment";

const client: TikTokPrintifyReadClient = {
  async listShops() {
    return [{ id: 12, title: "TikTok POD", salesChannel: "tiktok" }];
  },
  async getProduct() {
    return {
      id: "printify-product-1",
      title: "Blanket",
      blueprintId: 99,
      printProviderId: 7,
      visible: true,
      variants: [{
        id: 1,
        sku: "blanket-1",
        cost: 1800,
        price: 3999,
        isEnabled: true,
        isAvailable: true,
      }],
    };
  },
  async getPrintProvider() {
    return { id: 7, title: "US Provider", country: "US", region: "CA" };
  },
  async getBlueprintShipping() {
    return {
      handlingValue: 3,
      handlingUnit: "business_days",
      supportedCountries: ["US", "CA"],
    };
  },
};

describe("TikTok Printify fulfillment adapter", () => {
  it("builds evidence-backed listing readiness without inventing TikTok state", async () => {
    const observation = await observeTikTokPodFulfillmentFromPrintify(client, {
      printifyProductId: "printify-product-1",
      tiktokProductRef: "tiktok-product-1",
      merchantRegion: "US",
      destinationRegion: "US",
      channelEligibility: "eligible",
      taxInfoState: "ready",
      shippingMode: "seller_shipping",
      madeToOrderState: "enabled",
      maxPermittedHandlingBusinessDays: 5,
      trackingCompatible: true,
      observedAt: "2026-10-04T09:00:00Z",
      tikTokEvidenceRefs: ["tts:product:tiktok-product-1"],
    });
    expect(observation.salesChannelConnection).toBe("connected");
    expect(observation.providerSupportsDestination).toBe(true);
    expect(observation.estimatedHandlingBusinessDays).toBe(3);
    expect(observation.evidenceRefs).toContain("printify:product:printify-product-1");
  });

  it("fails closed when multiple Printify shops exist and no shop id is selected", async () => {
    const ambiguous: TikTokPrintifyReadClient = {
      ...client,
      async listShops() {
        return [
          { id: 1, title: "A", salesChannel: "api" },
          { id: 2, title: "B", salesChannel: "api" },
        ];
      },
    };
    await expect(observeTikTokPodFulfillmentFromPrintify(ambiguous, {
      printifyProductId: "p",
      tiktokProductRef: "t",
      merchantRegion: "US",
      destinationRegion: "US",
      channelEligibility: "eligible",
      taxInfoState: "ready",
      shippingMode: "seller_shipping",
      madeToOrderState: "enabled",
      maxPermittedHandlingBusinessDays: 5,
      trackingCompatible: true,
      tikTokEvidenceRefs: ["evidence"],
    })).rejects.toThrow(/SHOP_ID_REQUIRED/);
  });
});
