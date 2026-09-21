import { describe, expect, it } from "vitest"
import {
  DhgateSupplierDiscoveryAdapter,
  SUPLIFUL_SHOPIFY_FULFILLMENT_SERVICE,
  assertSuplifulShopifyOrderBinding,
  assertSuplifulShopifyProductBinding,
  parseDhgatePrice,
} from "@jhadina/commerce-adapters"

describe("supplier discovery references", () => {
  it("normalizes DHgate search rows without pretending they are routable offers", async () => {
    const adapter = new DhgateSupplierDiscoveryAdapter({
      async search() {
        return [{
          itemcode: 1071872302,
          productName: "Liquid Silicone Phone Case",
          price: "US $2.54 - 10.78",
          simHighPrice: "10.78",
          minOrder: "1 Piece",
          sellerName: "seller-a",
          sellerId: "supplier-a",
          feedbackPercent: "98.9%",
          freeShipping: false,
          isAd: true,
          reviewCount: 42,
          productUrl: "https://example.invalid/product",
          scrapedAt: "2026-09-21T12:00:00Z",
        }]
      },
    })

    const rows = await adapter.search({
      query: "phone case",
      destinationCountry: "us",
      currency: "usd",
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      provider: "dhgate",
      sourceId: "dhgate:1071872302",
      productId: "1071872302",
      minUnitAmountMinor: 254,
      maxUnitAmountMinor: 1078,
      currency: "USD",
      minimumOrderQuantity: 1,
      sellerFeedbackPercent: 98.9,
      sponsored: true,
      destinationCountry: "US",
    })
    expect("availableQuantity" in rows[0]).toBe(false)
    expect("estimatedDeliveryDays" in rows[0]).toBe(false)
  })

  it("parses simple observed DHgate price ranges deterministically", () => {
    expect(parseDhgatePrice("US $2.54 - 10.78", "10.78")).toEqual({ min: 254, max: 1078 })
    expect(parseDhgatePrice(undefined, undefined)).toBeUndefined()
  })

  it("requires canonical Shopify IDs and the Supliful fulfillment service", () => {
    const product = {
      internalProductId: "product-1",
      internalVariantId: "variant-1",
      shopifyProductGid: "gid://shopify/Product/123",
      shopifyVariantGid: "gid://shopify/ProductVariant/456",
      fulfillmentServiceName: SUPLIFUL_SHOPIFY_FULFILLMENT_SERVICE,
      observedAt: "2026-09-21T12:00:00Z",
    }
    expect(() => assertSuplifulShopifyProductBinding(product)).not.toThrow()
    expect(() =>
      assertSuplifulShopifyProductBinding({
        ...product,
        fulfillmentServiceName: "manual",
      }),
    ).toThrow(/Supliful Fulfillment/)

    expect(() =>
      assertSuplifulShopifyOrderBinding({
        internalOrderId: "order-1",
        shopifyOrderGid: "gid://shopify/Order/789",
        shopifyFulfillmentOrderGid: "gid://shopify/FulfillmentOrder/999",
        fulfillmentStatus: "in_progress",
        observedAt: "2026-09-21T12:00:00Z",
      }),
    ).not.toThrow()
  })
})
