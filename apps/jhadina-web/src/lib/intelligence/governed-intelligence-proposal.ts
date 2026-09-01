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
import type { ContextPacket, DecisionProposal } from "@jhadina/core-spine"
import type { IntelligenceRouter } from "@jhadina/intelligence-core"
import type { ActionRequestIdentity, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import type { MemoryCandidate } from "../storage/InMemoryStorage"
import { MEMORY_PROPOSE_CAPABILITY, createMemoryProposeHandler, type MemoryProposeAction } from "./memory-propose-capability"

export interface GovernedIntelligenceProposalDeps {
  identityVerifier: JhadinaIdentityVerifier
  ledger: ActionLedger
  router: IntelligenceRouter
  memoryRepo: MemoryRepository
  reasoningRepo: ReasoningEventRepository
  approvalStore: ApprovalReceiptStore
  /** Durable one-shot execution guard. Tests may inject InMemoryNonceReplayGuard. */
  replayGuard: NonceReplayGuard
  policy?: ActionPolicy<MemoryProposeAction>
}

export interface GovernedIntelligenceProposalResult {
  proposal: DecisionProposal
  verifiedUserId: string
  candidate?: MemoryCandidate
  approvalReceiptId?: string
}

function fingerprintMemoryPropose(action: MemoryProposeAction): string {
  return `memory-propose:${action.content}`
}

export async function decideAndProposeMemoryGoverned(
  deps: GovernedIntelligenceProposalDeps,
  claimedUserId: string,
  context: ContextPacket,
): Promise<GovernedIntelligenceProposalResult> {
  const now = () => new Date().toISOString()
  const actionId = `intelligence-propose:${context.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`

  let identity: ActionRequestIdentity
  try {
    identity = await deps.identityVerifier.verify({ userId: claimedUserId })
  } catch (error) {
    await deps.ledger.append({ id: `${actionId}:identity-rejected`, actionId, userId: claimedUserId, type: MEMORY_PROPOSE_CAPABILITY, status: "denied", timestamp: now(), metadata: { stage: "identity", reason: error instanceof Error ? error.message : String(error) } })
    throw error
  }

  let proposal: DecisionProposal
  try {
    proposal = await deps.router.decide(context)
  } catch (error) {
    await deps.ledger.append({ id: `${actionId}:model-unavailable`, actionId, userId: identity.userId, type: MEMORY_PROPOSE_CAPABILITY, status: "failed", timestamp: now(), metadata: { stage: "decide", reason: error instanceof Error ? error.message : String(error) } })
    throw error
  }

  if (proposal.disposition !== "PROCEED") {
    await deps.ledger.append({ id: `${actionId}:proposal-not-actioned`, actionId, userId: identity.userId, type: MEMORY_PROPOSE_CAPABILITY, status: "completed", timestamp: now(), metadata: { disposition: proposal.disposition, proposalId: proposal.id } })
    return { proposal, verifiedUserId: identity.userId }
  }

  const request: ActionRequest<MemoryProposeAction> = {
    id: actionId,
    userId: identity.userId,
    type: MEMORY_PROPOSE_CAPABILITY,
    action: { content: proposal.recommendation, rationale: proposal.rationale, confidence: confidenceFor(proposal) },
    requestedAt: now(),
    nonce: actionId,
  }

  const policy = deps.policy ?? createBaseSecurityCoreActionPolicy<MemoryProposeAction>()
  const decision = await policy.evaluate(request)
  await deps.ledger.append({ id: `${actionId}:policy-evaluated`, actionId, userId: identity.userId, type: MEMORY_PROPOSE_CAPABILITY, status: "started", timestamp: now(), metadata: { decision, disposition: proposal.disposition, proposalId: proposal.id } })

  if (decision === "deny") {
    await deps.ledger.append({ id: `${actionId}:policy-denied`, actionId, userId: identity.userId, type: MEMORY_PROPOSE_CAPABILITY, status: "denied", timestamp: now() })
    throw new Error(`Action denied by policy: ${MEMORY_PROPOSE_CAPABILITY}`)
  }

  const approvalVerifier = createApprovalReceiptVerifier(deps.approvalStore, (r) => fingerprintMemoryPropose(r.action as MemoryProposeAction))
  const handler: ActionHandler<MemoryProposeAction, MemoryCandidate> = createMemoryProposeHandler(deps.memoryRepo, deps.reasoningRepo)
  const executor = new ActionExecutor(policy, deps.ledger, [handler], approvalVerifier, deps.replayGuard)

  let approvalReceiptId: string | undefined
  if (decision === "approval_required") {
    const approvalService = createApprovalRequestService(deps.approvalStore, (r) => fingerprintMemoryPropose(r.action as MemoryProposeAction))
    const pending = await approvalService.requestApproval(request)
    const approved = await approvalService.approve(pending.id, identity.userId)
    approvalReceiptId = approved.id
  }

  const candidate = await executor.execute(approvalReceiptId ? { ...request, approvalReceiptId } : request)
  return { proposal, verifiedUserId: identity.userId, candidate, approvalReceiptId }
}

function confidenceFor(proposal: DecisionProposal): number {
  return proposal.uncertainty.length === 0 ? 0.75 : 0.5
}
