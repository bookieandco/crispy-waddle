import type {
  PaymentIntent,
  PaymentIntentRequest,
  PaymentProvider,
  PayoutInstruction,
  ReconciliationReport,
  RefundRequest,
} from "@jhadina/payment-core"
import { InMemoryActionLedger } from "@jhadina/action-core"

/**
 * Commerce sandbox-payment milestone (PL-3) + Finding D (Jhadina OS
 * Integration Phase 2): the "explicit capability/policy boundary" and
 * "authorization before provider call" requirements, implemented as a
 * decorator around a real PaymentProvider — mirroring money-core's
 * capabilities.ts registry shape (a fixed set of named capabilities,
 * each explicitly allowed or not) rather than inventing a different
 * policy shape. Composes transparently with SP-2's existing
 * createPaymentGatewayFromProvider bridge — GovernedPaymentProvider IS
 * a PaymentProvider, so nothing downstream changes.
 *
 * payment-core's PaymentProvider interface has no per-call actor/
 * context parameter (unlike money-core's BankAdapter, whose methods
 * take a MoneyAdapterContext) — capture() in particular carries no
 * actor at all. The capability check therefore lives at this
 * composition-boundary layer instead of inside each method, the same
 * place the check would have to live even if payment-core's interface
 * changes down the line; this proof doesn't change that interface.
 *
 * Finding D correction: the actor audited against every call is now a
 * verified identity supplied by the caller (governed-commerce-intent.ts,
 * after ActionIdentityVerifier + policy + approval all pass) — never
 * derived from request.customer.id / instruction.merchant.id /
 * request.requestedBy, which are domain data a caller controls, not
 * proof of identity. One GovernedPaymentProvider instance now belongs
 * to exactly one verified actor for its whole lifetime.
 *
 * The ledger is now an optional constructor param (defaults to a fresh
 * InMemoryActionLedger for standalone use) rather than always
 * constructing its own — governed-commerce-intent.ts passes one shared
 * ledger so checkout-level and payment-level events land in the same
 * inspectable trail. Still in-memory, not the durable SupabaseAuditLedger
 * PL-2 built for Growth: that ledger's RPCs require a real, server-verified
 * auth.uid() tied to an actual signed-in session; nothing about this
 * milestone changes that. Durability for Commerce is a deliberate
 * follow-up, not this one.
 */

export type CommercePaymentCapability =
  | "commerce.payment.charge"
  | "commerce.payment.refund"
  | "commerce.payment.payout"
  | "commerce.payment.reconcile"

const CAPABILITY_ALLOWED: Record<CommercePaymentCapability, boolean> = {
  "commerce.payment.charge": true,
  "commerce.payment.refund": true,
  "commerce.payment.payout": false,
  "commerce.payment.reconcile": false,
}

export class PaymentCapabilityDeniedError extends Error {
  constructor(public readonly capability: CommercePaymentCapability) {
    super(`PAYMENT_CAPABILITY_DENIED:${capability}`)
    this.name = "PaymentCapabilityDeniedError"
  }
}

export class GovernedPaymentProvider implements PaymentProvider {
  readonly name: string

  constructor(
    private readonly provider: PaymentProvider,
    private readonly verifiedActorId: string,
    private readonly ledger: InMemoryActionLedger = new InMemoryActionLedger(),
  ) {
    if (!verifiedActorId) throw new Error("GovernedPaymentProvider requires a verified actor id")
    this.name = provider.name
  }

  /** Delegates to the wrapped provider's own inspection helper, if it has one (the sandbox provider does). */
  list(): PaymentIntent[] {
    const wrapped = this.provider as PaymentProvider & { list?: () => PaymentIntent[] }
    return wrapped.list?.() ?? []
  }

  async createPaymentIntent(request: PaymentIntentRequest): Promise<PaymentIntent> {
    return this.governed("commerce.payment.charge", request.paymentId, () => this.provider.createPaymentIntent(request))
  }

  async capture(paymentId: string): Promise<PaymentIntent> {
    // capture() is the second half of the same charge capability
    // already authorized when createPaymentIntent ran, not a separate grant.
    return this.governed("commerce.payment.charge", paymentId, () => this.provider.capture(paymentId))
  }

  async refund(request: RefundRequest): Promise<PaymentIntent> {
    return this.governed("commerce.payment.refund", request.refundId, () => this.provider.refund(request))
  }

  async getPayment(paymentId: string): Promise<PaymentIntent> {
    return this.provider.getPayment(paymentId)
  }

  async createPayout(instruction: PayoutInstruction): Promise<{ payoutId: string; providerReference?: string }> {
    return this.governed("commerce.payment.payout", instruction.payoutId, () => this.provider.createPayout(instruction))
  }

  async reconcile(periodStart: string, periodEnd: string): Promise<ReconciliationReport> {
    return this.governed("commerce.payment.reconcile", `${periodStart}:${periodEnd}`, () =>
      this.provider.reconcile(periodStart, periodEnd),
    )
  }

  private async governed<T>(capability: CommercePaymentCapability, actionId: string, run: () => Promise<T>): Promise<T> {
    const eventId = `${actionId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
    const actorId = this.verifiedActorId
    const now = () => new Date().toISOString()

    if (!CAPABILITY_ALLOWED[capability]) {
      await this.ledger.append({
        id: `${eventId}:denied`,
        actionId,
        userId: actorId,
        type: capability,
        status: "denied",
        timestamp: now(),
      })
      throw new PaymentCapabilityDeniedError(capability)
    }

    await this.ledger.append({
      id: `${eventId}:started`,
      actionId,
      userId: actorId,
      type: capability,
      status: "started",
      timestamp: now(),
    })

    try {
      const result = await run()
      await this.ledger.append({
        id: `${eventId}:completed`,
        actionId,
        userId: actorId,
        type: capability,
        status: "completed",
        timestamp: now(),
      })
      return result
    } catch (error) {
      await this.ledger.append({
        id: `${eventId}:failed`,
        actionId,
        userId: actorId,
        type: capability,
        status: "failed",
        timestamp: now(),
        metadata: { reason: error instanceof Error ? error.message : String(error) },
      })
      throw error
    }
  }
}
