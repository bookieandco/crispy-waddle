import {
  InMemoryActionLedger,
  SecurityCoreActionPolicy,
  createApprovalRequestService,
  createApprovalReceiptVerifier,
  type ActionPolicy,
  type ActionPolicyDecision,
  type ActionRequest,
  type ApprovalReceiptStore,
} from "@jhadina/action-core"
import { JhadinaSecurityCore } from "@jhadina/security-core"
import type { PaymentProvider } from "@jhadina/payment-core"
import type { ActionRequestIdentity, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import {
  runCommerceIntentLifecycle,
  type CommerceIntent,
  type CommerceLifecycleOptions,
  type CommerceLifecycleResult,
} from "./commerce-intent"
import { GovernedPaymentProvider } from "./governed-payment-provider"
import {
  COMMERCE_SECURITY_POLICY,
  COMMERCE_CHECKOUT_CAPABILITY,
  COMMERCE_PAYMENT_CHARGE_CAPABILITY,
  COMMERCE_PAYMENT_REFUND_CAPABILITY,
} from "./commerce-security-policy"

/**
 * Finding D (Jhadina OS Integration Phase 2): Commerce's governed
 * composition root, mirroring Growth's (governed-approval.ts) and
 * Money's (governed-provider-account-read.ts) shape exactly — the
 * third independent domain converging on the same spine:
 *
 *   claimedUserId -> ActionIdentityVerifier -> real, server-verified identity
 *     -> SecurityCoreActionPolicy(COMMERCE_SECURITY_POLICY)
 *     -> commerce.checkout (capability only, no approval)
 *     -> commerce.payment.charge / commerce.payment.refund (approval receipt required)
 *     -> runCommerceIntentLifecycle() — checkout-orchestrator, payment-core,
 *        order-fulfillment-core, all completely unchanged
 *     -> GovernedPaymentProvider, now carrying the verified actor
 *     -> shared ledger (checkout-level and payment-level events, one trail)
 *
 * Both payment capabilities are authorized *before* runCommerceIntentLifecycle
 * ever runs, not per payment-core call. checkout-orchestrator's execute()
 * is one synchronous call that may attempt a charge and, if fulfillment
 * is later denied within that same call, an automatic compensating
 * refund — there is no mid-flight human touchpoint once it starts. Both
 * receipts are requested, approved, and verify-and-consumed up front,
 * under this one governed checkout action — exactly like Growth's own
 * request+approve happens within a single call, not an asynchronous
 * multi-turn approval flow. This does not weaken the approval
 * requirement: a checkout whose actor cannot obtain either receipt
 * never reaches runCommerceIntentLifecycle at all.
 *
 * order-fulfillment-core's own PolicyGate is untouched and is not
 * duplicated here — it keeps answering "can this order be fulfilled
 * here" (jurisdiction/regulatory), a different question from "is this
 * actor allowed to act," which is this file's job.
 *
 * checkout-orchestrator, payment-core, and order-fulfillment-core are
 * not modified by this file in any way.
 */

export interface GovernedCommerceIntentDeps {
  identityVerifier: JhadinaIdentityVerifier
  ledger: InMemoryActionLedger
  approvalStore: ApprovalReceiptStore
  /** The raw, ungoverned provider (reference or sandbox) this checkout should use — wrapped internally in GovernedPaymentProvider. */
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

export async function runCommerceIntentGoverned(
  deps: GovernedCommerceIntentDeps,
  claimedUserId: string,
  intent: CommerceIntent,
  options: CommerceLifecycleOptions = {},
): Promise<GovernedCommerceIntentResult> {
  const now = () => new Date().toISOString()
  const intentKey = `commerce-intent:${claimedUserId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`

  // 1. Identity context. Nothing below runs, and nothing is recorded to
  // the ledger, if the claimed identity can't be verified — matching
  // VerifiedActionExecutor's own precedent (Architecture Checkpoint #2,
  // Finding A: there is no verified actor to durably attribute an
  // event to yet, so none is recorded).
  const identity: ActionRequestIdentity = await deps.identityVerifier.verify({ userId: claimedUserId })

  const policy: ActionPolicy<CommerceCapabilityAction> =
    deps.policy ?? new SecurityCoreActionPolicy<CommerceCapabilityAction>(new JhadinaSecurityCore(COMMERCE_SECURITY_POLICY), "commerce")

  async function evaluate(capability: string): Promise<ActionPolicyDecision> {
    const request: ActionRequest<CommerceCapabilityAction> = {
      id: `${intentKey}:${capability}`,
      userId: identity.userId,
      type: capability,
      action: { capability },
      requestedAt: now(),
    }
    return policy.evaluate(request)
  }

  async function requestApproveAndConsume(capability: string): Promise<string> {
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

    const valid = await verifier.verifyAndConsume(approved.id, request)
    if (!valid) {
      await deps.ledger.append({
        id: `${intentKey}:${capability}-denied`,
        actionId: intentKey,
        userId: identity.userId,
        type: capability,
        status: "denied",
        timestamp: now(),
        metadata: { reason: "invalid_or_expired_approval_receipt" },
      })
      throw new Error(`Invalid approval receipt: ${capability}`)
    }

    await deps.ledger.append({
      id: `${intentKey}:${capability}-approved`,
      actionId: intentKey,
      userId: identity.userId,
      type: capability,
      status: "completed",
      timestamp: now(),
      metadata: { stage: "approval", approvalReceiptId: approved.id },
    })
    return approved.id
  }

  async function authorizeCapability(capability: string, allowApproval: boolean): Promise<string | undefined> {
    const decision = await evaluate(capability)

    if (decision === "deny") {
      await deps.ledger.append({
        id: `${intentKey}:${capability}-denied`,
        actionId: intentKey,
        userId: identity.userId,
        type: capability,
        status: "denied",
        timestamp: now(),
      })
      throw new Error(`Action denied by policy: ${capability}`)
    }

    if (decision === "approval_required") {
      if (!allowApproval) {
        // Defensive: the current COMMERCE_SECURITY_POLICY never marks
        // commerce.checkout as approval-gated, so this branch isn't
        // reachable today — kept fail-closed rather than silently
        // proceeding if that ever changes.
        await deps.ledger.append({
          id: `${intentKey}:${capability}-approval-required`,
          actionId: intentKey,
          userId: identity.userId,
          type: capability,
          status: "approval_required",
          timestamp: now(),
        })
        throw new Error(`Approval required: ${capability}`)
      }
      return requestApproveAndConsume(capability)
    }

    return undefined
  }

  // 2. commerce.checkout — capability-only, no approval, per the
  // established approval boundary (starting/assembling an intent
  // moves no money).
  await deps.ledger.append({
    id: `${intentKey}:checkout-started`,
    actionId: intentKey,
    userId: identity.userId,
    type: COMMERCE_CHECKOUT_CAPABILITY,
    status: "started",
    timestamp: now(),
  })
  await authorizeCapability(COMMERCE_CHECKOUT_CAPABILITY, false)

  // 3. Pre-authorize both payment capabilities this single governed
  // checkout may need — see file header for why both are obtained up
  // front rather than per payment-core call.
  const chargeApprovalReceiptId = await authorizeCapability(COMMERCE_PAYMENT_CHARGE_CAPABILITY, true)
  const refundApprovalReceiptId = await authorizeCapability(COMMERCE_PAYMENT_REFUND_CAPABILITY, true)

  // 4. Execute. checkout-orchestrator, payment-core, and
  // order-fulfillment-core all run completely unchanged; only the
  // verified actor and the shared ledger flow into the
  // GovernedPaymentProvider wrapping the payment boundary.
  const governedProvider = new GovernedPaymentProvider(deps.paymentProvider, identity.userId, deps.ledger)

  let result: CommerceLifecycleResult
  try {
    result = await runCommerceIntentLifecycle(intent, { ...options, paymentProvider: governedProvider })
  } catch (error) {
    await deps.ledger.append({
      id: `${intentKey}:checkout-failed`,
      actionId: intentKey,
      userId: identity.userId,
      type: COMMERCE_CHECKOUT_CAPABILITY,
      status: "failed",
      timestamp: now(),
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

  return { result, verifiedUserId: identity.userId, chargeApprovalReceiptId, refundApprovalReceiptId }
}
