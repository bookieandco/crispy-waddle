import { describe, it, expect } from "vitest"
import { InMemoryActionLedger, InMemoryApprovalReceiptStore, type ActionPolicy, type ActionPolicyDecision, type ActionRequest } from "@jhadina/action-core"
import type { CheckoutItem } from "@jhadina/checkout-orchestrator"
import type { ActionRequestIdentity, JhadinaActionRequest, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { runCommerceIntentGoverned } from "./governed-commerce-intent"
import { StripeSandboxPaymentProvider } from "./stripe-sandbox-provider"
import { GovernedPaymentProvider } from "./governed-payment-provider"
import {
  COMMERCE_CHECKOUT_CAPABILITY,
  COMMERCE_PAYMENT_CHARGE_CAPABILITY,
  COMMERCE_PAYMENT_REFUND_CAPABILITY,
} from "./commerce-security-policy"

/**
 * Finding D (Jhadina OS Integration Phase 2): proves the governed
 * Commerce composition root end to end — the third domain
 * independently converging on the same identity -> policy -> approval
 * -> execute -> audit spine Growth and Money already proved.
 */

function staticIdentityVerifier(identity: ActionRequestIdentity): JhadinaIdentityVerifier {
  return {
    async verify(request: JhadinaActionRequest) {
      if (request.userId !== identity.userId) throw new Error("Action identity mismatch")
      return identity
    },
  }
}

type CommerceCapabilityAction = { capability: string }

function policyDenying(...denied: string[]): ActionPolicy<CommerceCapabilityAction> {
  return {
    async evaluate(request: ActionRequest<CommerceCapabilityAction>): Promise<ActionPolicyDecision> {
      if (denied.includes(request.action.capability)) return "deny"
      if (
        request.action.capability === COMMERCE_PAYMENT_CHARGE_CAPABILITY ||
        request.action.capability === COMMERCE_PAYMENT_REFUND_CAPABILITY
      ) {
        return "approval_required"
      }
      return "allow"
    },
  }
}

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

function callCountingRawProvider(options: { declineAll?: boolean; refundOk?: boolean } = {}) {
  let calls = 0
  const raw = new StripeSandboxPaymentProvider({
    secret: "sk_test_x",
    fetchImpl: async (input, init) => {
      calls += 1
      const url = typeof input === "string" ? input : input.toString()
      if (options.declineAll && url.includes("/v1/payment_intents") && !url.includes("/capture")) {
        return new Response(JSON.stringify({ error: { type: "card_error", code: "card_declined", message: "declined" } }), { status: 402 })
      }
      if (url.includes("/v1/refunds")) return new Response(JSON.stringify({ id: "re_1", status: "succeeded", payment_intent: "pi_1" }), { status: 200 })
      void init
      return new Response(JSON.stringify({ id: "pi_1", status: "succeeded", amount: 0, currency: "usd" }), { status: 200 })
    },
  })
  return { raw, getCalls: () => calls }
}

function freshDeps(identity: ActionRequestIdentity, rawProvider: StripeSandboxPaymentProvider, policy?: ActionPolicy<CommerceCapabilityAction>) {
  return {
    identityVerifier: staticIdentityVerifier(identity),
    ledger: new InMemoryActionLedger(),
    approvalStore: new InMemoryApprovalReceiptStore(),
    paymentProvider: rawProvider,
    policy,
  }
}

describe("Commerce governed intent — Finding D (Jhadina OS Integration Phase 2)", () => {
  it("1. an authorized checkout completes end to end, and every ledger event carries the single verified actor — never an anonymous or service actor", async () => {
    const identity: ActionRequestIdentity = { userId: "user-commerce-1", sessionId: "session-1" }
    const { raw } = callCountingRawProvider()
    const deps = freshDeps(identity, raw)

    const outcome = await runCommerceIntentGoverned(deps, identity.userId, { customerId: identity.userId, items: items() })

    expect(outcome.result.session.status).toBe("completed")
    expect(outcome.verifiedUserId).toBe(identity.userId)
    expect(outcome.chargeApprovalReceiptId).toBeDefined()
    expect(outcome.refundApprovalReceiptId).toBeDefined()

    const trail = deps.ledger.list()
    expect(trail.length).toBeGreaterThan(0)
    // Every single event, checkout-level and payment-level alike, is
    // attributed to exactly the one verified actor.
    expect(trail.every((e) => e.userId === identity.userId)).toBe(true)
    expect(trail.some((e) => e.userId === "n/a" || e.userId === "unknown" || e.userId === "")).toBe(false)

    expect(trail.some((e) => e.type === COMMERCE_CHECKOUT_CAPABILITY && e.status === "started")).toBe(true)
    expect(trail.some((e) => e.type === COMMERCE_CHECKOUT_CAPABILITY && e.status === "completed")).toBe(true)
    expect(trail.some((e) => e.type === COMMERCE_PAYMENT_CHARGE_CAPABILITY && e.status === "completed")).toBe(true)
  })

  it("2. an unverifiable identity fails before any payment or provider call, and nothing is recorded to the ledger", async () => {
    const identity: ActionRequestIdentity = { userId: "user-commerce-2", sessionId: "session-2" }
    const { raw, getCalls } = callCountingRawProvider()
    const deps = freshDeps(identity, raw)

    await expect(
      runCommerceIntentGoverned(deps, "someone-else-claims-to-be", { customerId: identity.userId, items: items() }),
    ).rejects.toThrow("Action identity mismatch")

    expect(getCalls()).toBe(0)
    expect(deps.ledger.list()).toHaveLength(0)
  })

  it("3. commerce.checkout denied by policy fails before any payment or provider call", async () => {
    const identity: ActionRequestIdentity = { userId: "user-commerce-3", sessionId: "session-3" }
    const { raw, getCalls } = callCountingRawProvider()
    const deps = freshDeps(identity, raw, policyDenying(COMMERCE_CHECKOUT_CAPABILITY))

    await expect(
      runCommerceIntentGoverned(deps, identity.userId, { customerId: identity.userId, items: items() }),
    ).rejects.toThrow(`Action denied by policy: ${COMMERCE_CHECKOUT_CAPABILITY}`)

    expect(getCalls()).toBe(0)
    const trail = deps.ledger.list()
    expect(trail.some((e) => e.type === COMMERCE_CHECKOUT_CAPABILITY && e.status === "denied")).toBe(true)
    expect(trail.some((e) => e.type === COMMERCE_PAYMENT_CHARGE_CAPABILITY)).toBe(false)
  })

  it("4. an unauthorized charge (commerce.payment.charge denied) fails before the provider is ever called", async () => {
    const identity: ActionRequestIdentity = { userId: "user-commerce-4", sessionId: "session-4" }
    const { raw, getCalls } = callCountingRawProvider()
    const deps = freshDeps(identity, raw, policyDenying(COMMERCE_PAYMENT_CHARGE_CAPABILITY))

    await expect(
      runCommerceIntentGoverned(deps, identity.userId, { customerId: identity.userId, items: items() }),
    ).rejects.toThrow(`Action denied by policy: ${COMMERCE_PAYMENT_CHARGE_CAPABILITY}`)

    // The checkout itself never ran — authorization for both payment
    // capabilities happens before runCommerceIntentLifecycle is called at all.
    expect(getCalls()).toBe(0)
    const trail = deps.ledger.list()
    expect(trail.some((e) => e.type === COMMERCE_PAYMENT_CHARGE_CAPABILITY && e.status === "denied")).toBe(true)
  })

  it("5. an unauthorized refund (commerce.payment.refund denied) fails the whole checkout before it starts — both payment capabilities are pre-authorized up front", async () => {
    const identity: ActionRequestIdentity = { userId: "user-commerce-5", sessionId: "session-5" }
    const { raw, getCalls } = callCountingRawProvider()
    const deps = freshDeps(identity, raw, policyDenying(COMMERCE_PAYMENT_REFUND_CAPABILITY))

    await expect(
      runCommerceIntentGoverned(deps, identity.userId, { customerId: identity.userId, items: items() }),
    ).rejects.toThrow(`Action denied by policy: ${COMMERCE_PAYMENT_REFUND_CAPABILITY}`)

    expect(getCalls()).toBe(0)
    const trail = deps.ledger.list()
    expect(trail.some((e) => e.type === COMMERCE_PAYMENT_REFUND_CAPABILITY && e.status === "denied")).toBe(true)
    // Charge was authorized fine — only the refund pre-authorization blocked the checkout.
    expect(trail.some((e) => e.type === COMMERCE_PAYMENT_CHARGE_CAPABILITY && e.status === "completed")).toBe(true)
  })

  it("6. fulfillment denial after a successful, fully governed charge still triggers the existing automatic refund compensation", async () => {
    const identity: ActionRequestIdentity = { userId: "user-commerce-6", sessionId: "session-6" }
    const { raw } = callCountingRawProvider()
    const deps = freshDeps(identity, raw)

    const outcome = await runCommerceIntentGoverned(
      deps,
      identity.userId,
      { customerId: identity.userId, items: items() },
      { fulfillmentPolicyDenies: ["accept"] },
    )

    expect(outcome.result.session.status).toBe("failed")
    expect(outcome.result.order).toBeUndefined()
    expect(outcome.result.paymentIntents).toHaveLength(1)
    expect(outcome.result.paymentIntents[0].status).toBe("refunded")

    const trail = deps.ledger.list()
    const refundEvents = trail.filter((e) => e.type === COMMERCE_PAYMENT_REFUND_CAPABILITY)
    // Includes the up-front approval event plus the actual executed refund.
    expect(refundEvents.some((e) => e.status === "completed")).toBe(true)
    expect(refundEvents.every((e) => e.userId === identity.userId)).toBe(true)
    expect(trail.some((e) => e.type === COMMERCE_CHECKOUT_CAPABILITY && e.status === "failed")).toBe(true)
  })

  it("7. duplicate/idempotent: a repeated charge attempt for the same paymentId never re-calls the underlying provider, even through the governed, verified-actor path", async () => {
    const identity: ActionRequestIdentity = { userId: "user-commerce-7", sessionId: "session-7" }
    const { raw, getCalls } = callCountingRawProvider()
    const ledger = new InMemoryActionLedger()
    const governed = new GovernedPaymentProvider(raw, identity.userId, ledger)

    const first = await governed.createPaymentIntent({
      paymentId: "pay_dup",
      orderId: "order_dup",
      customer: { id: identity.userId, type: "customer" },
      seller: { id: "platform", type: "platform" },
      amount: { amountMinor: 500, currency: "USD" },
      lines: [],
      taxes: [],
      platformFees: [],
    })
    const second = await governed.createPaymentIntent({
      paymentId: "pay_dup",
      orderId: "order_dup",
      customer: { id: identity.userId, type: "customer" },
      seller: { id: "platform", type: "platform" },
      amount: { amountMinor: 500, currency: "USD" },
      lines: [],
      taxes: [],
      platformFees: [],
    })

    expect(second).toEqual(first)
    expect(getCalls()).toBe(1)
  })
})
