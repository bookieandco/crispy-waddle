import { describe, test, expect, vi } from "vitest"
import type { PaymentIntentRequest, RefundRequest } from "@jhadina/payment-core"
import { StripeSandboxPaymentProvider, ProviderFailureError, type StripeFetch } from "./stripe-sandbox-provider"

/**
 * A fake Stripe transport that models the real API's request/response
 * shapes (idempotency headers, success/decline error payloads) closely
 * enough to be a genuine integration double, not a stub that always
 * succeeds — same discipline as every reference adapter this session,
 * carried into "actual external sandbox" territory per instruction.
 * No live credentials or network calls exist anywhere in this file.
 */
function createFakeStripeFetch(options: {
  declinePaymentIds?: Set<string>
  httpErrorOnRefund?: boolean
  networkErrorOnCreate?: boolean
  recordedRequests?: Array<{ url: string; authorization: string | null; idempotencyKey: string | null; payload: Record<string, unknown> }>
} = {}): StripeFetch {
  let paymentIntentSeq = 0
  return async (input, init) => {
    const url = typeof input === "string" ? input : input.toString()
    const headers = new Headers(init?.headers)
    options.recordedRequests?.push({
      url,
      authorization: headers.get("authorization"),
      idempotencyKey: headers.get("Idempotency-Key"),
      payload: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
    })

    if (url.includes("/v1/payment_intents") && !url.includes("/capture") && init?.method === "POST") {
      if (options.networkErrorOnCreate) throw new Error("SANDBOX_NETWORK_UNREACHABLE")
      const body = JSON.parse(String(init?.body ?? "{}")) as { metadata?: Record<string, string> }
      const idempotencyKey = headers.get("Idempotency-Key") ?? `pi_${paymentIntentSeq++}`
      const declined = options.declinePaymentIds?.has(idempotencyKey)
      if (declined) {
        return new Response(
          JSON.stringify({ error: { type: "card_error", code: "card_declined", message: "Your card was declined." } }),
          { status: 402 },
        )
      }
      return new Response(JSON.stringify({ id: `pi_${idempotencyKey}`, status: "succeeded", amount: 0, currency: "usd", metadata: body.metadata }), { status: 200 })
    }

    if (url.includes("/capture")) {
      return new Response(JSON.stringify({ id: "pi_captured", status: "succeeded", amount: 0, currency: "usd" }), { status: 200 })
    }

    if (url.includes("/v1/refunds")) {
      if (options.httpErrorOnRefund) {
        return new Response(JSON.stringify({ error: { type: "api_error", message: "Sandbox refund service unavailable." } }), { status: 500 })
      }
      return new Response(JSON.stringify({ id: "re_1", status: "succeeded", payment_intent: "pi_1" }), { status: 200 })
    }

    return new Response(JSON.stringify({ error: { type: "api_error", message: `Unhandled sandbox route: ${url}` } }), { status: 404 })
  }
}

function paymentRequest(overrides: Partial<PaymentIntentRequest> = {}): PaymentIntentRequest {
  return {
    paymentId: "pay_1",
    orderId: "order_1",
    customer: { id: "cust_1", type: "customer" },
    seller: { id: "platform", type: "platform" },
    amount: { amountMinor: 2500, currency: "USD" },
    lines: [],
    taxes: [],
    platformFees: [],
    ...overrides,
  }
}

describe("StripeSandboxPaymentProvider — sandbox-only, idempotent, fail-closed on provider errors", () => {
  test("rejects a non-https base URL", () => {
    expect(() => new StripeSandboxPaymentProvider({ secret: "sk_test_x", baseUrl: "http://api.stripe.com" })).toThrow(
      "PROVIDER_HTTPS_REQUIRED",
    )
  })

  test("a successful charge captures instantly and carries the credential only to the provider boundary", async () => {
    const recordedRequests: Array<{ url: string; authorization: string | null; idempotencyKey: string | null; payload: Record<string, unknown> }> = []
    const provider = new StripeSandboxPaymentProvider({
      secret: "sk_test_reference_do_not_log",
      fetchImpl: createFakeStripeFetch({ recordedRequests }),
    })

    const intent = await provider.createPaymentIntent(paymentRequest())

    expect(intent.status).toBe("captured")
    expect(intent.provider).toBe("stripe-sandbox")
    expect(recordedRequests).toHaveLength(1)
    expect(recordedRequests[0].authorization).toBe("Bearer sk_test_reference_do_not_log")
    expect(recordedRequests[0].idempotencyKey).toBe("pay_1")
    // The credential reached the provider request, never the returned result.
    expect(JSON.stringify(intent)).not.toContain("sk_test_reference_do_not_log")
  })

  test("a declined charge fails cleanly, is recorded as failed, and the provider was actually called", async () => {
    const provider = new StripeSandboxPaymentProvider({
      secret: "sk_test_x",
      fetchImpl: createFakeStripeFetch({ declinePaymentIds: new Set(["pay_declined"]) }),
    })

    await expect(provider.createPaymentIntent(paymentRequest({ paymentId: "pay_declined" }))).rejects.toThrow(
      ProviderFailureError,
    )

    const recorded = await provider.getPayment("pay_declined")
    expect(recorded.status).toBe("failed")
  })

  test("a network-level provider failure fails cleanly with no recorded success", async () => {
    const provider = new StripeSandboxPaymentProvider({
      secret: "sk_test_x",
      fetchImpl: createFakeStripeFetch({ networkErrorOnCreate: true }),
    })

    await expect(provider.createPaymentIntent(paymentRequest({ paymentId: "pay_unreachable" }))).rejects.toThrow(
      "SANDBOX_NETWORK_UNREACHABLE",
    )
    const recorded = await provider.getPayment("pay_unreachable")
    expect(recorded.status).toBe("failed")
  })

  test("idempotency: a repeated call with the same paymentId never reaches the provider a second time", async () => {
    const recordedRequests: Array<{ url: string; authorization: string | null; idempotencyKey: string | null; payload: Record<string, unknown> }> = []
    const fetchImpl = vi.fn(createFakeStripeFetch({ recordedRequests }))
    const provider = new StripeSandboxPaymentProvider({ secret: "sk_test_x", fetchImpl })

    const first = await provider.createPaymentIntent(paymentRequest({ paymentId: "pay_idem" }))
    const second = await provider.createPaymentIntent(paymentRequest({ paymentId: "pay_idem" }))

    expect(second).toEqual(first)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  test("capture then refund follows the real two-step shape", async () => {
    const provider = new StripeSandboxPaymentProvider({ secret: "sk_test_x", fetchImpl: createFakeStripeFetch() })
    await provider.createPaymentIntent(paymentRequest({ paymentId: "pay_refund_me" }))

    const refundRequest: RefundRequest = {
      refundId: "re_1",
      paymentId: "pay_refund_me",
      reason: "customer_request",
      requestedBy: "customer",
    }
    const refunded = await provider.refund(refundRequest)
    expect(refunded.status).toBe("refunded")
  })

  test("a provider failure on refund fails cleanly rather than silently leaving the payment captured-and-unrefunded", async () => {
    const provider = new StripeSandboxPaymentProvider({
      secret: "sk_test_x",
      fetchImpl: createFakeStripeFetch({ httpErrorOnRefund: true }),
    })
    await provider.createPaymentIntent(paymentRequest({ paymentId: "pay_refund_fails" }))

    await expect(
      provider.refund({ refundId: "re_2", paymentId: "pay_refund_fails", reason: "customer_request", requestedBy: "customer" }),
    ).rejects.toThrow(ProviderFailureError)
  })

  test("PL-7: defaults to Stripe's documented success PaymentMethod (pm_card_visa) when nothing is configured", async () => {
    const recordedRequests: Array<{ url: string; authorization: string | null; idempotencyKey: string | null; payload: Record<string, unknown> }> = []
    const provider = new StripeSandboxPaymentProvider({ secret: "sk_test_x", fetchImpl: createFakeStripeFetch({ recordedRequests }) })
    await provider.createPaymentIntent(paymentRequest())
    expect(recordedRequests[0].payload.payment_method).toBe("pm_card_visa")
  })

  test("PL-7: an instance-level defaultTestPaymentMethod is sent on every createPaymentIntent call", async () => {
    const recordedRequests: Array<{ url: string; authorization: string | null; idempotencyKey: string | null; payload: Record<string, unknown> }> = []
    const provider = new StripeSandboxPaymentProvider({
      secret: "sk_test_x",
      fetchImpl: createFakeStripeFetch({ recordedRequests }),
      defaultTestPaymentMethod: "pm_card_visa_chargeDeclined",
    })
    await provider.createPaymentIntent(paymentRequest({ paymentId: "pay_pm_default" })).catch(() => {
      // The fake transport doesn't actually decline based on payment_method — only the real
      // Stripe scenario in CI does. This test only cares about what was sent, not the outcome.
    })
    expect(recordedRequests[0].payload.payment_method).toBe("pm_card_visa_chargeDeclined")
  })

  test("PL-7: a request.metadata override takes precedence over the instance default", async () => {
    const recordedRequests: Array<{ url: string; authorization: string | null; idempotencyKey: string | null; payload: Record<string, unknown> }> = []
    const provider = new StripeSandboxPaymentProvider({
      secret: "sk_test_x",
      fetchImpl: createFakeStripeFetch({ recordedRequests }),
      defaultTestPaymentMethod: "pm_card_visa",
    })
    await provider.createPaymentIntent(paymentRequest({ paymentId: "pay_pm_override", metadata: { stripeTestPaymentMethod: "pm_card_refundFail" } }))
    expect(recordedRequests[0].payload.payment_method).toBe("pm_card_refundFail")
  })

  test("PL-7: rejects an unknown defaultTestPaymentMethod at construction time, before any provider call", () => {
    expect(
      () =>
        new StripeSandboxPaymentProvider({
          secret: "sk_test_x",
          // @ts-expect-error deliberately not on the allowlist
          defaultTestPaymentMethod: "pm_card_totally_made_up",
        }),
    ).toThrow("STRIPE_SANDBOX_UNKNOWN_TEST_PAYMENT_METHOD")
  })

  test("PL-7: rejects an unknown metadata override before any provider call", async () => {
    const recordedRequests: Array<{ url: string; authorization: string | null; idempotencyKey: string | null; payload: Record<string, unknown> }> = []
    const provider = new StripeSandboxPaymentProvider({ secret: "sk_test_x", fetchImpl: createFakeStripeFetch({ recordedRequests }) })
    await expect(
      provider.createPaymentIntent(paymentRequest({ metadata: { stripeTestPaymentMethod: "pm_card_totally_made_up" } })),
    ).rejects.toThrow("STRIPE_SANDBOX_UNKNOWN_TEST_PAYMENT_METHOD")
    expect(recordedRequests).toHaveLength(0)
  })

  test("payouts and reconciliation are structurally out of scope for this sandbox proof", async () => {
    const provider = new StripeSandboxPaymentProvider({ secret: "sk_test_x", fetchImpl: createFakeStripeFetch() })
    await expect(
      provider.createPayout({
        payoutId: "po_1",
        merchant: { id: "merchant_1", type: "merchant" },
        orderId: "order_1",
        gross: { amountMinor: 100, currency: "USD" },
        fees: { amountMinor: 0, currency: "USD" },
        taxesWithheld: { amountMinor: 0, currency: "USD" },
        refunds: { amountMinor: 0, currency: "USD" },
        net: { amountMinor: 100, currency: "USD" },
      }),
    ).rejects.toThrow("out of scope")
    await expect(provider.reconcile("2026-01-01", "2026-01-31")).rejects.toThrow("out of scope")
  })
})
