import { describe, test, expect } from "vitest"
import type { CheckoutItem } from "@jhadina/checkout-orchestrator"
import { runCommerceIntentLifecycle } from "./commerce-intent"
import { StripeSandboxPaymentProvider } from "./stripe-sandbox-provider"
import { GovernedPaymentProvider } from "./governed-payment-provider"

/**
 * Commerce sandbox-payment milestone. Proves the same lifecycle SP-2
 * proved — checkout-orchestrator -> payment-core -> order-fulfillment-core
 * -> compensation on failure — composes unchanged when the reference
 * InMemoryPaymentProvider is swapped for GovernedPaymentProvider
 * wrapping StripeSandboxPaymentProvider. Nothing in checkout-orchestrator,
 * the bridge adapter, or order-fulfillment-core changes; only which
 * PaymentProvider implementation runCommerceIntentLifecycle is given.
 */
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

function sandboxProvider(options: { declineAll?: boolean } = {}) {
  const raw = new StripeSandboxPaymentProvider({
    secret: "sk_test_x",
    fetchImpl: async (input, init) => {
      const url = typeof input === "string" ? input : input.toString()
      if (options.declineAll && url.includes("/v1/payment_intents") && !url.includes("/capture")) {
        return new Response(JSON.stringify({ error: { type: "card_error", code: "card_declined", message: "declined" } }), { status: 402 })
      }
      if (url.includes("/v1/refunds")) return new Response(JSON.stringify({ id: "re_1", status: "succeeded", payment_intent: "pi_1" }), { status: 200 })
      void init
      return new Response(JSON.stringify({ id: "pi_1", status: "succeeded", amount: 0, currency: "usd" }), { status: 200 })
    },
  })
  return new GovernedPaymentProvider(raw)
}

describe("Commerce sandbox-payment lifecycle — same composition, a real-shaped provider underneath", () => {
  test("a complete, successful lifecycle through the sandbox provider produces real state at every stage", async () => {
    const paymentProvider = sandboxProvider()
    const result = await runCommerceIntentLifecycle({ customerId: "cust-1", items: items() }, { paymentProvider })

    expect(result.session.status).toBe("completed")
    expect(result.session.totalMinor).toBe(3000 + 240 + 499 + 150)
    expect(result.paymentIntents).toHaveLength(1)
    expect(result.paymentIntents[0].status).toBe("captured")
    expect(result.paymentIntents[0].amount.amountMinor).toBe(result.session.totalMinor)
    expect(result.order?.status).toBe("created")

    // Authorization happened before the provider call, and it's audited —
    // not just the checkout session's own status, a real governance trail.
    const trail = paymentProvider.getAuditTrail()
    expect(trail.some((e) => e.status === "started")).toBe(true)
    expect(trail.some((e) => e.status === "completed")).toBe(true)
    expect(trail.every((e) => e.type === "commerce.payment.charge")).toBe(true)
  })

  test("a declined sandbox payment fails closed, exactly like the reference provider", async () => {
    const paymentProvider = sandboxProvider({ declineAll: true })
    const result = await runCommerceIntentLifecycle({ customerId: "cust-2", items: items() }, { paymentProvider })

    expect(result.session.status).toBe("failed")
    expect(result.order).toBeUndefined()
    expect(result.paymentIntents).toHaveLength(1)
    expect(result.paymentIntents[0].status).toBe("failed")

    const trail = paymentProvider.getAuditTrail()
    expect(trail.some((e) => e.status === "failed")).toBe(true)
  })

  test("fulfillment denial after a successful sandbox charge still triggers the existing automatic refund compensation", async () => {
    const paymentProvider = sandboxProvider()
    const result = await runCommerceIntentLifecycle(
      { customerId: "cust-3", items: items() },
      { paymentProvider, fulfillmentPolicyDenies: ["accept"] },
    )

    expect(result.session.status).toBe("failed")
    expect(result.order).toBeUndefined()

    // Payment was captured through the real sandbox-shaped provider before
    // fulfillment was attempted, then checkout-orchestrator's own
    // failure path refunded it — the exact cross-contract behavior SP-2
    // proved against the reference provider, now proven against the
    // governed sandbox one too.
    expect(result.paymentIntents).toHaveLength(1)
    expect(result.paymentIntents[0].status).toBe("refunded")

    // The refund itself went through the same governed, audited gate.
    const trail = paymentProvider.getAuditTrail()
    const refundEvents = trail.filter((e) => e.type === "commerce.payment.refund")
    expect(refundEvents.some((e) => e.status === "completed")).toBe(true)
  })
})
