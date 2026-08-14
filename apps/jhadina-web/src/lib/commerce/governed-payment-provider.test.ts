import { describe, test, expect } from "vitest"
import { InMemoryActionLedger } from "@jhadina/action-core"
import type { PaymentIntentRequest } from "@jhadina/payment-core"
import { StripeSandboxPaymentProvider } from "./stripe-sandbox-provider"
import { GovernedPaymentProvider, PaymentCapabilityDeniedError } from "./governed-payment-provider"

const VERIFIED_ACTOR = "user-verified-1"

function provider() {
  return new StripeSandboxPaymentProvider({
    secret: "sk_test_x",
    fetchImpl: async (input) => {
      const url = typeof input === "string" ? input : input.toString()
      if (url.includes("/v1/refunds")) return new Response(JSON.stringify({ id: "re_1", status: "succeeded", payment_intent: "pi_1" }), { status: 200 })
      return new Response(JSON.stringify({ id: "pi_1", status: "succeeded", amount: 0, currency: "usd" }), { status: 200 })
    },
  })
}

function paymentRequest(overrides: Partial<PaymentIntentRequest> = {}): PaymentIntentRequest {
  return {
    paymentId: "pay_1",
    orderId: "order_1",
    customer: { id: "cust_1", type: "customer" },
    seller: { id: "platform", type: "platform" },
    amount: { amountMinor: 1000, currency: "USD" },
    lines: [],
    taxes: [],
    platformFees: [],
    ...overrides,
  }
}

describe("GovernedPaymentProvider — explicit capability boundary, authorization before provider call, full audit trail", () => {
  test("requires a verified actor id — refuses to construct without one", () => {
    expect(() => new GovernedPaymentProvider(provider(), "")).toThrow("verified actor")
  })

  test("charge is an allowed capability: authorized before the provider call, recorded started->completed, and audited against the verified actor — never request.customer.id", async () => {
    const ledger = new InMemoryActionLedger()
    const governed = new GovernedPaymentProvider(provider(), VERIFIED_ACTOR, ledger)
    // customer.id deliberately differs from the verified actor, to prove which one wins.
    const intent = await governed.createPaymentIntent(paymentRequest({ customer: { id: "someone-else-entirely", type: "customer" } }))
    expect(intent.status).toBe("captured")

    const trail = ledger.list().filter((e) => e.actionId === "pay_1")
    expect(trail.map((e) => e.status)).toEqual(["started", "completed"])
    expect(trail.every((e) => e.type === "commerce.payment.charge")).toBe(true)
    expect(trail.every((e) => e.userId === VERIFIED_ACTOR)).toBe(true)
    expect(trail.every((e) => e.userId !== "someone-else-entirely")).toBe(true)
  })

  test("payout is denied by policy: the wrapped provider is never called, and the denial itself is audited against the verified actor", async () => {
    const underlying = provider()
    let payoutCalls = 0
    const originalCreatePayout = underlying.createPayout.bind(underlying)
    underlying.createPayout = async (instruction) => {
      payoutCalls += 1
      return originalCreatePayout(instruction)
    }
    const ledger = new InMemoryActionLedger()
    const governed = new GovernedPaymentProvider(underlying, VERIFIED_ACTOR, ledger)

    await expect(
      governed.createPayout({
        payoutId: "po_1",
        merchant: { id: "merchant_1", type: "merchant" },
        orderId: "order_1",
        gross: { amountMinor: 100, currency: "USD" },
        fees: { amountMinor: 0, currency: "USD" },
        taxesWithheld: { amountMinor: 0, currency: "USD" },
        refunds: { amountMinor: 0, currency: "USD" },
        net: { amountMinor: 100, currency: "USD" },
      }),
    ).rejects.toThrow(PaymentCapabilityDeniedError)

    // Authorization happened before any provider call — the wrapped provider's own method never ran.
    expect(payoutCalls).toBe(0)

    const trail = ledger.list().filter((e) => e.actionId === "po_1")
    expect(trail).toHaveLength(1)
    expect(trail[0].status).toBe("denied")
    expect(trail[0].type).toBe("commerce.payment.payout")
    expect(trail[0].userId).toBe(VERIFIED_ACTOR)
  })

  test("reconcile is denied the same way", async () => {
    const ledger = new InMemoryActionLedger()
    const governed = new GovernedPaymentProvider(provider(), VERIFIED_ACTOR, ledger)
    await expect(governed.reconcile("2026-01-01", "2026-01-31")).rejects.toThrow(PaymentCapabilityDeniedError)
    const trail = ledger.list().filter((e) => e.type === "commerce.payment.reconcile")
    expect(trail).toHaveLength(1)
    expect(trail[0].status).toBe("denied")
  })

  test("a failed charge is audited as failed, not silently dropped", async () => {
    const failing = new StripeSandboxPaymentProvider({
      secret: "sk_test_x",
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: { type: "card_error", code: "card_declined", message: "declined" } }), { status: 402 }),
    })
    const ledger = new InMemoryActionLedger()
    const governed = new GovernedPaymentProvider(failing, VERIFIED_ACTOR, ledger)

    await expect(governed.createPaymentIntent(paymentRequest({ paymentId: "pay_declined" }))).rejects.toThrow()

    const trail = ledger.list().filter((e) => e.actionId === "pay_declined")
    expect(trail.map((e) => e.status)).toEqual(["started", "failed"])
    expect(trail[1].metadata?.reason).toBeDefined()
  })

  test("refund is an allowed capability and composes through the same governed gate, audited against the verified actor — never request.requestedBy", async () => {
    const ledger = new InMemoryActionLedger()
    const governed = new GovernedPaymentProvider(provider(), VERIFIED_ACTOR, ledger)
    await governed.createPaymentIntent(paymentRequest({ paymentId: "pay_refund_me" }))
    const refunded = await governed.refund({ refundId: "re_1", paymentId: "pay_refund_me", reason: "customer_request", requestedBy: "someone-else-entirely" })
    expect(refunded.status).toBe("refunded")

    const trail = ledger.list().filter((e) => e.actionId === "re_1")
    expect(trail.map((e) => e.status)).toEqual(["started", "completed"])
    expect(trail.every((e) => e.type === "commerce.payment.refund")).toBe(true)
    expect(trail.every((e) => e.userId === VERIFIED_ACTOR)).toBe(true)
  })
})
