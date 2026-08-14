import { describe, it, expect } from "vitest"
import {
  InMemoryApprovalReceiptStore,
  SupabaseAuditLedger,
  type ActionPolicy,
  type ActionPolicyDecision,
  type ActionRequest,
  type AuditRpcClient,
} from "@jhadina/action-core"
import type { CheckoutItem } from "@jhadina/checkout-orchestrator"
import type { ActionRequestIdentity, JhadinaActionRequest, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { runCommerceIntentGoverned } from "./governed-commerce-intent"
import { GovernedPaymentProvider } from "./governed-payment-provider"
import { StripeSandboxPaymentProvider, type StripeFetch } from "./stripe-sandbox-provider"
import { COMMERCE_AUDIT_DOMAIN } from "./durable-audit-ledger"
import {
  COMMERCE_CHECKOUT_CAPABILITY,
  COMMERCE_PAYMENT_CHARGE_CAPABILITY,
  COMMERCE_PAYMENT_REFUND_CAPABILITY,
} from "./commerce-security-policy"

/**
 * PL-5 (Jhadina OS Integration Phase 2): proves Commerce's audit trail
 * is actually durable, not merely dependency-wired to
 * SupabaseAuditLedger. Every scenario below writes through one
 * SupabaseAuditLedger instance and reads back through a completely
 * separate SupabaseAuditLedger instance, sharing only the underlying
 * fake RPC "table" — the closest a unit test can come to proving data
 * survives a real process boundary without a live Supabase project.
 * FakeAuditRpcClient models append_jhadina_audit_event /
 * list_jhadina_audit_events closely enough to be a real integration
 * double (sequential per-domain sequence numbers, domain/actor-scoped
 * reads), the same standard governed-approval-runtime.test.ts (PL-2)
 * established for Growth.
 *
 * This file is intentionally separate from governed-commerce-intent.test.ts
 * (Finding D's original logic proof, which stays on InMemoryActionLedger
 * for fast pure-logic coverage — ActionLedger is the type both now
 * satisfy) and from governed-payment-provider.test.ts. Nothing about
 * checkout-orchestrator, payment-core, order-fulfillment-core, or
 * @jhadina/action-core's contracts changes here.
 */

type FakeRow = {
  domain: string
  sequence: number
  event_id: string
  request_id: string
  actor_id: string
  capability: string
  status: string
  occurred_at: string
  metadata: Record<string, unknown>
}

class FakeAuditRpcClient implements AuditRpcClient {
  private readonly rows: FakeRow[] = []
  private readonly sequenceByDomain = new Map<string, number>()

  async rpc<T = unknown>(fn: string, args: Record<string, unknown>) {
    if (fn === "append_jhadina_audit_event") {
      const domain = args.p_domain as string
      const sequence = (this.sequenceByDomain.get(domain) ?? 0) + 1
      this.sequenceByDomain.set(domain, sequence)
      this.rows.push({
        domain,
        sequence,
        event_id: args.p_event_id as string,
        request_id: args.p_request_id as string,
        actor_id: args.p_actor_id as string,
        capability: args.p_capability as string,
        status: args.p_status as string,
        occurred_at: args.p_occurred_at as string,
        metadata: (args.p_metadata as Record<string, unknown>) ?? {},
      })
      return { data: null as T | null, error: null }
    }
    if (fn === "list_jhadina_audit_events") {
      const domain = args.p_domain as string
      const actorId = args.p_actor_id as string
      const rows = this.rows.filter((r) => r.domain === domain && r.actor_id === actorId)
      return { data: rows as T, error: null }
    }
    return { data: null as T | null, error: { message: `Unknown RPC: ${fn}` } }
  }
}

/** A brand-new SupabaseAuditLedger instance, deliberately never used to write — the read-side "different process." */
function freshReader(rpc: FakeAuditRpcClient): SupabaseAuditLedger {
  return new SupabaseAuditLedger({ client: rpc, domain: COMMERCE_AUDIT_DOMAIN })
}

async function readBack(rpc: FakeAuditRpcClient, actorId: string) {
  return freshReader(rpc).list({ domain: COMMERCE_AUDIT_DOMAIN, actorId })
}

function staticIdentityVerifier(identity: ActionRequestIdentity): JhadinaIdentityVerifier {
  return {
    async verify(request: JhadinaActionRequest) {
      if (request.userId !== identity.userId) throw new Error("Action identity mismatch")
      return identity
    },
  }
}

type CommerceCapabilityAction = { capability: string }

function policyWith(overrides: Record<string, ActionPolicyDecision>): ActionPolicy<CommerceCapabilityAction> {
  return {
    async evaluate(request: ActionRequest<CommerceCapabilityAction>): Promise<ActionPolicyDecision> {
      if (request.action.capability in overrides) return overrides[request.action.capability]
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

function rawProvider(fetchImpl: StripeFetch) {
  return new StripeSandboxPaymentProvider({ secret: "sk_test_x", fetchImpl })
}

function successfulFetch(): StripeFetch {
  return async (input) => {
    const url = typeof input === "string" ? input : input.toString()
    if (url.includes("/v1/refunds")) return new Response(JSON.stringify({ id: "re_1", status: "succeeded", payment_intent: "pi_1" }), { status: 200 })
    return new Response(JSON.stringify({ id: "pi_1", status: "succeeded", amount: 0, currency: "usd" }), { status: 200 })
  }
}

function freshDeps(
  identity: ActionRequestIdentity,
  rpc: FakeAuditRpcClient,
  provider: StripeSandboxPaymentProvider,
  policy?: ActionPolicy<CommerceCapabilityAction>,
) {
  return {
    identityVerifier: staticIdentityVerifier(identity),
    ledger: new SupabaseAuditLedger({ client: rpc, domain: COMMERCE_AUDIT_DOMAIN }),
    approvalStore: new InMemoryApprovalReceiptStore(),
    paymentProvider: provider,
    policy,
  }
}

describe("Commerce durable audit — PL-5 (Jhadina OS Integration Phase 2)", () => {
  it("1. authorized charge / successful payment: every event is durably readable through a fresh ledger instance, attributed to the verified actor only", async () => {
    const identity: ActionRequestIdentity = { userId: "user-durable-1", sessionId: "session-1" }
    const rpc = new FakeAuditRpcClient()
    const deps = freshDeps(identity, rpc, rawProvider(successfulFetch()))

    // customerId deliberately differs from the verified actor — proves
    // durable events are attributed to identity.userId, never intent data.
    const outcome = await runCommerceIntentGoverned(deps, identity.userId, {
      customerId: "someone-else-entirely",
      items: items(),
    })
    expect(outcome.result.session.status).toBe("completed")

    const trail = await readBack(rpc, identity.userId)
    expect(trail.length).toBeGreaterThan(0)
    expect(trail.every((e) => e.userId === identity.userId)).toBe(true)
    expect(trail.some((e) => e.userId === "someone-else-entirely")).toBe(false)
    expect(trail.some((e) => e.type === COMMERCE_CHECKOUT_CAPABILITY && e.status === "started")).toBe(true)
    expect(trail.some((e) => e.type === COMMERCE_CHECKOUT_CAPABILITY && e.status === "completed")).toBe(true)
    expect(trail.some((e) => e.type === COMMERCE_PAYMENT_CHARGE_CAPABILITY && e.status === "completed")).toBe(true)

    // No event was ever visible through the writer's own reference before
    // being durably persisted — the reader never touches deps.ledger.
    const emptyDomainForOtherActor = await readBack(rpc, "no-such-actor")
    expect(emptyDomainForOtherActor).toHaveLength(0)
  })

  it("2. policy-denied checkout: the denial is durably recorded before any provider call, nothing else runs", async () => {
    const identity: ActionRequestIdentity = { userId: "user-durable-2", sessionId: "session-2" }
    const rpc = new FakeAuditRpcClient()
    let calls = 0
    const provider = rawProvider(async (input, init) => {
      calls += 1
      return successfulFetch()(input, init)
    })
    const deps = freshDeps(identity, rpc, provider, policyWith({ [COMMERCE_CHECKOUT_CAPABILITY]: "deny" }))

    await expect(
      runCommerceIntentGoverned(deps, identity.userId, { customerId: identity.userId, items: items() }),
    ).rejects.toThrow(`Action denied by policy: ${COMMERCE_CHECKOUT_CAPABILITY}`)

    expect(calls).toBe(0)
    const trail = await readBack(rpc, identity.userId)
    // "started" is always appended before authorization runs; "denied"
    // is the actual policy outcome — both durably present, in order.
    expect(trail.map((e) => e.status)).toEqual(["started", "denied"])
    expect(trail.every((e) => e.type === COMMERCE_CHECKOUT_CAPABILITY)).toBe(true)
    expect(trail.every((e) => e.userId === identity.userId)).toBe(true)
  })

  it("3. approval rejection (approval required but not permitted for this capability) fails closed and is durably recorded, before any provider call", async () => {
    const identity: ActionRequestIdentity = { userId: "user-durable-3", sessionId: "session-3" }
    const rpc = new FakeAuditRpcClient()
    let calls = 0
    const provider = rawProvider(async (input, init) => {
      calls += 1
      return successfulFetch()(input, init)
    })
    // commerce.checkout is never approval-gated in the real policy —
    // this exercises governed-commerce-intent.ts's own defensive
    // fail-closed branch (allowApproval=false) directly, proving an
    // approval-required decision on a non-approval-eligible capability
    // is rejected rather than silently allowed.
    const deps = freshDeps(identity, rpc, provider, policyWith({ [COMMERCE_CHECKOUT_CAPABILITY]: "approval_required" }))

    await expect(
      runCommerceIntentGoverned(deps, identity.userId, { customerId: identity.userId, items: items() }),
    ).rejects.toThrow(`Approval required: ${COMMERCE_CHECKOUT_CAPABILITY}`)

    expect(calls).toBe(0)
    const trail = await readBack(rpc, identity.userId)
    expect(trail.map((e) => e.status)).toEqual(["started", "approval_required"])
    expect(trail.every((e) => e.type === COMMERCE_CHECKOUT_CAPABILITY)).toBe(true)
    expect(trail.every((e) => e.userId === identity.userId)).toBe(true)
  })

  it("4. provider failure (raw transport throws, not a decline): the charge is durably audited as failed, with the failure reason preserved", async () => {
    const identity: ActionRequestIdentity = { userId: "user-durable-4", sessionId: "session-4" }
    const rpc = new FakeAuditRpcClient()
    const provider = rawProvider(async () => {
      throw new Error("ECONNRESET: sandbox network failure")
    })
    const deps = freshDeps(identity, rpc, provider)

    await expect(
      runCommerceIntentGoverned(deps, identity.userId, { customerId: identity.userId, items: items() }),
    ).resolves.toMatchObject({ result: { session: { status: "failed" } } })

    const trail = await readBack(rpc, identity.userId)
    const chargeFailed = trail.find((e) => e.type === COMMERCE_PAYMENT_CHARGE_CAPABILITY && e.status === "failed")
    expect(chargeFailed).toBeDefined()
    expect(chargeFailed?.userId).toBe(identity.userId)
    expect(String(chargeFailed?.metadata?.reason)).toContain("ECONNRESET")
    expect(trail.some((e) => e.type === COMMERCE_CHECKOUT_CAPABILITY && e.status === "failed")).toBe(true)
  })

  it("5. fulfillment denial after a successful governed charge still triggers automatic refund compensation, durably, under the verified actor", async () => {
    const identity: ActionRequestIdentity = { userId: "user-durable-5", sessionId: "session-5" }
    const rpc = new FakeAuditRpcClient()
    const deps = freshDeps(identity, rpc, rawProvider(successfulFetch()))

    const outcome = await runCommerceIntentGoverned(
      deps,
      identity.userId,
      { customerId: identity.userId, items: items() },
      { fulfillmentPolicyDenies: ["accept"] },
    )
    expect(outcome.result.session.status).toBe("failed")
    expect(outcome.result.paymentIntents[0]?.status).toBe("refunded")

    const trail = await readBack(rpc, identity.userId)
    expect(trail.some((e) => e.type === COMMERCE_PAYMENT_CHARGE_CAPABILITY && e.status === "completed")).toBe(true)
    expect(trail.some((e) => e.type === COMMERCE_PAYMENT_REFUND_CAPABILITY && e.status === "completed")).toBe(true)
    expect(trail.some((e) => e.type === COMMERCE_CHECKOUT_CAPABILITY && e.status === "failed")).toBe(true)
    expect(trail.every((e) => e.userId === identity.userId)).toBe(true)
  })

  it("6. refund failure: an automatic compensating refund that itself fails at the provider is durably audited as failed, not silently dropped", async () => {
    const identity: ActionRequestIdentity = { userId: "user-durable-6", sessionId: "session-6" }
    const rpc = new FakeAuditRpcClient()
    const provider = rawProvider(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString()
      if (url.includes("/v1/refunds")) {
        return new Response(JSON.stringify({ error: { type: "api_error", message: "refund_temporarily_unavailable" } }), { status: 500 })
      }
      return successfulFetch()(input, init)
    })
    const deps = freshDeps(identity, rpc, provider)

    const outcome = await runCommerceIntentGoverned(
      deps,
      identity.userId,
      { customerId: identity.userId, items: items() },
      { fulfillmentPolicyDenies: ["accept"] },
    )
    // The charge itself succeeded and checkout still ends failed —
    // checkout-orchestrator's own catch swallows a refund failure so it
    // doesn't hide the original fulfillment-denial error, but the
    // refund attempt itself must still be visible as a failure, durably.
    expect(outcome.result.session.status).toBe("failed")

    const trail = await readBack(rpc, identity.userId)
    expect(trail.some((e) => e.type === COMMERCE_PAYMENT_CHARGE_CAPABILITY && e.status === "completed")).toBe(true)
    const refundFailed = trail.find((e) => e.type === COMMERCE_PAYMENT_REFUND_CAPABILITY && e.status === "failed")
    expect(refundFailed).toBeDefined()
    expect(refundFailed?.userId).toBe(identity.userId)
    expect(refundFailed?.metadata?.reason).toBeDefined()
  })

  it("7. idempotent retry: a duplicate charge attempt never re-calls the underlying provider, and both governed attempts are durably recorded under the verified actor", async () => {
    const identity: ActionRequestIdentity = { userId: "user-durable-7", sessionId: "session-7" }
    const rpc = new FakeAuditRpcClient()
    let calls = 0
    const provider = rawProvider(async (input, init) => {
      calls += 1
      return successfulFetch()(input, init)
    })
    const ledger = new SupabaseAuditLedger({ client: rpc, domain: COMMERCE_AUDIT_DOMAIN })
    const governed = new GovernedPaymentProvider(provider, identity.userId, ledger)

    const request = {
      paymentId: "pay_dup_durable",
      orderId: "order_dup_durable",
      customer: { id: identity.userId, type: "customer" as const },
      seller: { id: "platform", type: "platform" as const },
      amount: { amountMinor: 500, currency: "USD" },
      lines: [],
      taxes: [],
      platformFees: [],
    }
    const first = await governed.createPaymentIntent(request)
    const second = await governed.createPaymentIntent(request)

    expect(second).toEqual(first)
    expect(calls).toBe(1)

    const trail = (await readBack(rpc, identity.userId)).filter((e) => e.actionId === "pay_dup_durable")
    // The underlying provider deduplicated the actual call; the
    // governance layer still durably records both governed attempts —
    // that's a feature (every attempt is auditable), not a bug.
    expect(trail.filter((e) => e.status === "started")).toHaveLength(2)
    expect(trail.filter((e) => e.status === "completed")).toHaveLength(2)
    expect(trail.every((e) => e.userId === identity.userId)).toBe(true)
  })
})
