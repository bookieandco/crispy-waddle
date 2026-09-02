import type {
  PaymentIntent,
  PaymentIntentRequest,
  PaymentProvider,
  PayoutInstruction,
  ReconciliationReport,
  RefundRequest,
} from "@jhadina/payment-core"
import type { ActionLedger } from "@jhadina/action-core"

/**
 * Commerce sandbox-payment milestone (PL-3) + Finding D (Jhadina OS
 * Integration Phase 2): the explicit capability/policy boundary and
 * authorization-before-provider-call requirements, implemented as a
 * decorator around a real PaymentProvider.
 *
 * The verified actor and ledger are supplied by the governed composition
 * root. There is intentionally no in-memory ledger default: production
 * callers must make the audit sink explicit, while tests and verification
 * fixtures may inject InMemoryActionLedger themselves.
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
    private readonly ledger: ActionLedger,
  ) {
    if (!verifiedActorId) throw new Error("GovernedPaymentProvider requires a verified actor id")
    if (!ledger) throw new Error("GovernedPaymentProvider requires an explicit audit ledger")
    this.name = provider.name
  }

  list(): PaymentIntent[] {
    const wrapped = this.provider as PaymentProvider & { list?: () => PaymentIntent[] }
    return wrapped.list?.() ?? []
  }

  async createPaymentIntent(request: PaymentIntentRequest): Promise<PaymentIntent> {
    return this.governed("commerce.payment.charge", request.paymentId, () => this.provider.createPaymentIntent(request))
  }

  async capture(paymentId: string): Promise<PaymentIntent> {
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
