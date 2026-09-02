import type {
  PaymentIntent,
  PaymentIntentRequest,
  PaymentProvider,
  PayoutInstruction,
  ReconciliationReport,
  RefundRequest,
} from "@jhadina/payment-core"
import type { ActionLedger, ApprovalReceiptVerifier, ApprovalRequestLike } from "@jhadina/action-core"
import {
  assertPaymentOperationBinding,
  requireStoredPaymentIntent,
  type PaymentOperationBinding,
  type PaymentOperationStore,
} from "./durable-payment-operation"

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

export class PaymentOperationInProgressError extends Error {
  constructor(public readonly operationId: string) {
    super(`PAYMENT_OPERATION_IN_PROGRESS:${operationId}`)
    this.name = "PaymentOperationInProgressError"
  }
}

export interface GovernedPaymentApproval<TAction = unknown> {
  receiptId: string
  actionId: string
  capability: CommercePaymentCapability
  verifier: ApprovalReceiptVerifier<TAction>
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonicalize(child)]),
    )
  }
  return value
}

function operationFingerprint(capability: CommercePaymentCapability, action: unknown): string {
  return JSON.stringify(canonicalize({ capability, action }))
}

/**
 * Final payment-provider boundary. Approval is consumed here, immediately
 * before the irreversible provider call. Durable operation claim happens
 * before approval consumption so concurrent/replayed execution can never
 * create a second external side effect.
 */
export class GovernedPaymentProvider implements PaymentProvider {
  readonly name: string

  constructor(
    private readonly provider: PaymentProvider,
    private readonly verifiedActorId: string,
    private readonly ledger: ActionLedger,
    private readonly approvals: Partial<Record<CommercePaymentCapability, GovernedPaymentApproval>> = {},
    private readonly paymentOperations?: PaymentOperationStore,
  ) {
    if (!verifiedActorId) throw new Error("GovernedPaymentProvider requires a verified actor id")
    if (!ledger) throw new Error("GovernedPaymentProvider requires an explicit audit ledger")
  }

  list(): PaymentIntent[] {
    const wrapped = this.provider as PaymentProvider & { list?: () => PaymentIntent[] }
    return wrapped.list?.() ?? []
  }

  async createPaymentIntent(request: PaymentIntentRequest): Promise<PaymentIntent> {
    return this.governed("commerce.payment.charge", `charge:${request.paymentId}`, request.paymentId, request, () => this.provider.createPaymentIntent(request))
  }

  async capture(paymentId: string): Promise<PaymentIntent> {
    return this.governed("commerce.payment.charge", `capture:${paymentId}`, paymentId, { paymentId }, () => this.provider.capture(paymentId))
  }

  async refund(request: RefundRequest): Promise<PaymentIntent> {
    return this.governed("commerce.payment.refund", `refund:${request.refundId}`, request.paymentId, request, () => this.provider.refund(request))
  }

  async getPayment(paymentId: string): Promise<PaymentIntent> {
    return this.provider.getPayment(paymentId)
  }

  async createPayout(instruction: PayoutInstruction): Promise<{ payoutId: string; providerReference?: string }> {
    return this.governed("commerce.payment.payout", `payout:${instruction.payoutId}`, instruction.payoutId, instruction, () => this.provider.createPayout(instruction))
  }

  async reconcile(periodStart: string, periodEnd: string): Promise<ReconciliationReport> {
    return this.governed("commerce.payment.reconcile", `reconcile:${periodStart}:${periodEnd}`, `${periodStart}:${periodEnd}`, { periodStart, periodEnd }, () =>
      this.provider.reconcile(periodStart, periodEnd),
    )
  }

  private async governed<T>(
    capability: CommercePaymentCapability,
    providerActionId: string,
    paymentId: string,
    action: unknown,
    run: () => Promise<T>,
  ): Promise<T> {
    const approval = this.approvals[capability]
    const eventId = `${providerActionId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
    const now = () => new Date().toISOString()

    if (!CAPABILITY_ALLOWED[capability]) {
      await this.ledger.append({ id: `${eventId}:denied`, actionId: providerActionId, userId: this.verifiedActorId, type: capability, status: "denied", timestamp: now() })
      throw new PaymentCapabilityDeniedError(capability)
    }

    if (!approval) {
      await this.ledger.append({ id: `${eventId}:approval-required`, actionId: providerActionId, userId: this.verifiedActorId, type: capability, status: "approval_required", timestamp: now(), metadata: { reason: "missing_bound_approval" } })
      throw new PaymentApprovalRequiredError(capability)
    }

    if (!this.paymentOperations) throw new Error("COMMERCE_PAYMENT_OPERATION_STORE_REQUIRED")

    const binding: PaymentOperationBinding = {
      provider: this.name,
      operationId: providerActionId,
      paymentId,
      actorId: this.verifiedActorId,
      actionId: approval.actionId,
      capability,
      requestFingerprint: operationFingerprint(capability, action),
    }

    const claim = await this.paymentOperations.claim(binding)
    if (!claim.claimed) {
      assertPaymentOperationBinding(claim.record, binding)
      if (claim.record.status === "completed") return requireStoredPaymentIntent(claim.record) as T
      if (claim.record.status === "failed") throw new Error(`COMMERCE_PAYMENT_OPERATION_FAILED:${claim.record.resultStatus ?? "unknown"}`)
      throw new PaymentOperationInProgressError(binding.operationId)
    }

    const approvalRequest: ApprovalRequestLike = {
      id: approval.actionId,
      userId: this.verifiedActorId,
      type: capability,
      action,
      requestedAt: now(),
    }

    const valid = await approval.verifier.verifyAndConsume(approval.receiptId, approvalRequest)
    if (!valid) {
      await this.paymentOperations.fail(binding, { resultStatus: "approval_invalid", resultPayload: { reason: "invalid_or_expired_or_replayed_approval" } })
      await this.ledger.append({ id: `${eventId}:denied`, actionId: providerActionId, userId: this.verifiedActorId, type: capability, status: "denied", timestamp: now(), metadata: { reason: "invalid_or_expired_or_replayed_approval" } })
      throw new Error(`Payment approval invalid, expired, or already consumed: ${capability}`)
    }

    await this.ledger.append({ id: `${eventId}:started`, actionId: providerActionId, userId: this.verifiedActorId, type: capability, status: "started", timestamp: now(), metadata: { approvalReceiptId: approval.receiptId, governedActionId: approval.actionId } })

    let result: T
    try {
      result = await run()
    } catch (error) {
      await this.paymentOperations.fail(binding, { resultStatus: "provider_failed", resultPayload: { error: error instanceof Error ? error.message : String(error) } })
      await this.ledger.append({ id: `${eventId}:failed`, actionId: providerActionId, userId: this.verifiedActorId, type: capability, status: "failed", timestamp: now(), metadata: { reason: error instanceof Error ? error.message : String(error), approvalReceiptId: approval.receiptId } })
      throw error
    }

    try {
      const terminal = result as unknown
      const providerReference = (terminal as { providerReference?: string } | null)?.providerReference ?? providerActionId
      const resultStatus = (terminal as { status?: string } | null)?.status ?? "completed"
      await this.paymentOperations.complete(binding, { providerReference, resultStatus, resultPayload: terminal })
    } catch (error) {
      // The provider already ran. Do not mark the operation failed or retry the
      // provider: leaving it processing forces reconciliation instead of risking
      // a second external side effect.
      await this.ledger.append({ id: `${eventId}:durability-failed`, actionId: providerActionId, userId: this.verifiedActorId, type: capability, status: "failed", timestamp: now(), metadata: { reason: error instanceof Error ? error.message : String(error), recovery: "reconcile_processing_operation" } })
      throw new Error("COMMERCE_PAYMENT_OPERATION_RESULT_PERSIST_FAILED")
    }

    await this.ledger.append({ id: `${eventId}:completed`, actionId: providerActionId, userId: this.verifiedActorId, type: capability, status: "completed", timestamp: now(), metadata: { approvalReceiptId: approval.receiptId, governedActionId: approval.actionId } })
    return result
  }
}
