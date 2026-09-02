import {
  SecurityCoreActionPolicy,
  createApprovalRequestService,
  type ActionLedger,
  type ActionPolicy,
  type ApprovalReceiptStore,
} from "@jhadina/action-core"
import { JhadinaSecurityCore } from "@jhadina/security-core"
import type { PaymentProvider } from "@jhadina/payment-core"
import type { ActionRequestIdentity, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { COMMERCE_PAYMENT_CHARGE_CAPABILITY, COMMERCE_SECURITY_POLICY } from "./commerce-security-policy"
import { GovernedPaymentProvider, type GovernedPaymentApproval } from "./governed-payment-provider"
import type { CommerceProposal, CommerceProposalPayload, CommerceProposalStore } from "./commerce-proposal-store"

export interface CommerceProposalLifecycleDeps {
  identityVerifier: JhadinaIdentityVerifier
  proposalStore: CommerceProposalStore
  approvalStore: ApprovalReceiptStore
  ledger: ActionLedger
  policy?: ActionPolicy<{ capability: string }>
}

export interface CommerceProposalExecutionDeps extends CommerceProposalLifecycleDeps {
  paymentProvider: PaymentProvider
}

export interface CommerceProposalResult { proposal: CommerceProposal; verifiedUserId: string }
export interface CommerceProposalApprovalResult { proposal: CommerceProposal; verifiedUserId: string; approvalReceiptId: string }
export interface CommerceProposalExecutionResult {
  proposal: CommerceProposal
  verifiedUserId: string
  paymentId: string
  providerReference?: string
  status: string
}

function buildPolicy(policy?: ActionPolicy<{ capability: string }>) {
  return policy ?? new SecurityCoreActionPolicy<{ capability: string }>(new JhadinaSecurityCore(COMMERCE_SECURITY_POLICY), "commerce")
}

export function computeProposalFingerprint(proposalId: string, capability: string, payload: CommerceProposalPayload): string {
  return `commerce-proposal:${proposalId}:${capability}:${payload.amountMinor}:${payload.currency}:${payload.testPaymentMethod}`
}

export async function proposeCommerceAction(
  deps: CommerceProposalLifecycleDeps,
  claimedUserId: string,
  payload: CommerceProposalPayload,
): Promise<CommerceProposalResult> {
  const now = () => new Date().toISOString()
  const identity: ActionRequestIdentity = await deps.identityVerifier.verify({ userId: claimedUserId })
  const policy = buildPolicy(deps.policy)
  const provisionalId = `commerce-proposal:${identity.userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
  const decision = await policy.evaluate({
    id: provisionalId,
    userId: identity.userId,
    type: COMMERCE_PAYMENT_CHARGE_CAPABILITY,
    action: { capability: COMMERCE_PAYMENT_CHARGE_CAPABILITY },
    requestedAt: now(),
  })

  if (decision === "deny") {
    await deps.ledger.append({ id: `${provisionalId}:denied`, actionId: provisionalId, userId: identity.userId, type: COMMERCE_PAYMENT_CHARGE_CAPABILITY, status: "denied", timestamp: now() })
    throw new Error(`Action denied by policy: ${COMMERCE_PAYMENT_CHARGE_CAPABILITY}`)
  }

  const created = await deps.proposalStore.create({ userId: identity.userId, capability: COMMERCE_PAYMENT_CHARGE_CAPABILITY, payload })
  const fingerprint = computeProposalFingerprint(created.id, created.capability, created.payload)
  await deps.ledger.append({
    id: `${created.id}:proposed`, actionId: created.id, userId: identity.userId,
    type: COMMERCE_PAYMENT_CHARGE_CAPABILITY, status: "started", timestamp: now(),
    metadata: { decision, fingerprint, amountMinor: payload.amountMinor, currency: payload.currency },
  })
  return { proposal: created, verifiedUserId: identity.userId }
}

export async function approveCommerceProposal(
  deps: CommerceProposalLifecycleDeps,
  claimedUserId: string,
  proposalId: string,
): Promise<CommerceProposalApprovalResult> {
  const now = () => new Date().toISOString()
  const identity: ActionRequestIdentity = await deps.identityVerifier.verify({ userId: claimedUserId })
  const proposal = await deps.proposalStore.get(proposalId, identity.userId)
  if (!proposal) throw new Error("Commerce proposal not found")
  if (proposal.status !== "pending") throw new Error(`Commerce proposal is not pending approval: ${proposal.status}`)

  const fingerprint = computeProposalFingerprint(proposal.id, proposal.capability, proposal.payload)
  const request = {
    id: proposal.id, userId: identity.userId, type: proposal.capability,
    action: { capability: proposal.capability, fingerprint }, requestedAt: now(),
  }
  const approvalService = createApprovalRequestService(deps.approvalStore, () => fingerprint)
  const pending = await approvalService.requestApproval(request)
  const approved = await approvalService.approve(pending.id, identity.userId)
  const updated = await deps.proposalStore.markApproved(proposal.id, identity.userId, approved.id)

  await deps.ledger.append({
    id: `${proposal.id}:approved`, actionId: proposal.id, userId: identity.userId,
    type: proposal.capability, status: "completed", timestamp: now(),
    metadata: { stage: "human_approval", approvalReceiptId: approved.id, expiresAt: approved.expiresAt },
  })
  return { proposal: updated, verifiedUserId: identity.userId, approvalReceiptId: approved.id }
}

export async function executeCommerceProposal(
  deps: CommerceProposalExecutionDeps,
  claimedUserId: string,
  proposalId: string,
): Promise<CommerceProposalExecutionResult> {
  const now = () => new Date().toISOString()
  const identity: ActionRequestIdentity = await deps.identityVerifier.verify({ userId: claimedUserId })
  const proposal = await deps.proposalStore.get(proposalId, identity.userId)
  if (!proposal) throw new Error("Commerce proposal not found")
  if (proposal.status !== "approved" || !proposal.receiptId) {
    throw new Error(`Commerce proposal is not approved and ready to execute: ${proposal.status}`)
  }

  const fingerprint = computeProposalFingerprint(proposal.id, proposal.capability, proposal.payload)
  const approvals: GovernedPaymentApproval<"commerce.payment.charge"> = {
    receiptId: proposal.receiptId,
    actionId: proposal.id,
    capability: "commerce.payment.charge",
    verifier: deps.approvalStore,
  }
  const governedProvider = new GovernedPaymentProvider(deps.paymentProvider, identity.userId, deps.ledger, approvals)
  const intent = await governedProvider.createPaymentIntent({
    paymentId: proposal.id,
    orderId: proposal.id,
    customer: { id: identity.userId, type: "customer" },
    seller: { id: "jhadina-commerce", type: "platform" },
    amount: { amountMinor: proposal.payload.amountMinor, currency: proposal.payload.currency },
    lines: [], taxes: [], platformFees: [],
    metadata: {
      stripeTestPaymentMethod: proposal.payload.testPaymentMethod,
      description: proposal.payload.description,
      proposalFingerprint: fingerprint,
    },
  })

  const updated = await deps.proposalStore.markExecuted(proposal.id, identity.userId, {
    paymentId: intent.paymentId, provider: intent.provider,
    providerReference: intent.providerReference ?? null, status: intent.status,
  })
  return {
    proposal: updated, verifiedUserId: identity.userId, paymentId: intent.paymentId,
    providerReference: intent.providerReference, status: intent.status,
  }
}
