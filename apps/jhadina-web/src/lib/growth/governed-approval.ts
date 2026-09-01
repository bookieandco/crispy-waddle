import {
  ActionExecutor,
  createApprovalRequestService,
  createApprovalReceiptVerifier,
  createBaseSecurityCoreActionPolicy,
  type ActionHandler,
  type ActionLedger,
  type ActionPolicy,
  type ActionRequest,
  type ApprovalReceiptStore,
} from "@jhadina/action-core"
import type { NonceReplayGuard } from "@jhadina/security-core"
import type { ActionRequestIdentity, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { approveGrowthDraft } from "./engine"
import type { GrowthDraft } from "./types"

/**
 * Proof #1 of Jhadina OS Integration Phase 1 (the "Spine Proof"): the
 * Growth draft approval action, taken end to end through the real
 * governance lifecycle — identity -> policy -> explicit approval ->
 * final replay claim -> ActionExecutor -> audit receipt.
 */
export const GROWTH_DRAFT_APPROVE_CAPABILITY = "growth.draft.approve"

export interface GrowthDraftApproveAction {
  draftId: string
}

function fingerprintApproveAction(action: GrowthDraftApproveAction): string {
  return `growth-draft-approve:${action.draftId}`
}

export function createGrowthDraftApprovalHandler(): ActionHandler<GrowthDraftApproveAction, GrowthDraft> {
  return {
    supports: (type) => type === GROWTH_DRAFT_APPROVE_CAPABILITY,
    async execute(action, request) {
      const draft = approveGrowthDraft(request.userId, action.draftId)
      if (!draft) throw new Error("Draft not found, not owned by this user, or not awaiting approval")
      return draft
    },
  }
}

export interface GovernedGrowthApprovalDeps {
  identityVerifier: JhadinaIdentityVerifier
  ledger: ActionLedger
  approvalStore: ApprovalReceiptStore
  /** Durable one-shot execution guard. Test-only callers may inject InMemoryNonceReplayGuard. */
  replayGuard: NonceReplayGuard
  policy?: ActionPolicy<GrowthDraftApproveAction>
}

export interface GovernedGrowthApprovalResult {
  draft: GrowthDraft
  verifiedUserId: string
  approvalReceiptId?: string
}

export async function approveGrowthDraftGoverned(
  deps: GovernedGrowthApprovalDeps,
  claimedUserId: string,
  draftId: string,
): Promise<GovernedGrowthApprovalResult> {
  const now = () => new Date().toISOString()
  const actionId = `growth-draft-approve:${draftId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`

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
    nonce: actionId,
  }

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
  const executor = new ActionExecutor(
    policy,
    deps.ledger,
    [createGrowthDraftApprovalHandler()],
    approvalVerifier,
    deps.replayGuard,
  )

  let approvalReceiptId: string | undefined
  if (decision === "approval_required") {
    const approvalService = createApprovalRequestService(deps.approvalStore, (r) =>
      fingerprintApproveAction(r.action as GrowthDraftApproveAction),
    )
    const pending = await approvalService.requestApproval(request)
    const approved = await approvalService.approve(pending.id, identity.userId)
    approvalReceiptId = approved.id
  }

  const draft = await executor.execute(approvalReceiptId ? { ...request, approvalReceiptId } : request)
  return { draft, verifiedUserId: identity.userId, approvalReceiptId }
}
