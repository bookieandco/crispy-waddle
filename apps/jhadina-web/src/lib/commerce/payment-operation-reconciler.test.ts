import { describe, expect, test } from "vitest"
import type { PaymentIntent, PaymentProvider } from "@jhadina/payment-core"
import type { PaymentOperationBinding, PaymentOperationRecord, PaymentOperationStore } from "./durable-payment-operation"
import { reconcileProcessingPaymentOperation } from "./payment-operation-reconciler"

const binding: PaymentOperationBinding = {
  provider: "stripe-sandbox",
  operationId: "charge:pay_1",
  paymentId: "pay_1",
  actorId: "actor-1",
  actionId: "intent-1",
  capability: "commerce.payment.charge",
  requestFingerprint: "fp-1",
}

function payment(status: PaymentIntent["status"] = "captured"): PaymentIntent {
  return {
    paymentId: "pay_1",
    provider: "stripe-sandbox",
    providerReference: "pi_1",
    orderId: "order-1",
    amount: { amountMinor: 1000, currency: "usd" },
    status,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:01:00.000Z",
  }
}

function storeWith(record: PaymentOperationRecord): PaymentOperationStore {
  return {
    async claim() { return { claimed: false, record } },
    async complete(_input, result) { expect(result.providerReference).toBe("pi_1") },
    async fail() { throw new Error("unexpected fail") },
  }
}

function provider(result: PaymentIntent | Error): PaymentProvider {
  return {
    name: "stripe-sandbox",
    async createPaymentIntent() { throw new Error("unexpected create") },
    async capture() { throw new Error("unexpected capture") },
    async refund() { throw new Error("unexpected refund") },
    async getPayment() { if (result instanceof Error) throw result; return result },
    async createPayout() { throw new Error("unexpected payout") },
    async reconcile() { throw new Error("unexpected reconcile") },
  }
}

describe("payment-operation-reconciler", () => {
  test("promotes processing operation to completed from authoritative provider state", async () => {
    const record: PaymentOperationRecord = { ...binding, status: "processing" }
    const result = await reconcileProcessingPaymentOperation({ store: storeWith(record), provider: provider(payment()) }, binding)
    expect(result.status).toBe("completed")
  })

  test("leaves operation processing when provider state is unknown", async () => {
    const record: PaymentOperationRecord = { ...binding, status: "processing" }
    await expect(reconcileProcessingPaymentOperation({ store: storeWith(record), provider: provider(new Error("provider unavailable")) }, binding))
      .rejects.toThrow("PAYMENT_RECONCILIATION_UNAVAILABLE")
  })

  test("never invokes create/capture/refund during reconciliation", async () => {
    const record: PaymentOperationRecord = { ...binding, status: "processing" }
    let sideEffectCalls = 0
    const raw = provider(payment())
    const safeProvider = { ...raw, async createPaymentIntent() { sideEffectCalls++ ; throw new Error("must not run") } }
    await reconcileProcessingPaymentOperation({ store: storeWith(record), provider: safeProvider }, binding)
    expect(sideEffectCalls).toBe(0)
  })
})
