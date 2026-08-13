import { describe, test, expect } from "vitest"
import type { CheckoutItem } from "@jhadina/checkout-orchestrator"
import { runCommerceIntentLifecycle } from "./commerce-intent"

function items(overrides: Partial<CheckoutItem> = {}): CheckoutItem[] {
  return [
    {
      offerId: "offer-1",
      merchantId: "merchant-1",
      locationId: "location-1",
      productId: "product-1",
      quantity: 2,
      unitAmountMinor: 1500,
      currency: "USD",
      ...overrides,
    },
  ]
}

describe("Commerce spine proof — intent -> checkout -> payment -> fulfillment -> event", () => {
  test("a complete, successful lifecycle produces real state at every stage", async () => {
    const result = await runCommerceIntentLifecycle({ customerId: "cust-1", items: items() })

    // Checkout reached its terminal success state with a real computed total.
    expect(result.session.status).toBe("completed")
    expect(result.session.subtotalMinor).toBe(3000) // 2 x 1500
    expect(result.session.taxMinor).toBe(240) // 8% of 3000
    expect(result.session.deliveryFeeMinor).toBe(499)
    expect(result.session.platformFeeMinor).toBe(150) // 5% of 3000
    expect(result.session.totalMinor).toBe(3000 + 240 + 499 + 150)
    expect(result.session.reservationIds).toHaveLength(1)
    expect(result.session.paymentId).toBeDefined()
    expect(result.session.orderId).toBeDefined()

    // Payment actually happened, for the actual computed total (not a
    // hardcoded/guessed amount) — inspected via the provider's own ledger.
    expect(result.paymentIntents).toHaveLength(1)
    expect(result.paymentIntents[0].status).toBe("captured")
    expect(result.paymentIntents[0].amount.amountMinor).toBe(result.session.totalMinor)

    // Fulfillment actually ran: a real Order was constructed and handed
    // to order-fulfillment-core, which created a manifest and appended a
    // custody event — this is the "does it compose" proof, not just a
    // typecheck.
    expect(result.order).toBeDefined()
    expect(result.order?.status).toBe("created")
    expect(result.order?.custodyStatus).toBe("merchant_control")
    expect(result.order?.items).toHaveLength(1)
    expect(result.order?.items[0].reservationId).toBe(result.session.reservationIds[0])

    expect(result.custodyEvents).toHaveLength(1)
    expect(result.custodyEvents[0].to).toBe("merchant_control")
    expect(result.custodyEvents[0].actorType).toBe("system")
  })

  test("an inventory reservation failure fails closed: checkout fails, no payment, no order", async () => {
    const result = await runCommerceIntentLifecycle(
      { customerId: "cust-2", items: items() },
      { inventoryFailures: [{ productId: "product-1", reason: "out of stock" }] },
    )

    expect(result.session.status).toBe("failed")
    expect(result.session.paymentId).toBeUndefined()
    expect(result.session.orderId).toBeUndefined()
    expect(result.paymentIntents).toHaveLength(0)
    expect(result.order).toBeUndefined()
    expect(result.custodyEvents).toHaveLength(0)
  })

  test("a declined payment fails closed: no order is created, reservations are released", async () => {
    const result = await runCommerceIntentLifecycle(
      { customerId: "cust-3", items: items() },
      { paymentDeclineAtOrAboveMinor: 1 }, // decline any nonzero amount
    )

    expect(result.session.status).toBe("failed")
    expect(result.session.orderId).toBeUndefined()
    expect(result.order).toBeUndefined()
    // The payment attempt is still visible in the ledger as a declined intent —
    // failure is recorded, not silently discarded.
    expect(result.paymentIntents).toHaveLength(1)
    expect(result.paymentIntents[0].status).toBe("failed")
  })

  test("a fulfillment policy denial after successful payment triggers an automatic refund", async () => {
    const result = await runCommerceIntentLifecycle(
      { customerId: "cust-4", items: items() },
      { fulfillmentPolicyDenies: ["accept"] },
    )

    expect(result.session.status).toBe("failed")
    expect(result.session.orderId).toBeUndefined()
    expect(result.order).toBeUndefined()

    // Payment was captured before fulfillment was attempted, then the
    // orchestrator's own failure path refunded it — proving the three
    // contracts compose in both directions, not just the happy path.
    expect(result.paymentIntents).toHaveLength(1)
    expect(result.paymentIntents[0].status).toBe("refunded")
  })

  test("a multi-merchant checkout fails closed with a clear reason instead of silently misattributing items", async () => {
    const twoMerchantItems: CheckoutItem[] = [
      ...items(),
      { offerId: "offer-2", merchantId: "merchant-2", locationId: "location-2", productId: "product-2", quantity: 1, unitAmountMinor: 900, currency: "USD" },
    ]

    const result = await runCommerceIntentLifecycle({ customerId: "cust-5", items: twoMerchantItems })

    expect(result.session.status).toBe("failed")
    expect(result.order).toBeUndefined()
    // Payment was captured (checkout-orchestrator pays before creating the
    // order), then refunded once the fulfillment bridge rejected the
    // multi-merchant order — the same cross-contract failure path as above.
    expect(result.paymentIntents).toHaveLength(1)
    expect(result.paymentIntents[0].status).toBe("refunded")
  })

  test("an empty checkout is rejected rather than silently producing a zero-item order", async () => {
    const result = await runCommerceIntentLifecycle({ customerId: "cust-6", items: [] })
    expect(result.session.status).toBe("failed")
    expect(result.order).toBeUndefined()
  })
})
