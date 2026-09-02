import type {
  PaymentIntent,
  PaymentIntentRequest,
  PaymentProvider,
  PayoutInstruction,
  ReconciliationReport,
  RefundRequest,
} from "@jhadina/payment-core"
import type { ActionLedger, ApprovalReceiptVerifier, ApprovalRequestLike } from "@jhadina/action-core"

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

export class PaymentApprovalRequiredError extends Error {
  constructor(public readonly capability: CommercePaymentCapability) {
    super(`PAYMENT_APPROVAL_REQUIRED:${capability}`)
    this.name = "PaymentApprovalRequiredError"
  }
}

export interface GovernedPaymentApproval<TAction = unknown> {
  receiptId: string
  actionId: string
  capability: CommercePaymentCapability
  verifier: ApprovalReceiptVerifier<TAction>
}

/**
 * Final payment-provider boundary. Approval is consumed here, immediately
 * before the irreversible provider call. Policy evaluation and checkout
 * orchestration must never consume the receipt first.
 */
export class GovernedPaymentProvider implements PaymentProvider {
  readonly name: string

  constructor(
    private readonly provider: PaymentProvider,
    private readonly verifiedActorId: string,
    private readonly ledger: ActionLedger,
    private readonly approvals: Partial<Record<CommercePaymentCapability, GovernedPaymentApproval>> = {},
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
    return this.governed("commerce.payment.charge", request.paymentId, request, () => this.provider.createPaymentIntent(request))
  }

  async capture(paymentId: string): Promise<PaymentIntent> {
    return this.governed("commerce.payment.charge", paymentId, { paymentId }, () => this.provider.capture(paymentId))
  }

  async refund(request: RefundRequest): Promise<PaymentIntent> {
    return this.governed("commerce.payment.refund", request.refundId, request, () => this.provider.refund(request))
  }

  async getPayment(paymentId: string): Promise<PaymentIntent> {
    return this.provider.getPayment(paymentId)
  }

  async createPayout(instruction: PayoutInstruction): Promise<{ payoutId: string; providerReference?: string }> {
    return this.governed("commerce.payment.payout", instruction.payoutId, instruction, () => this.provider.createPayout(instruction))
  }

  async reconcile(periodStart: string, periodEnd: string): Promise<ReconciliationReport> {
    return this.governed("commerce.payment.reconcile", `${periodStart}:${periodEnd}`, { periodStart, periodEnd }, () =>
      this.provider.reconcile(periodStart, periodEnd),
    )
  }

  private async governed<T>(
    capability: CommercePaymentCapability,
    providerActionId: string,
    action: unknown,
    run: () => Promise<T>,
  ): Promise<T> {
    const approval = this.approvals[capability]
    const eventId = `${providerActionId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
    const now = () => new Date().toISOString()

    if (!CAPABILITY_ALLOWED[capability]) {
      await this.ledger.append({
        id: `${eventId}:denied`, actionId: providerActionId, userId: this.verifiedActorId,
        type: capability, status: "denied", timestamp: now(),
      })
      throw new PaymentCapabilityDeniedError(capability)
    }

    if (!approval) {
      await this.ledger.append({
        id: `${eventId}:approval-required`, actionId: providerActionId, userId: this.verifiedActorId,
        type: capability, status: "approval_required", timestamp: now(),
        metadata: { reason: "missing_bound_approval" },
      })
      throw new PaymentApprovalRequiredError(capability)
    }

    const approvalRequest: ApprovalRequestLike = {
      id: approval.actionId,
      userId: this.verifiedActorId,
      type: capability,
      action,
      requestedAt: now(),
    }

    // Durable consume is the final authorization step. The approved action id
    // is preserved rather than replaced with providerActionId, so a receipt
    // approved for one governed intent cannot authorize another intent.
    const valid = await approval.verifier.verifyAndConsume(approval.receiptId, approvalRequest)
    if (!valid) {
      await this.ledger.append({
        id: `${eventId}:denied`, actionId: providerActionId, userId: this.verifiedActorId,
        type: capability, status: "denied", timestamp: now(),
        metadata: { reason: "invalid_or_expired_or_replayed_approval" },
      })
      throw new Error(`Payment approval invalid, expired, or already consumed: ${capability}`)
    }

    await this.ledger.append({
      id: `${eventId}:started`, actionId: providerActionId, userId: this.verifiedActorId,
      type: capability, status: "started", timestamp: now(),
      metadata: { approvalReceiptId: approval.receiptId, governedActionId: approval.actionId },
    })

    try {
      const result = await run()
      await this.ledger.append({
        id: `${eventId}:completed`, actionId: providerActionId, userId: this.verifiedActorId,
        type: capability, status: "completed", timestamp: now(),
        metadata: { approvalReceiptId: approval.receiptId, governedActionId: approval.actionId },
      })
      return result
    } catch (error) {
      await this.ledger.append({
        id: `${eventId}:failed`, actionId: providerActionId, userId: this.verifiedActorId,
        type: capability, status: "failed", timestamp: now(),
        metadata: { reason: error instanceof Error ? error.message : String(error), approvalReceiptId: approval.receiptId },
      })
      throw error
    }
  }
}
