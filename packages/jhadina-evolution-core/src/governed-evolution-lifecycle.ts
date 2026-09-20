import {
  ActionExecutor,
  JhadinaValuesActionPolicy,
  createApprovalRequestService,
  createApprovalReceiptVerifier,
  type ActionHandler,
  type ActionIdentityVerifier,
  type ActionLedger,
  type ActionPolicy,
  type ApprovalReceiptStore,
} from "@jhadina/action-core"
import { JHADINA_DEFAULT_VALUES_CONFIGURATION, type JhadinaValuesConfiguration } from "@jhadina/security-core"
import type { EvolutionPort, ImprovementEvaluation, ImprovementInput, ImprovementProposal } from "@jhadina/core-spine"
import { EVOLUTION_MERGE_CAPABILITY, EVOLUTION_PROPOSE_CAPABILITY, EVOLUTION_SECURITY_POLICY } from "./evolution-security-policy"

/**
 * Step 9 — the governed Evolution/Builder lifecycle: propose -> (human
 * approval) -> merge, built entirely from primitives every other
 * governed domain (Growth, Money, Commerce) already uses. No new
 * policy engine, approval mechanism, or ledger is introduced here:
 *
 *   - ActionExecutor (jhadina-action-core): the same generic
 *     policy -> receipt -> handler -> audit executor Growth's own
 *     governed-approval.ts already uses directly (not
 *     VerifiedActionExecutor — see the note below).
 *   - JhadinaValuesActionPolicy (Step 7): combines the base
 *     SecurityCoreActionPolicy(EVOLUTION_SECURITY_POLICY) decision with
 *     the already-merged risk-boundary decision via "most restrictive
 *     wins." Neither this file nor evolution-security-policy.ts
 *     modifies risk-boundary-policy.ts's math in any way.
 *   - ApprovalReceiptStore + createApprovalRequestService/
 *     createApprovalReceiptVerifier (jhadina-action-core): the same
 *     durable, expiring, single-use, identity-bound receipt primitive
 *     Commerce's Phase 4.6/4.7 already proved live.
 *   - EvolutionPort (core-spine) + GovernedEvolutionPromoter
 *     (governed-promoter.ts, unmodified): analyze()/promote() are
 *     called exactly as already built — this file adds no new
 *     execution path into either.
 *
 * Deliberately NOT using VerifiedActionExecutor: that class's own
 * internal ActionExecutor is constructed without an approvalReceipts
 * argument (see verified-action-executor.ts), so it can never complete
 * an approval_required decision — exactly the gap that would make
 * evolution.propose/evolution.merge silently unusable again. This file
 * follows Growth's own governed-approval.ts precedent instead: identity
 * is verified manually, then the raw ActionExecutor is constructed with
 * the approval-receipt verifier attached.
 *
 * Both capabilities require an explicit approval receipt today — not
 * just evolution.merge. That is inherited, unmodified, from Step 7's
 * already-merged risk-boundary-policy.ts (evolution.propose's own
 * category, code_evolution alone, never reaches the plain 'allow'
 * branch; it is 'approval_required' whenever proposals are enabled at
 * all, 'deny' otherwise). Step 9 does not loosen or re-derive that
 * decision — it only makes the capability reachable at the base-policy
 * layer, which previously denied it unconditionally regardless of the
 * risk-boundary result (see evolution-security-policy.ts's own header).
 *
 * No production composition (a runtime.ts wiring a real identity
 * verifier, a durable Supabase ledger, and a real EvolutionPort backed
 * by an actual repository-mutating GovernedRepairExecutor) is built in
 * this milestone — there is no real concrete EvolutionAnalyzer/
 * EvolutionEvaluator/GovernedRepairExecutor implementation anywhere in
 * this repository today (confirmed by search before writing this file);
 * every existing use of GovernedEvolutionPromoter/JhadinaEvolutionAdapter
 * is in that package's own tests, against fakes. This file and its
 * tests are held to the same standard: proven end to end against a
 * fake EvolutionPort, never a real one. Wiring a real one, and any
 * route/trigger that could dispatch it, is explicitly out of scope
 * here and would be a separate, later, explicitly-authorized step.
 */

export interface EvolutionProposeAction {
  input: ImprovementInput
}

export interface EvolutionMergeAction {
  proposal: ImprovementProposal
  evaluation: ImprovementEvaluation
}

export function createEvolutionProposeHandler(port: EvolutionPort): ActionHandler<EvolutionProposeAction, ImprovementProposal> {
  return {
    supports: (type) => type === EVOLUTION_PROPOSE_CAPABILITY,
    async execute(action) {
      return port.analyze(action.input)
    },
  }
}

/** promote() returns void; ActionExecutor still needs a handler result, so this resolves the proposal itself as confirmation. */
export function createEvolutionMergeHandler(port: EvolutionPort): ActionHandler<EvolutionMergeAction, ImprovementProposal> {
  return {
    supports: (type) => type === EVOLUTION_MERGE_CAPABILITY,
    async execute(action) {
      await port.promote(action.proposal, action.evaluation)
      return action.proposal
    },
  }
}

export interface GovernedEvolutionDeps {
  identityVerifier: ActionIdentityVerifier
  ledger: ActionLedger
  approvalStore: ApprovalReceiptStore
  evolutionPort: EvolutionPort
  values?: JhadinaValuesConfiguration
  policy?: ActionPolicy<EvolutionProposeAction | EvolutionMergeAction>
}

export interface GovernedEvolutionProposeResult {
  proposal: ImprovementProposal
  verifiedUserId: string
  approvalReceiptId: string
}

export interface GovernedEvolutionMergeResult {
  proposal: ImprovementProposal
  verifiedUserId: string
  approvalReceiptId: string
}

function buildPolicy(
  deps: Pick<GovernedEvolutionDeps, "policy" | "values">,
): ActionPolicy<EvolutionProposeAction | EvolutionMergeAction> {
  return (
    deps.policy ??
    new JhadinaValuesActionPolicy<EvolutionProposeAction | EvolutionMergeAction>(
      EVOLUTION_SECURITY_POLICY,
      deps.values ?? JHADINA_DEFAULT_VALUES_CONFIGURATION,
    )
  )
}

/** Deterministic per proposal — bound to a fixed action id, never a caller-supplied one. */
function fingerprintFor(actionId: string, capability: string): string {
  return `evolution:${capability}:${actionId}`
}

/**
 * Stage 1: propose. Requires a real, server-verified identity and an
 * explicit approval receipt (see this file's header on why proposing
 * is receipt-gated too, not just merging) before EvolutionPort.analyze()
 * ever runs. Never merges, never promotes, never touches a repository.
 */
export async function proposeEvolutionGoverned(
  deps: GovernedEvolutionDeps,
  claimedUserId: string,
  input: ImprovementInput,
): Promise<GovernedEvolutionProposeResult> {
  const identity = await deps.identityVerifier.verify({
    id: `evolution-propose-identity:${claimedUserId}:${Date.now()}`,
    userId: claimedUserId,
    type: EVOLUTION_PROPOSE_CAPABILITY,
    action: { input },
    requestedAt: new Date().toISOString(),
  })
  if (identity.userId !== claimedUserId) throw new Error("Action identity mismatch")

  const actionId = `evolution-propose:${input.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
  const fingerprint = fingerprintFor(actionId, EVOLUTION_PROPOSE_CAPABILITY)
  const policy = buildPolicy(deps)

  const request = {
    id: actionId,
    userId: identity.userId,
    type: EVOLUTION_PROPOSE_CAPABILITY,
    action: { input },
    requestedAt: new Date().toISOString(),
  }

  const decision = await policy.evaluate(request)
  if (decision === "deny") {
    await deps.ledger.append({
      id: `${actionId}:denied`,
      actionId,
      userId: identity.userId,
      type: EVOLUTION_PROPOSE_CAPABILITY,
      status: "denied",
      timestamp: new Date().toISOString(),
    })
    throw new Error(`Action denied by policy: ${EVOLUTION_PROPOSE_CAPABILITY}`)
  }

  // No automatic approval path exists here: reaching this line already
  // required a distinct, explicit, authenticated call to this function.
  // request+approve here is the human's approval act itself, mirroring
  // Growth's own governed-approval.ts precedent exactly.
  const approvalService = createApprovalRequestService<EvolutionProposeAction>(deps.approvalStore, () => fingerprint)
  const pending = await approvalService.requestApproval(request)
  const approved = await approvalService.approve(pending.id, identity.userId)

  const approvalVerifier = createApprovalReceiptVerifier<EvolutionProposeAction>(deps.approvalStore, () => fingerprint)
  const executor = new ActionExecutor<EvolutionProposeAction, ImprovementProposal>(
    policy,
    deps.ledger,
    [createEvolutionProposeHandler(deps.evolutionPort)],
    approvalVerifier,
  )

  const proposal = await executor.execute({ ...request, approvalReceiptId: approved.id })
  return { proposal, verifiedUserId: identity.userId, approvalReceiptId: approved.id }
}

/**
 * Stage 2: merge. Requires its own distinct, explicit approval receipt
 * — a propose approval never authorizes a merge, and vice versa; the
 * fingerprint binds to this specific proposal id and this capability
 * only. Only once ActionExecutor has verified and consumed that receipt
 * does GovernedEvolutionPromoter.promote() (via EvolutionPort.promote())
 * ever run — the same already-built, already-tested promotion pipeline,
 * completely unmodified.
 */
export async function mergeEvolutionGoverned(
  deps: GovernedEvolutionDeps,
  claimedUserId: string,
  proposal: ImprovementProposal,
  evaluation: ImprovementEvaluation,
): Promise<GovernedEvolutionMergeResult> {
  const identity = await deps.identityVerifier.verify({
    id: `evolution-merge-identity:${claimedUserId}:${Date.now()}`,
    userId: claimedUserId,
    type: EVOLUTION_MERGE_CAPABILITY,
    action: { proposal, evaluation },
    requestedAt: new Date().toISOString(),
  })
  if (identity.userId !== claimedUserId) throw new Error("Action identity mismatch")

  const actionId = `evolution-merge:${proposal.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
  const fingerprint = fingerprintFor(actionId, EVOLUTION_MERGE_CAPABILITY)
  const policy = buildPolicy(deps)

  const request = {
    id: actionId,
    userId: identity.userId,
    type: EVOLUTION_MERGE_CAPABILITY,
    action: { proposal, evaluation },
    requestedAt: new Date().toISOString(),
  }

  const decision = await policy.evaluate(request)
  if (decision === "deny") {
    await deps.ledger.append({
      id: `${actionId}:denied`,
      actionId,
      userId: identity.userId,
      type: EVOLUTION_MERGE_CAPABILITY,
      status: "denied",
      timestamp: new Date().toISOString(),
    })
    throw new Error(`Action denied by policy: ${EVOLUTION_MERGE_CAPABILITY}`)
  }

  const approvalService = createApprovalRequestService<EvolutionMergeAction>(deps.approvalStore, () => fingerprint)
  const pending = await approvalService.requestApproval(request)
  const approved = await approvalService.approve(pending.id, identity.userId)

  const approvalVerifier = createApprovalReceiptVerifier<EvolutionMergeAction>(deps.approvalStore, () => fingerprint)
  const executor = new ActionExecutor<EvolutionMergeAction, ImprovementProposal>(
    policy,
    deps.ledger,
    [createEvolutionMergeHandler(deps.evolutionPort)],
    approvalVerifier,
  )

  const merged = await executor.execute({ ...request, approvalReceiptId: approved.id })
  return { proposal: merged, verifiedUserId: identity.userId, approvalReceiptId: approved.id }
}
