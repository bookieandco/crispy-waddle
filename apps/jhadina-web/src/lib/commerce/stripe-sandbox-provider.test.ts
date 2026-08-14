import { describe, test, expect, vi } from "vitest"
import type { PaymentIntentRequest, RefundRequest } from "@jhadina/payment-core"
import { StripeSandboxPaymentProvider, ProviderFailureError, toStripeFormBody, type StripeFetch } from "./stripe-sandbox-provider"

/**
 * Parses the same application/x-www-form-urlencoded wire format
 * toStripeFormBody() produces (including Stripe's bracket-notation
 * nesting, e.g. metadata[key]=value) back into a plain object — the
 * fake transport's counterpart to the real serializer, so tests
 * validate the actual wire format instead of accepting either
 * JSON or form-encoded bodies.
 */
function parseStripeFormBody(body: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (!body) return result
  for (const pair of body.split("&")) {
    const [rawKey, rawValue] = pair.split("=")
    const key = decodeURIComponent(rawKey)
    const value = decodeURIComponent(rawValue ?? "")
    const nested = key.match(/^([^[]+)\[([^\]]+)\]$/)
    if (nested) {
      const [, parentKey, childKey] = nested
      const parent = (result[parentKey] ??= {}) as Record<string, unknown>
      parent[childKey] = value
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * A fake Stripe transport that models the real API's request/response
 * shapes (idempotency headers, success/decline error payloads, and —
 * PL-7 — the real application/x-www-form-urlencoded wire format, not
 * JSON) closely enough to be a genuine integration double, not a stub
 * that always succeeds — same discipline as every reference adapter
 * this session, carried into "actual external sandbox" territory per
 * instruction. No live credentials or network calls exist anywhere in
 * this file.
 */
function createFakeStripeFetch(options: {
  declinePaymentIds?: Set<string>
  httpErrorOnRefund?: boolean
  networkErrorOnCreate?: boolean
  recordedRequests?: Array<{
    url: string
    authorization: string | null
    idempotencyKey: string | null
    contentType: string | null
    rawBody: string
    payload: Record<string, unknown>
  }>
} = {}): StripeFetch {
  let paymentIntentSeq = 0
  return async (input, init) => {
    const url = typeof input === "string" ? input : input.toString()
    const headers = new Headers(init?.headers)
    const rawBody = String(init?.body ?? "")
    options.recordedRequests?.push({
      url,
      authorization: headers.get("authorization"),
      idempotencyKey: headers.get("Idempotency-Key"),
      contentType: headers.get("content-type"),
      rawBody,
      payload: parseStripeFormBody(rawBody),
    })

    if (url.includes("/v1/payment_intents") && !url.includes("/capture") && init?.method === "POST") {
      if (options.networkErrorOnCreate) throw new Error("SANDBOX_NETWORK_UNREACHABLE")
      const body = parseStripeFormBody(rawBody) as { metadata?: Record<string, string> }
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
    const recordedRequests: Array<{ url: string; authorization: string | null; idempotencyKey: string | null; contentType: string | null; rawBody: string; payload: Record<string, unknown> }> = []
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
    const recordedRequests: Array<{ url: string; authorization: string | null; idempotencyKey: string | null; contentType: string | null; rawBody: string; payload: Record<string, unknown> }> = []
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
    const recordedRequests: Array<{ url: string; authorization: string | null; idempotencyKey: string | null; contentType: string | null; rawBody: string; payload: Record<string, unknown> }> = []
    const provider = new StripeSandboxPaymentProvider({ secret: "sk_test_x", fetchImpl: createFakeStripeFetch({ recordedRequests }) })
    await provider.createPaymentIntent(paymentRequest())
    expect(recordedRequests[0].payload.payment_method).toBe("pm_card_visa")
  })

  test("PL-7: an instance-level defaultTestPaymentMethod is sent on every createPaymentIntent call", async () => {
    const recordedRequests: Array<{ url: string; authorization: string | null; idempotencyKey: string | null; contentType: string | null; rawBody: string; payload: Record<string, unknown> }> = []
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
    const recordedRequests: Array<{ url: string; authorization: string | null; idempotencyKey: string | null; contentType: string | null; rawBody: string; payload: Record<string, unknown> }> = []
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
    const recordedRequests: Array<{ url: string; authorization: string | null; idempotencyKey: string | null; contentType: string | null; rawBody: string; payload: Record<string, unknown> }> = []
    const provider = new StripeSandboxPaymentProvider({ secret: "sk_test_x", fetchImpl: createFakeStripeFetch({ recordedRequests }) })
    await expect(
      provider.createPaymentIntent(paymentRequest({ metadata: { stripeTestPaymentMethod: "pm_card_totally_made_up" } })),
    ).rejects.toThrow("STRIPE_SANDBOX_UNKNOWN_TEST_PAYMENT_METHOD")
    expect(recordedRequests).toHaveLength(0)
  })

  test("PL-7: sends the real Stripe wire format — form-urlencoded content-type, not JSON", async () => {
    const recordedRequests: Array<{ url: string; authorization: string | null; idempotencyKey: string | null; contentType: string | null; rawBody: string; payload: Record<string, unknown> }> = []
    const provider = new StripeSandboxPaymentProvider({ secret: "sk_test_x", fetchImpl: createFakeStripeFetch({ recordedRequests }) })
    await provider.createPaymentIntent(paymentRequest())

    expect(recordedRequests[0].contentType).toBe("application/x-www-form-urlencoded")
    // The body must not be JSON — Stripe's classic REST API rejects it under this content-type.
    expect(() => JSON.parse(recordedRequests[0].rawBody)).toThrow()
  })

  test("PL-7: encodes payment_method, amount, currency, and confirm as flat form fields", async () => {
    const recordedRequests: Array<{ url: string; authorization: string | null; idempotencyKey: string | null; contentType: string | null; rawBody: string; payload: Record<string, unknown> }> = []
    const provider = new StripeSandboxPaymentProvider({ secret: "sk_test_x", fetchImpl: createFakeStripeFetch({ recordedRequests }) })
    await provider.createPaymentIntent(paymentRequest({ amount: { amountMinor: 2500, currency: "USD" } }))

    const { rawBody, payload } = recordedRequests[0]
    expect(rawBody).toContain("payment_method=pm_card_visa")
    expect(rawBody).toContain("amount=2500")
    expect(rawBody).toContain("currency=usd")
    expect(rawBody).toContain("confirm=true")
    expect(payload.payment_method).toBe("pm_card_visa")
    expect(payload.amount).toBe("2500")
    expect(payload.currency).toBe("usd")
    expect(payload.confirm).toBe("true")
  })

  test("PL-7: encodes metadata with Stripe's bracket notation, percent-encoded on the wire", async () => {
    const recordedRequests: Array<{ url: string; authorization: string | null; idempotencyKey: string | null; contentType: string | null; rawBody: string; payload: Record<string, unknown> }> = []
    const provider = new StripeSandboxPaymentProvider({ secret: "sk_test_x", fetchImpl: createFakeStripeFetch({ recordedRequests }) })
    await provider.createPaymentIntent(paymentRequest({ metadata: { idempotencyKey: "checkout_123:payment" } }))

    const { rawBody, payload } = recordedRequests[0]
    // The literal brackets are percent-encoded on the wire (%5B / %5D), matching what
    // Stripe's own client libraries produce — not sent as literal [ ] characters.
    expect(rawBody).toContain("metadata%5BidempotencyKey%5D=checkout_123%3Apayment")
    expect(rawBody).not.toContain("metadata[idempotencyKey]")
    expect(payload.metadata).toEqual({ idempotencyKey: "checkout_123:payment" })
  })

  test("PL-7: URL-encodes special characters in metadata values rather than sending them raw", async () => {
    const recordedRequests: Array<{ url: string; authorization: string | null; idempotencyKey: string | null; contentType: string | null; rawBody: string; payload: Record<string, unknown> }> = []
    const provider = new StripeSandboxPaymentProvider({ secret: "sk_test_x", fetchImpl: createFakeStripeFetch({ recordedRequests }) })
    await provider.createPaymentIntent(paymentRequest({ metadata: { note: "a b&c=d/e" } }))

    const { rawBody, payload } = recordedRequests[0]
    expect(rawBody).not.toContain("a b&c=d/e")
    expect(rawBody).toContain(encodeURIComponent("a b&c=d/e"))
    // Round-trips back to the original, unencoded value.
    expect(payload.metadata).toEqual({ note: "a b&c=d/e" })
  })

  test("PL-7: toStripeFormBody omits an empty metadata object rather than sending an empty key", () => {
    expect(toStripeFormBody({ amount: 100, currency: "usd", confirm: true, payment_method: "pm_card_visa", metadata: {} })).toBe(
      "amount=100&currency=usd&confirm=true&payment_method=pm_card_visa",
    )
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
