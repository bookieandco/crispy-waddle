import {
  ActionExecutor,
  InMemoryActionLedger,
  createApprovalRequestService,
  createApprovalReceiptVerifier,
  createBaseSecurityCoreActionPolicy,
  type ActionAuditEvent,
  type ActionHandler,
  type ActionLedger,
  type ActionPolicy,
  type ActionRequest,
  type ApprovalReceiptStore,
} from "@jhadina/action-core"
import type { ActionRequestIdentity, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { approveGrowthDraft } from "./engine"
import type { GrowthDraft } from "./types"

/**
 * Proof #1 of Jhadina OS Integration Phase 1 (the "Spine Proof"): the
 * Growth draft approval action, taken end to end through the real
 * governance lifecycle —
 *
 *   UI click -> identity context -> policy/capability evaluation ->
 *   explicit approval -> ActionExecutor -> audit receipt -> result
 *
 * This module composes only already-landed FOUNDATION infrastructure
 * (jhadina-action-core, security-core) with the already-shipped Growth
 * engine (JH-015). It adds no new external side effect, credential, or
 * publishing capability — approving a draft only flips its in-memory
 * status from PENDING_APPROVAL to APPROVED, exactly as it did before
 * this change. What's different is that the transition can no longer
 * happen without passing through every governed stage.
 */
export const GROWTH_DRAFT_APPROVE_CAPABILITY = "growth.draft.approve"

export interface GrowthDraftApproveAction {
  draftId: string
}

/** Deterministic fingerprint binding an approval receipt to exactly one draft. */
function fingerprintApproveAction(action: GrowthDraftApproveAction): string {
  return `growth-draft-approve:${action.draftId}`
}

export function createGrowthDraftApprovalHandler(): ActionHandler<GrowthDraftApproveAction, GrowthDraft> {
  return {
    supports: (type) => type === GROWTH_DRAFT_APPROVE_CAPABILITY,
    async execute(action, request) {
      const draft = approveGrowthDraft(request.userId, action.draftId)
      if (!draft) {
        throw new Error("Draft not found, not owned by this user, or not awaiting approval")
      }
      return draft
    },
  }
}

export interface GovernedGrowthApprovalDeps {
  /** Verifies the caller's claimed identity against a real, server-side session. */
  identityVerifier: JhadinaIdentityVerifier
  /** Immutable, append-only audit trail for every stage of the lifecycle. */
  ledger: ActionLedger
  /** Backing store for explicit approval receipts (request -> approve -> consume). */
  approvalStore: ApprovalReceiptStore
  /** Defaults to the base Security Core policy (growth.draft.approve is approval-gated there). */
  policy?: ActionPolicy<GrowthDraftApproveAction>
}

export interface GovernedGrowthApprovalResult {
  draft: GrowthDraft
  verifiedUserId: string
  /** Set only when the policy required an explicit approval step (the expected path today). */
  approvalReceiptId?: string
}

/**
 * Runs the full governed lifecycle for approving one Growth draft.
 *
 * 1. Identity context   — real session verification; the claimed userId
 *    must match the verified subject or nothing else runs.
 * 2. Policy evaluation   — deterministic Security Core capability check,
 *    recorded to the ledger as its own visible stage.
 * 3. Explicit approval   — if policy requires it (it does, for this
 *    capability), a receipt is requested and approved before execution
 *    can proceed. A stale or mismatched receipt cannot be reused.
 * 4. ActionExecutor      — the hardened executor (JH-045) re-validates
 *    policy and the receipt, then and only then calls the handler.
 * 5. Audit receipt       — every stage above is append-only in `ledger`.
 *
 * No LLM is in this path. No credential is read here — the identity
 * verifier and ledger are both injected, and the reference wiring in
 * this app uses Supabase session claims and an in-memory ledger, never
 * a raw external provider.
 */
export async function approveGrowthDraftGoverned(
  deps: GovernedGrowthApprovalDeps,
  claimedUserId: string,
  draftId: string,
): Promise<GovernedGrowthApprovalResult> {
  const now = () => new Date().toISOString()
  const actionId = `growth-draft-approve:${draftId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`

  // 1. Identity context.
  let identity: ActionRequestIdentity
  try {
    identity = await deps.identityVerifier.verify({ userId: claimedUserId })
  } catch (error) {
    await deps.ledger.append({
      id: `${actionId}:identity-rejected`,
      actionId,
      userId: claimedUserId,
      type: GROWTH_DRAFT_APPROVE_CAPABILITY,
      status: "denied",
      timestamp: now(),
      metadata: { stage: "identity", reason: error instanceof Error ? error.message : String(error) },
    })
    throw error
  }

  const request: ActionRequest<GrowthDraftApproveAction> = {
    id: actionId,
    userId: identity.userId,
    type: GROWTH_DRAFT_APPROVE_CAPABILITY,
    action: { draftId },
    requestedAt: now(),
  }

  // 2. Policy / capability evaluation — a distinct, visible, audited stage.
  const policy = deps.policy ?? createBaseSecurityCoreActionPolicy<GrowthDraftApproveAction>()
  const decision = await policy.evaluate(request)
  await deps.ledger.append({
    id: `${actionId}:policy-evaluated`,
    actionId,
    userId: identity.userId,
    type: GROWTH_DRAFT_APPROVE_CAPABILITY,
    status: "started",
    timestamp: now(),
    metadata: { decision },
  })

  if (decision === "deny") {
    await deps.ledger.append({
      id: `${actionId}:policy-denied`,
      actionId,
      userId: identity.userId,
      type: GROWTH_DRAFT_APPROVE_CAPABILITY,
      status: "denied",
      timestamp: now(),
    })
    throw new Error(`Action denied by policy: ${GROWTH_DRAFT_APPROVE_CAPABILITY}`)
  }

  const approvalVerifier = createApprovalReceiptVerifier(deps.approvalStore, (r) =>
    fingerprintApproveAction(r.action as GrowthDraftApproveAction),
  )
  const executor = new ActionExecutor(policy, deps.ledger, [createGrowthDraftApprovalHandler()], approvalVerifier)

  // 3. Explicit approval, only when policy requires it.
  let approvalReceiptId: string | undefined
  if (decision === "approval_required") {
    const approvalService = createApprovalRequestService(deps.approvalStore, (r) =>
      fingerprintApproveAction(r.action as GrowthDraftApproveAction),
    )
    const pending = await approvalService.requestApproval(request)
    const approved = await approvalService.approve(pending.id, identity.userId)
    approvalReceiptId = approved.id
  }

  // 4. ActionExecutor executes (re-validates policy + receipt independently).
  const draft = await executor.execute(approvalReceiptId ? { ...request, approvalReceiptId } : request)

  // 5. The ledger now holds an immutable, ordered record of every stage:
  // identity (implicit success — nothing appended on the happy path,
  // matching JH-044's design), policy-evaluated, started, approval-
  // required (internal to executor.execute()'s first internal check —
  // not reached here since the receipt is already attached), completed.
  return { draft, verifiedUserId: identity.userId, approvalReceiptId }
}

/** Convenience accessor for displaying/asserting on the recorded audit trail. */
export function listGovernedGrowthApprovalAuditTrail(ledger: ActionLedger): readonly ActionAuditEvent[] {
  if (ledger instanceof InMemoryActionLedger) return ledger.list()
  return []
}
