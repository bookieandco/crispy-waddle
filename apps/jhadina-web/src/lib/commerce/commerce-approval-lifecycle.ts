import {
  createApprovalRequestService,
  createApprovalReceiptVerifier,
  type ActionLedger,
  type ActionPolicy,
  type ApprovalReceipt,
  type ApprovalReceiptStore,
} from "@jhadina/action-core"
import { SecurityCoreActionPolicy } from "@jhadina/action-core"
import { JhadinaSecurityCore } from "@jhadina/security-core"
import type { ActionRequestIdentity, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import {
  COMMERCE_PAYMENT_CHARGE_CAPABILITY,
  COMMERCE_PAYMENT_REFUND_CAPABILITY,
  COMMERCE_SECURITY_POLICY,
} from "./commerce-security-policy"

export interface CommerceApprovalLifecycleDeps {
  identityVerifier: JhadinaIdentityVerifier
  approvalStore: ApprovalReceiptStore
  ledger: ActionLedger
  policy?: ActionPolicy<{ capability: string }>
}

export interface CommerceApprovalProposal {
  actionId: string
  verifiedUserId: string
  fingerprint: string
  chargeReceipt: ApprovalReceipt
  refundReceipt: ApprovalReceipt
}

function buildPolicy(policy?: ActionPolicy<{ capability: string }>) {
  return (
    policy ??
    new SecurityCoreActionPolicy<{ capability: string }>(
      new JhadinaSecurityCore(COMMERCE_SECURITY_POLICY),
      "commerce",
    )
  )
}

function requestFor(actionId: string, userId: string, capability: string, fingerprint: string) {
  return {
    id: `${actionId}:${capability}`,
    userId,
    type: capability,
    action: { capability, fingerprint },
    requestedAt: new Date().toISOString(),
  }
}

/**
 * Phase 4 manual-approval lifecycle. Proposal never approves and never
 * executes. It creates durable pending receipts for the payment capabilities
 * that a checkout may need and records the proposal in the durable ledger.
 */
export async function proposeCommerceApproval(
  deps: CommerceApprovalLifecycleDeps,
  claimedUserId: string,
  actionId: string,
  fingerprint: string,
): Promise<CommerceApprovalProposal> {
  const identity: ActionRequestIdentity = await deps.identityVerifier.verify({ userId: claimedUserId })
  const policy = buildPolicy(deps.policy)

  const chargeRequest = requestFor(actionId, identity.userId, COMMERCE_PAYMENT_CHARGE_CAPABILITY, fingerprint)
  const refundRequest = requestFor(actionId, identity.userId, COMMERCE_PAYMENT_REFUND_CAPABILITY, fingerprint)

  const chargeDecision = await policy.evaluate(chargeRequest)
  const refundDecision = await policy.evaluate(refundRequest)

  if (chargeDecision === "deny" || refundDecision === "deny") {
    await deps.ledger.append({
      id: `${actionId}:approval-denied`,
      actionId,
      userId: identity.userId,
      type: "commerce.approval",
      status: "denied",
      timestamp: new Date().toISOString(),
      metadata: { chargeDecision, refundDecision },
    })
    throw new Error("Commerce action denied by policy")
  }

  const chargeService = createApprovalRequestService(deps.approvalStore, () => fingerprint)
  const refundService = createApprovalRequestService(deps.approvalStore, () => fingerprint)
  const chargeReceipt = await chargeService.requestApproval(chargeRequest)
  const refundReceipt = await refundService.requestApproval(refundRequest)

  await deps.ledger.append({
    id: `${actionId}:approval-proposed`,
    actionId,
    userId: identity.userId,
    type: "commerce.approval",
    status: "approval_required",
    timestamp: new Date().toISOString(),
    metadata: {
      chargeReceiptId: chargeReceipt.id,
      refundReceiptId: refundReceipt.id,
      expiresAt: chargeReceipt.expiresAt,
    },
  })

  return {
    actionId,
    verifiedUserId: identity.userId,
    fingerprint,
    chargeReceipt,
    refundReceipt,
  }
}

/** Explicit human approval. This function does not execute commerce. */
export async function approveCommerceReceipt(
  deps: CommerceApprovalLifecycleDeps,
  claimedUserId: string,
  receiptId: string,
): Promise<ApprovalReceipt> {
  const identity = await deps.identityVerifier.verify({ userId: claimedUserId })
  const receipt = await deps.approvalStore.approve(receiptId, identity.userId)

  await deps.ledger.append({
    id: `${receipt.actionId}:${receipt.id}:approved`,
    actionId: receipt.actionId,
    userId: identity.userId,
    type: receipt.type,
    status: "completed",
    timestamp: new Date().toISOString(),
    metadata: { stage: "human_approval", approvalReceiptId: receipt.id },
  })

  return receipt
}

/**
 * Execution gate. A caller must present an approved receipt whose action,
 * actor, capability, and fingerprint all match. Consumption is atomic in the
 * production Supabase store, making replay fail closed.
 */
export async function consumeCommerceApproval(
  deps: CommerceApprovalLifecycleDeps,
  claimedUserId: string,
  receiptId: string,
  actionId: string,
  capability: string,
  fingerprint: string,
): Promise<void> {
  const identity = await deps.identityVerifier.verify({ userId: claimedUserId })
  const verifier = createApprovalReceiptVerifier(deps.approvalStore, () => fingerprint)
  const valid = await verifier.verifyAndConsume(receiptId, {
    id: `${actionId}:${capability}`,
    userId: identity.userId,
    type: capability,
    action: { capability, fingerprint },
    requestedAt: new Date().toISOString(),
  })

  if (!valid) {
    await deps.ledger.append({
      id: `${actionId}:${receiptId}:execution-denied`,
      actionId,
      userId: identity.userId,
      type: capability,
      status: "denied",
      timestamp: new Date().toISOString(),
      metadata: { reason: "invalid_expired_or_replayed_approval_receipt" },
    })
    throw new Error("Invalid, expired, or already-consumed commerce approval receipt")
  }

  await deps.ledger.append({
    id: `${actionId}:${receiptId}:consumed`,
    actionId,
    userId: identity.userId,
    type: capability,
    status: "completed",
    timestamp: new Date().toISOString(),
    metadata: { stage: "execution_authorization", approvalReceiptId: receiptId },
  })
}
