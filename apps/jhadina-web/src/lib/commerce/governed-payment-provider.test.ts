import { describe, expect, test } from "vitest"
import { InMemoryActionLedger, type ApprovalReceiptVerifier } from "@jhadina/action-core"
import type { PaymentIntent, PaymentIntentRequest, PaymentProvider } from "@jhadina/payment-core"
import { GovernedPaymentProvider, PaymentCapabilityDeniedError, PaymentApprovalRequiredError } from "./governed-payment-provider"
import type { PaymentOperationBinding, PaymentOperationRecord, PaymentOperationStore } from "./durable-payment-operation"

const ACTOR = "user-verified-1"
const request = (paymentId = "pay-1"): PaymentIntentRequest => ({
  paymentId, orderId: "order-1", customer: { id: "customer-1", type: "customer" }, seller: { id: "platform", type: "platform" },
  amount: { amountMinor: 1000, currency: "USD" }, lines: [], taxes: [], platformFees: [],
})
const result = (paymentId: string, status: PaymentIntent["status"] = "captured"): PaymentIntent => ({
  paymentId, provider: "test-provider", orderId: "order-1", amount: { amountMinor: 1000, currency: "USD" }, status,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
})

class FakeOperationStore implements PaymentOperationStore {
  private records = new Map<string, PaymentOperationRecord>()
  private key(b: PaymentOperationBinding) { return `${b.provider}:${b.operationId}:${b.paymentId}` }
  async get(b: PaymentOperationBinding) { return this.records.get(this.key(b)) }
  async claim(b: PaymentOperationBinding) {
    const k = this.key(b), existing = this.records.get(k)
    if (existing) return { claimed: false as const, record: { ...existing } }
    this.records.set(k, { ...b, status: "processing" }); return { claimed: true as const }
  }
  async complete(b: PaymentOperationBinding, r: { providerReference: string; resultStatus: string; resultPayload: unknown }) { this.records.set(this.key(b), { ...b, status: "completed", ...r }) }
  async fail(b: PaymentOperationBinding, r: { providerReference?: string; resultStatus: string; resultPayload?: unknown }) { this.records.set(this.key(b), { ...b, status: "failed", ...r }) }
}

function provider(onCall: () => void = () => {}): PaymentProvider {
  return {
    name: "test-provider",
    async createPaymentIntent(r) { onCall(); return result(r.paymentId) },
    async capture(id) { onCall(); return result(id) },
    async refund(r) { onCall(); return result(r.paymentId, "refunded") },
    async getPayment(id) { return result(id) },
    async createPayout() { throw new Error("unexpected payout") },
    async reconcile() { throw new Error("unexpected reconcile") },
  }
}

function approval(actionId: string, action: unknown, actor = ACTOR) {
  let consumed = false
  const verifier: ApprovalReceiptVerifier = { async verifyAndConsume(receiptId, req) {
    if (consumed || receiptId !== `receipt-${actionId}` || req.id !== actionId || req.userId !== actor || req.type !== "commerce.payment.charge") return false
    if (JSON.stringify(req.action) !== JSON.stringify(action)) return false
    consumed = true; return true
  }}
  return { receiptId: `receipt-${actionId}`, actionId, capability: "commerce.payment.charge" as const, verifier }
}

describe("GovernedPaymentProvider adversarial execution boundary", () => {
  test("fails closed when actor or audit ledger is missing", () => {
    const ledger = new InMemoryActionLedger()
    expect(() => new GovernedPaymentProvider(provider(), "", ledger)).toThrow("verified actor")
    expect(() => new GovernedPaymentProvider(provider(), ACTOR, undefined as never)).toThrow("explicit audit ledger")
  })

  test("allowed charge requires bound approval before provider execution", async () => {
    let calls = 0
    const governed = new GovernedPaymentProvider(provider(() => calls++), ACTOR, new InMemoryActionLedger(), {}, new FakeOperationStore())
    await expect(governed.createPaymentIntent(request())).rejects.toThrow(PaymentApprovalRequiredError)
    expect(calls).toBe(0)
  })

  test("exact operation replay returns stored result without a second provider call", async () => {
    let calls = 0; const store = new FakeOperationStore(); const req = request()
    const governed = new GovernedPaymentProvider(provider(() => calls++), ACTOR, new InMemoryActionLedger(), { "commerce.payment.charge": approval("action-1", req) }, store)
    await expect(governed.createPaymentIntent(req)).resolves.toMatchObject({ paymentId: "pay-1" })
    await expect(governed.createPaymentIntent(req)).resolves.toMatchObject({ paymentId: "pay-1" })
    expect(calls).toBe(1)
  })

  test("fingerprint substitution is rejected before provider execution", async () => {
    let calls = 0; const store = new FakeOperationStore()
    const governed = new GovernedPaymentProvider(provider(() => calls++), ACTOR, new InMemoryActionLedger(), { "commerce.payment.charge": approval("action-1", request("pay-1")) }, store)
    await expect(governed.createPaymentIntent(request("pay-2"))).rejects.toThrow()
    expect(calls).toBe(0)
  })

  test("cross-actor approval reuse is rejected", async () => {
    let calls = 0; const store = new FakeOperationStore(); const req = request()
    const governed = new GovernedPaymentProvider(provider(() => calls++), "attacker", new InMemoryActionLedger(), { "commerce.payment.charge": approval("action-1", req, ACTOR) }, store)
    await expect(governed.createPaymentIntent(req)).rejects.toThrow()
    expect(calls).toBe(0)
  })

  test("provider failure becomes terminal and cannot be replayed", async () => {
    let calls = 0; const store = new FakeOperationStore(); const req = request()
    const failing: PaymentProvider = { ...provider(), async createPaymentIntent() { calls++; throw new Error("declined") } }
    const governed = new GovernedPaymentProvider(failing, ACTOR, new InMemoryActionLedger(), { "commerce.payment.charge": approval("action-1", req) }, store)
    await expect(governed.createPaymentIntent(req)).rejects.toThrow("declined")
    await expect(governed.createPaymentIntent(req)).rejects.toThrow("FAILED")
    expect(calls).toBe(1)
  })

  test("payout and reconcile are denied before provider execution", async () => {
    let calls = 0; const governed = new GovernedPaymentProvider(provider(() => calls++), ACTOR, new InMemoryActionLedger(), {}, new FakeOperationStore())
    await expect(governed.createPayout({ payoutId: "payout-1" } as never)).rejects.toThrow(PaymentCapabilityDeniedError)
    await expect(governed.reconcile("2026-01-01", "2026-01-31")).rejects.toThrow(PaymentCapabilityDeniedError)
    expect(calls).toBe(0)
  })
})
