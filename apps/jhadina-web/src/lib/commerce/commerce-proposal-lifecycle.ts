import {
  SecurityCoreActionPolicy,
  createApprovalRequestService,
  createApprovalReceiptVerifier,
  type ActionLedger,
  type ActionPolicy,
  type ApprovalReceiptStore,
} from "@jhadina/action-core"
import { JhadinaSecurityCore } from "@jhadina/security-core"
import type { PaymentProvider } from "@jhadina/payment-core"
import type { ActionRequestIdentity, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { COMMERCE_PAYMENT_CHARGE_CAPABILITY, COMMERCE_SECURITY_POLICY } from "./commerce-security-policy"
import { GovernedPaymentProvider } from "./governed-payment-provider"
import type { CommerceProposal, CommerceProposalPayload, CommerceProposalStore } from "./commerce-proposal-store"
import { commerceEventId, type CommerceEventBus } from "./commerce-event-bus"

/**
 * Phase 4.6: the production-facing Commerce approval boundary —
 * propose -> explicit human approval -> execute, entirely without live
 * money. Three durable stages, three distinct capability checks, and no
 * stage skips or auto-advances the next:
 *
 *   proposeCommerceAction    — policy-gated, creates a durable PENDING row.
 *   approveCommerceProposal  — the human's explicit act. Issues a bound,
 *                              single-use approval receipt and transitions
 *                              PENDING -> APPROVED. Nothing here executes
 *                              anything.
 *   executeCommerceProposal  — re-verifies identity, re-loads the durable
 *                              proposal, recomputes its fingerprint from
 *                              the *stored* payload (never trusts a
 *                              caller-supplied one), consumes the single-
 *                              use receipt, and only then calls the real
 *                              governed PaymentProvider (Stripe sandbox/
 *                              test only — see stripe-sandbox-provider.ts
 *                              and sandbox-credential.ts's fail-closed
 *                              sk_test_ assertion).
 *
 * This reuses, and does not fork, every existing primitive: the same
 * SecurityCoreActionPolicy(COMMERCE_SECURITY_POLICY) Commerce's checkout
 * path already uses, the same ApprovalReceiptStore contract (durable
 * production impl: supabase-approval-receipt-store.ts, already proven by
 * PR #110's own tests), and the same GovernedPaymentProvider that already
 * records every payment-capability call to the shared ActionLedger.
 * CommerceProposalStore is the one new primitive this milestone adds —
 * durable content (amount/currency/description/test payment method) for
 * a proposal, which the existing ApprovalReceiptStore deliberately has no
 * room for (it is a generic, cross-domain action-id/fingerprint receipt,
 * reused by Growth and Money too, and is not the place for Commerce-only
 * payload fields).
 *
 * Step 8 addition: each stage also publishes to a CommerceEventBus
 * (commerce-event-bus.ts) — proposal_created, approval_granted,
 * execution_started, execution_succeeded, execution_failed, and
 * replay_rejected. The bus only ever records what already happened,
 * strictly after the real policy/approval/receipt decision; see that
 * file's own header for why it can never become an alternate path
 * around authorization.
 */

/** Shared by all three stages. Propose and approve never call a payment provider at all — see CommerceProposalExecutionDeps. */
export interface CommerceProposalLifecycleDeps {
  identityVerifier: JhadinaIdentityVerifier
  proposalStore: CommerceProposalStore
  approvalStore: ApprovalReceiptStore
  ledger: ActionLedger
  /**
   * Step 8: records what happened at each stage for distribution — see
   * commerce-event-bus.ts's own header for why this can never become an
   * alternate authorization path. Every publish() below happens strictly
   * after the real policy/approval/receipt decision, never before it.
   */
  eventBus: CommerceEventBus
  policy?: ActionPolicy<{ capability: string }>
}

/** Execute is the only stage that ever reaches a real PaymentProvider — sandbox/test only, see production-payment-provider.ts. */
export interface CommerceProposalExecutionDeps extends CommerceProposalLifecycleDeps {
  paymentProvider: PaymentProvider
}

export interface CommerceProposalResult {
  proposal: CommerceProposal
  verifiedUserId: string
}

export interface CommerceProposalApprovalResult {
  proposal: CommerceProposal
  verifiedUserId: string
  approvalReceiptId: string
}

export interface CommerceProposalExecutionResult {
  proposal: CommerceProposal
  verifiedUserId: string
  paymentId: string
  providerReference?: string
  status: string
}

function buildPolicy(policy?: ActionPolicy<{ capability: string }>) {
  return (
    policy ??
    new SecurityCoreActionPolicy<{ capability: string }>(new JhadinaSecurityCore(COMMERCE_SECURITY_POLICY), "commerce")
  )
}

/** Deterministic — recomputed from the proposal's own stored id/capability/payload, never accepted from a caller. */
export function computeProposalFingerprint(proposalId: string, capability: string, payload: CommerceProposalPayload): string {
  return `commerce-proposal:${proposalId}:${capability}:${payload.amountMinor}:${payload.currency}:${payload.testPaymentMethod}`
}

/** Stage 1: create a durable PENDING proposal. Never approves, never executes, never touches Stripe. */
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
    await deps.ledger.append({
      id: `${provisionalId}:denied`,
      actionId: provisionalId,
      userId: identity.userId,
      type: COMMERCE_PAYMENT_CHARGE_CAPABILITY,
      status: "denied",
      timestamp: now(),
    })
    throw new Error(`Action denied by policy: ${COMMERCE_PAYMENT_CHARGE_CAPABILITY}`)
  }

  const created = await deps.proposalStore.create({
    userId: identity.userId,
    capability: COMMERCE_PAYMENT_CHARGE_CAPABILITY,
    payload,
  })
  // The fingerprint that will bind this proposal's approval receipt is
  // deterministic from (id, capability, payload) — see
  // computeProposalFingerprint's own doc comment — so it is never stored;
  // recomputing it here is purely for this stage's own ledger entry.
  const fingerprint = computeProposalFingerprint(created.id, created.capability, created.payload)

  await deps.ledger.append({
    id: `${created.id}:proposed`,
    actionId: created.id,
    userId: identity.userId,
    type: COMMERCE_PAYMENT_CHARGE_CAPABILITY,
    status: "started",
    timestamp: now(),
    metadata: { decision, fingerprint, amountMinor: payload.amountMinor, currency: payload.currency },
  })

  await deps.eventBus.publish({
    id: commerceEventId("proposal_created", created.id),
    type: "proposal_created",
    proposalId: created.id,
    capability: created.capability,
    actorId: identity.userId,
    occurredAt: now(),
    payload: { amountMinor: payload.amountMinor, currency: payload.currency, description: payload.description },
  })

  return { proposal: created, verifiedUserId: identity.userId }
}

/** Stage 2: the human's explicit approval. Issues a single-use receipt bound to this exact proposal; executes nothing. */
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
    id: proposal.id,
    userId: identity.userId,
    type: proposal.capability,
    action: { capability: proposal.capability, fingerprint },
    requestedAt: now(),
  }

  // No automatic approval path exists anywhere in this function: reaching
  // this line already required a distinct, explicit, authenticated POST
  // to this stage — requestApproval + approve here is the human's approval
  // act itself, not a system-initiated shortcut.
  const approvalService = createApprovalRequestService(deps.approvalStore, () => fingerprint)
  const pending = await approvalService.requestApproval(request)
  const approved = await approvalService.approve(pending.id, identity.userId)

  const updated = await deps.proposalStore.markApproved(proposal.id, identity.userId, approved.id)

  await deps.ledger.append({
    id: `${proposal.id}:approved`,
    actionId: proposal.id,
    userId: identity.userId,
    type: proposal.capability,
    status: "completed",
    timestamp: now(),
    metadata: { stage: "human_approval", approvalReceiptId: approved.id, expiresAt: approved.expiresAt },
  })

  await deps.eventBus.publish({
    id: commerceEventId("approval_granted", proposal.id),
    type: "approval_granted",
    proposalId: proposal.id,
    capability: proposal.capability,
    actorId: identity.userId,
    occurredAt: now(),
    payload: { approvalReceiptId: approved.id, expiresAt: approved.expiresAt },
  })

  return { proposal: updated, verifiedUserId: identity.userId, approvalReceiptId: approved.id }
}

/** Stage 3: validate identity + proposal + fingerprint + the single-use receipt, then execute — Stripe sandbox/test only. */
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
  const verifier = createApprovalReceiptVerifier(deps.approvalStore, () => fingerprint)
  const valid = await verifier.verifyAndConsume(proposal.receiptId, {
    id: proposal.id,
    userId: identity.userId,
    type: proposal.capability,
    action: { capability: proposal.capability, fingerprint },
    requestedAt: now(),
  })

  if (!valid) {
    await deps.ledger.append({
      id: `${proposal.id}:execution-denied`,
      actionId: proposal.id,
      userId: identity.userId,
      type: proposal.capability,
      status: "denied",
      timestamp: now(),
      metadata: { reason: "invalid_expired_or_replayed_approval_receipt" },
    })
    await deps.eventBus.publish({
      id: commerceEventId("replay_rejected", proposal.id),
      type: "replay_rejected",
      proposalId: proposal.id,
      capability: proposal.capability,
      actorId: identity.userId,
      occurredAt: now(),
      payload: { reason: "invalid_expired_or_replayed_approval_receipt" },
    })
    throw new Error("Invalid, expired, or already-consumed commerce approval receipt")
  }

  await deps.eventBus.publish({
    id: commerceEventId("execution_started", proposal.id),
    type: "execution_started",
    proposalId: proposal.id,
    capability: proposal.capability,
    actorId: identity.userId,
    occurredAt: now(),
    payload: { approvalReceiptId: proposal.receiptId },
  })

  // GovernedPaymentProvider independently appends started/completed/failed
  // events to the same ledger for commerce.payment.charge — this call's
  // own ledger entries above cover the proposal/approval lifecycle, not
  // the payment call itself, so nothing here is duplicated.
  const governedProvider = new GovernedPaymentProvider(deps.paymentProvider, identity.userId, deps.ledger)

  let intent: Awaited<ReturnType<typeof governedProvider.createPaymentIntent>>
  try {
    intent = await governedProvider.createPaymentIntent({
      paymentId: proposal.id,
      orderId: proposal.id,
      customer: { id: identity.userId, type: "customer" },
      seller: { id: "jhadina-commerce", type: "platform" },
      amount: { amountMinor: proposal.payload.amountMinor, currency: proposal.payload.currency },
      lines: [],
      taxes: [],
      platformFees: [],
      metadata: { stripeTestPaymentMethod: proposal.payload.testPaymentMethod, description: proposal.payload.description },
    })
  } catch (error) {
    await deps.eventBus.publish({
      id: commerceEventId("execution_failed", proposal.id),
      type: "execution_failed",
      proposalId: proposal.id,
      capability: proposal.capability,
      actorId: identity.userId,
      occurredAt: now(),
      payload: { reason: error instanceof Error ? error.message : String(error) },
    })
    throw error
  }

  const updated = await deps.proposalStore.markExecuted(proposal.id, identity.userId, {
    paymentId: intent.paymentId,
    provider: intent.provider,
    providerReference: intent.providerReference ?? null,
    status: intent.status,
  })

  await deps.eventBus.publish({
    id: commerceEventId("execution_succeeded", proposal.id),
    type: "execution_succeeded",
    proposalId: proposal.id,
    capability: proposal.capability,
    actorId: identity.userId,
    occurredAt: now(),
    payload: { paymentId: intent.paymentId, providerReference: intent.providerReference ?? null, status: intent.status },
  })

  return {
    proposal: updated,
    verifiedUserId: identity.userId,
    paymentId: intent.paymentId,
    providerReference: intent.providerReference,
    status: intent.status,
  }
}
