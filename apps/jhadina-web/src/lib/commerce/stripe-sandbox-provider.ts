import type { PaymentIntent, PaymentIntentRequest, PaymentProvider, RefundRequest } from "@jhadina/payment-core"
import { createInMemorySandboxIdempotencyStore, type SandboxIdempotencyStore } from "./sandbox-idempotency"

/**
 * Commerce sandbox-payment milestone: implements payment-core's
 * PaymentProvider contract (unchanged — no new payment architecture)
 * against Stripe's real API shape, using an injectable fetch transport
 * exactly like money-core's ReadOnlyHttpBankAdapter/createReferenceFetch
 * already established. No live credentials exist in this environment
 * yet (see docs/JHADINA_WORK_QUEUE.md) — this proof injects a fake
 * transport that faithfully models Stripe's real request/response
 * shapes (idempotency headers, success/decline/error payloads), so the
 * adapter's own logic is fully proven; wiring in a real fetch + real
 * sk_test_ key later is the one-line change this whole session's
 * adapter pattern is built around.
 *
 * Payouts and reconciliation are explicitly out of scope for this
 * proof (createPayout/reconcile both reject) — not needed to prove
 * checkout -> payment -> fulfillment -> audit, matching the
 * "smallest vertical slice" discipline from every prior proof.
 */

export type StripeFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type StripeSandboxProviderOptions = {
  secret: string;
  baseUrl?: string;
  fetchImpl?: StripeFetch;
  timeoutMs?: number;
  idempotencyStore?: SandboxIdempotencyStore;
};

type StripeErrorBody = { error: { type: string; code?: string; message: string } };
type StripePaymentIntentBody = { id: string; status: string; amount: number; currency: string };
type StripeRefundBody = { id: string; status: string; payment_intent: string };

export class ProviderFailureError extends Error {
  constructor(
    message: string,
    public readonly stripeType?: string,
    public readonly stripeCode?: string,
  ) {
    super(message)
    this.name = "ProviderFailureError"
  }
}

export class StripeSandboxPaymentProvider implements PaymentProvider {
  readonly name = "stripe-sandbox"
  private readonly fetchImpl: StripeFetch
  private readonly idempotency: SandboxIdempotencyStore
  private readonly intents = new Map<string, PaymentIntent>()

  constructor(private readonly options: StripeSandboxProviderOptions) {
    if (!options.baseUrl?.startsWith("https://") && options.baseUrl !== undefined) {
      throw new Error("PROVIDER_HTTPS_REQUIRED")
    }
    this.fetchImpl = options.fetchImpl ?? fetch
    this.idempotency = options.idempotencyStore ?? createInMemorySandboxIdempotencyStore()
  }

  async createPaymentIntent(request: PaymentIntentRequest): Promise<PaymentIntent> {
    const claim = await this.idempotency.claim(request.paymentId)

    if (!claim.claimed) {
      // Another call already claimed this paymentId. The existing intent
      // (success or failure, already recorded) is the authoritative
      // result — Stripe is never called a second time for the same
      // paymentId, whether or not the first attempt has finished.
      const existing = this.intents.get(request.paymentId)
      if (existing) return existing
      const result = await this.idempotency.getResult(request.paymentId)
      throw new Error(`STRIPE_IDEMPOTENCY_RESULT_MISSING:${result?.providerReference ?? request.paymentId}`)
    }

    try {
      const body = await this.request<StripePaymentIntentBody>("/v1/payment_intents", {
        method: "POST",
        idempotencyKey: request.paymentId,
        payload: {
          amount: request.amount.amountMinor,
          currency: request.amount.currency.toLowerCase(),
          confirm: true,
          metadata: request.metadata ?? {},
        },
      })

      const now = new Date().toISOString()
      const intent: PaymentIntent = {
        paymentId: request.paymentId,
        provider: this.name,
        providerReference: body.id,
        orderId: request.orderId,
        amount: request.amount,
        status: body.status === "succeeded" ? "captured" : body.status === "requires_capture" ? "authorized" : "failed",
        rail: "card",
        createdAt: now,
        updatedAt: now,
      }
      this.intents.set(request.paymentId, intent)
      await this.idempotency.complete(request.paymentId, { providerReference: body.id, status: intent.status })
      return intent
    } catch (error) {
      const now = new Date().toISOString()
      const failed: PaymentIntent = {
        paymentId: request.paymentId,
        provider: this.name,
        orderId: request.orderId,
        amount: request.amount,
        status: "failed",
        rail: "card",
        createdAt: now,
        updatedAt: now,
      }
      this.intents.set(request.paymentId, failed)
      await this.idempotency.complete(request.paymentId, { providerReference: "", status: "failed" })
      throw error
    }
  }

  async capture(paymentId: string): Promise<PaymentIntent> {
    const intent = this.require(paymentId)
    if (intent.status !== "authorized") return intent
    const body = await this.request<StripePaymentIntentBody>(`/v1/payment_intents/${intent.providerReference}/capture`, {
      method: "POST",
    })
    const captured: PaymentIntent = { ...intent, status: body.status === "succeeded" ? "captured" : "failed", updatedAt: new Date().toISOString() }
    this.intents.set(paymentId, captured)
    return captured
  }

  async refund(request: RefundRequest): Promise<PaymentIntent> {
    const intent = this.require(request.paymentId)
    if (intent.status !== "captured" && intent.status !== "partially_refunded") {
      throw new Error(`Cannot refund a payment in status ${intent.status}`)
    }

    const body = await this.request<StripeRefundBody>("/v1/refunds", {
      method: "POST",
      idempotencyKey: request.refundId,
      payload: { payment_intent: intent.providerReference, reason: mapRefundReason(request.reason) },
    })

    const refunded: PaymentIntent = {
      ...intent,
      status: body.status === "succeeded" ? "refunded" : intent.status,
      updatedAt: new Date().toISOString(),
    }
    this.intents.set(request.paymentId, refunded)
    return refunded
  }

  async getPayment(paymentId: string): Promise<PaymentIntent> {
    return this.require(paymentId)
  }

  async createPayout(_instruction: Parameters<PaymentProvider["createPayout"]>[0]): Promise<{ payoutId: string; providerReference?: string }> {
    throw new Error("Payouts are out of scope for this sandbox proof")
  }

  async reconcile(_periodStart: string, _periodEnd: string): Promise<never> {
    throw new Error("Reconciliation is out of scope for this sandbox proof")
  }

  private require(paymentId: string): PaymentIntent {
    const intent = this.intents.get(paymentId)
    if (!intent) throw new Error(`Unknown payment intent: ${paymentId}`)
    return intent
  }

  /** Test/inspection helper, mirroring InMemoryPaymentProvider's own — every intent attempted, success or failure. */
  list(): PaymentIntent[] {
    return [...this.intents.values()]
  }

  private async request<T>(
    path: string,
    init: { method: "POST"; idempotencyKey?: string; payload?: Record<string, unknown> },
  ): Promise<T> {
    const baseUrl = this.options.baseUrl ?? "https://api.stripe.com"
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 10_000)

    try {
      const response = await this.fetchImpl(new URL(path, baseUrl), {
        method: init.method,
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
          authorization: `Bearer ${this.options.secret}`,
          ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
        },
        body: init.payload ? JSON.stringify(init.payload) : undefined,
        signal: controller.signal,
      })

      const json = (await response.json()) as T | StripeErrorBody
      if (!response.ok) {
        const errorBody = json as StripeErrorBody
        throw new ProviderFailureError(
          errorBody.error?.message ?? `STRIPE_HTTP_${response.status}`,
          errorBody.error?.type,
          errorBody.error?.code,
        )
      }
      return json as T
    } finally {
      clearTimeout(timeout)
    }
  }
}

function mapRefundReason(reason: RefundRequest["reason"]): "duplicate" | "fraudulent" | "requested_by_customer" {
  if (reason === "customer_request") return "requested_by_customer"
  if (reason === "compliance") return "fraudulent"
  return "requested_by_customer"
}
