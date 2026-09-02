import {
  SecurityCoreActionPolicy,
  createApprovalRequestService,
  createApprovalReceiptVerifier,
  type ActionLedger,
  type ActionPolicy,
  type ActionPolicyDecision,
  type ActionRequest,
  type ApprovalReceiptStore,
} from "@jhadina/action-core"
import { JhadinaSecurityCore } from "@jhadina/security-core"
import type { PaymentProvider } from "@jhadina/payment-core"
import type { ActionRequestIdentity, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { runCommerceIntentLifecycle, type CommerceIntent, type CommerceLifecycleOptions, type CommerceLifecycleResult } from "./commerce-intent"
import { GovernedPaymentProvider, type GovernedPaymentApproval } from "./governed-payment-provider"
import { COMMERCE_SECURITY_POLICY, COMMERCE_CHECKOUT_CAPABILITY, COMMERCE_PAYMENT_CHARGE_CAPABILITY, COMMERCE_PAYMENT_REFUND_CAPABILITY } from "./commerce-security-policy"

export interface GovernedCommerceIntentDeps {
  identityVerifier: JhadinaIdentityVerifier
  ledger: ActionLedger
  approvalStore: ApprovalReceiptStore
  paymentProvider: PaymentProvider
  policy?: ActionPolicy<CommerceCapabilityAction>
}

export interface GovernedCommerceIntentResult {
  result: CommerceLifecycleResult
  verifiedUserId: string
  chargeApprovalReceiptId?: string
  refundApprovalReceiptId?: string
}

type CommerceCapabilityAction = { capability: string }

type ApprovalBinding = GovernedPaymentApproval<CommerceCapabilityAction>

export async function runCommerceIntentGoverned(
  deps: GovernedCommerceIntentDeps,
  claimedUserId: string,
  intent: CommerceIntent,
  options: CommerceLifecycleOptions = {},
): Promise<GovernedCommerceIntentResult> {
  const now = () => new Date().toISOString()
  const intentKey = `commerce-intent:${claimedUserId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
  const identity: ActionRequestIdentity = await deps.identityVerifier.verify({ userId: claimedUserId })

  const policy: ActionPolicy<CommerceCapabilityAction> =
    deps.policy ?? new SecurityCoreActionPolicy<CommerceCapabilityAction>(new JhadinaSecurityCore(COMMERCE_SECURITY_POLICY), "commerce")

  async function evaluate(capability: string): Promise<ActionPolicyDecision> {
    return policy.evaluate({
      id: `${intentKey}:${capability}`,
      userId: identity.userId,
      type: capability,
      action: { capability },
      requestedAt: now(),
    })
  }

  async function requestAndApprove(capability: string): Promise<{ id: string; binding: ApprovalBinding }> {
    const fingerprint = () => `commerce:${capability}:${intentKey}`
    const approvalService = createApprovalRequestService<CommerceCapabilityAction>(deps.approvalStore, fingerprint)
    const verifier = createApprovalReceiptVerifier<CommerceCapabilityAction>(deps.approvalStore, fingerprint)
    const request: ActionRequest<CommerceCapabilityAction> = {
      id: `${intentKey}:${capability}`,
      userId: identity.userId,
      type: capability,
      action: { capability },
      requestedAt: now(),
    }
    const pending = await approvalService.requestApproval(request)
    const approved = await approvalService.approve(pending.id, identity.userId)
    await deps.ledger.append({
      id: `${intentKey}:${capability}-approved`,
      actionId: intentKey,
      userId: identity.userId,
      type: capability,
      status: "completed",
      timestamp: now(),
      metadata: { stage: "approval", approvalReceiptId: approved.id },
    })
    return {
      id: approved.id,
      binding: { receiptId: approved.id, actionId: request.id, capability: capability as ApprovalBinding["capability"], verifier },
    }
  }

  async function authorizeCapability(capability: string, allowApproval: boolean): Promise<{ id: string; binding: ApprovalBinding } | undefined> {
    const decision = await evaluate(capability)
    if (decision === "deny") {
      await deps.ledger.append({ id: `${intentKey}:${capability}-denied`, actionId: intentKey, userId: identity.userId, type: capability, status: "denied", timestamp: now() })
      throw new Error(`Action denied by policy: ${capability}`)
    }
    if (decision === "approval_required") {
      if (!allowApproval) {
        await deps.ledger.append({ id: `${intentKey}:${capability}-approval-required`, actionId: intentKey, userId: identity.userId, type: capability, status: "approval_required", timestamp: now() })
        throw new Error(`Approval required: ${capability}`)
      }
      return requestAndApprove(capability)
    }
    return undefined
  }

  await deps.ledger.append({ id: `${intentKey}:checkout-started`, actionId: intentKey, userId: identity.userId, type: COMMERCE_CHECKOUT_CAPABILITY, status: "started", timestamp: now() })
  await authorizeCapability(COMMERCE_CHECKOUT_CAPABILITY, false)

  const chargeApproval = await authorizeCapability(COMMERCE_PAYMENT_CHARGE_CAPABILITY, true)
  const refundApproval = await authorizeCapability(COMMERCE_PAYMENT_REFUND_CAPABILITY, true)

  const approvals: Partial<Record<ApprovalBinding["capability"], ApprovalBinding>> = {}
  if (chargeApproval) approvals[COMMERCE_PAYMENT_CHARGE_CAPABILITY] = chargeApproval.binding
  if (refundApproval) approvals[COMMERCE_PAYMENT_REFUND_CAPABILITY] = refundApproval.binding

  const governedProvider = new GovernedPaymentProvider(deps.paymentProvider, identity.userId, deps.ledger, approvals)

  let result: CommerceLifecycleResult
  try {
    result = await runCommerceIntentLifecycle(intent, { ...options, paymentProvider: governedProvider })
  } catch (error) {
    await deps.ledger.append({
      id: `${intentKey}:checkout-failed`, actionId: intentKey, userId: identity.userId,
      type: COMMERCE_CHECKOUT_CAPABILITY, status: "failed", timestamp: now(),
      metadata: { reason: error instanceof Error ? error.message : String(error) },
    })
    throw error
  }

  await deps.ledger.append({
    id: `${intentKey}:checkout-${result.session.status === "completed" ? "completed" : "failed"}`,
    actionId: intentKey,
    userId: identity.userId,
    type: COMMERCE_CHECKOUT_CAPABILITY,
    status: result.session.status === "completed" ? "completed" : "failed",
    timestamp: now(),
    metadata: { sessionStatus: result.session.status },
  })

  return {
    result,
    verifiedUserId: identity.userId,
    chargeApprovalReceiptId: chargeApproval?.id,
    refundApprovalReceiptId: refundApproval?.id,
  }
}
