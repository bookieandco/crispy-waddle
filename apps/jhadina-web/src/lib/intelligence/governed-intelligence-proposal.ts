import {
  ActionExecutor,
  createBaseSecurityCoreActionPolicy,
  type ActionLedger,
  type ActionPolicy,
  type ActionRequest,
} from "@jhadina/action-core"
import type { ContextPacket, DecisionProposal } from "@jhadina/core-spine"
import type { IntelligenceRouter } from "@jhadina/intelligence-core"
import type { ActionRequestIdentity, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import type { MemoryCandidate } from "../storage/InMemoryStorage"
import {
  MEMORY_PROPOSE_CAPABILITY,
  createMemoryProposeHandler,
  type MemoryProposeAction,
} from "./memory-propose-capability"

/**
 * Phase 1 Step 3 — the Intelligence Router's governed lifecycle.
 *
 *   Context -> IntelligenceRouter.decide() -> DecisionProposal ->
 *   [disposition gate] -> ActionRequest (fixed capability) ->
 *   SecurityCoreActionPolicy -> ActionExecutor -> audit
 *
 * This composes only already-landed FOUNDATION infrastructure
 * (@jhadina/action-core, @jhadina/core-spine, @jhadina/intelligence-core)
 * with Step 2's already-durable Memory repositories. No new
 * ActionExecutor, Policy, or audit mechanism — same primitive SP-1/SP-3
 * already proved twice.
 *
 * The governance-critical property: nothing the model says chooses what
 * capability gets requested. `MEMORY_PROPOSE_CAPABILITY` is a hardcoded
 * constant this function references directly — `proposal` (the model's
 * output) is only ever read for `disposition`, `recommendation`, and
 * `rationale`, never for anything resembling a capability, an approval,
 * or a policy decision. A DECLINE/ASK/DEFER disposition stops before any
 * ActionRequest is even constructed; only PROCEED reaches
 * ActionExecutor, and ActionExecutor + SecurityCoreActionPolicy then
 * evaluate that fixed capability exactly as they would for any other
 * caller — the model's recommendation carries no more authority than a
 * human typing the same text into a form field would.
 */
export interface GovernedIntelligenceProposalDeps {
  identityVerifier: JhadinaIdentityVerifier
  ledger: ActionLedger
  router: IntelligenceRouter
  memoryRepo: MemoryRepository
  reasoningRepo: ReasoningEventRepository
  policy?: ActionPolicy<MemoryProposeAction>
}

export interface GovernedIntelligenceProposalResult {
  proposal: DecisionProposal
  verifiedUserId: string
  /** Set only when disposition was PROCEED and the action executed. */
  candidate?: MemoryCandidate
}

export async function decideAndProposeMemoryGoverned(
  deps: GovernedIntelligenceProposalDeps,
  claimedUserId: string,
  context: ContextPacket,
): Promise<GovernedIntelligenceProposalResult> {
  const now = () => new Date().toISOString()
  const actionId = `intelligence-propose:${context.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`

  // 1. Identity context — real session verification, before anything
  // else (the router included) runs.
  let identity: ActionRequestIdentity
  try {
    identity = await deps.identityVerifier.verify({ userId: claimedUserId })
  } catch (error) {
    await deps.ledger.append({
      id: `${actionId}:identity-rejected`,
      actionId,
      userId: claimedUserId,
      type: MEMORY_PROPOSE_CAPABILITY,
      status: "denied",
      timestamp: now(),
      metadata: { stage: "identity", reason: error instanceof Error ? error.message : String(error) },
    })
    throw error
  }

  // 2. The model proposes. This alone changes nothing — no ledger entry,
  // no candidate, no side effect of any kind exists yet.
  let proposal: DecisionProposal
  try {
    proposal = await deps.router.decide(context)
  } catch (error) {
    await deps.ledger.append({
      id: `${actionId}:model-unavailable`,
      actionId,
      userId: identity.userId,
      type: MEMORY_PROPOSE_CAPABILITY,
      status: "failed",
      timestamp: now(),
      metadata: { stage: "decide", reason: error instanceof Error ? error.message : String(error) },
    })
    throw error
  }

  // 3. Disposition gate. ASK/DECLINE/DEFER never become an ActionRequest.
  if (proposal.disposition !== "PROCEED") {
    await deps.ledger.append({
      id: `${actionId}:proposal-not-actioned`,
      actionId,
      userId: identity.userId,
      type: MEMORY_PROPOSE_CAPABILITY,
      status: "completed",
      timestamp: now(),
      metadata: { disposition: proposal.disposition, proposalId: proposal.id },
    })
    return { proposal, verifiedUserId: identity.userId }
  }

  const request: ActionRequest<MemoryProposeAction> = {
    id: actionId,
    userId: identity.userId,
    // Fixed by this function. Never `proposal.<anything>`.
    type: MEMORY_PROPOSE_CAPABILITY,
    action: {
      content: proposal.recommendation,
      rationale: proposal.rationale,
      confidence: confidenceFor(proposal),
    },
    requestedAt: now(),
  }

  // 4/5/6. Policy -> ActionExecutor -> audit — the same primitive
  // Growth (SP-1) and Money (SP-3) already use.
  const policy = deps.policy ?? createBaseSecurityCoreActionPolicy<MemoryProposeAction>()
  const handler = createMemoryProposeHandler(deps.memoryRepo, deps.reasoningRepo)
  const executor = new ActionExecutor(policy, deps.ledger, [handler])
  const candidate = await executor.execute(request)

  return { proposal, verifiedUserId: identity.userId, candidate }
}

function confidenceFor(proposal: DecisionProposal): number {
  // DecisionProposal (core-spine) carries qualitative `uncertainty`
  // strings, not a numeric confidence field — extending that shape is
  // out of this proof's scope. A fixed, conservative default stands in
  // until a real confidence model exists.
  return proposal.uncertainty.length === 0 ? 0.75 : 0.5
}
