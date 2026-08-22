import {
  InMemoryApprovalReceiptStore,
  type ActionPolicy,
  type ApprovalReceiptStore,
  type SupabaseAuditLedger,
} from "@jhadina/action-core"
import { IntelligenceRouter, type IntelligenceRouterEvent } from "@jhadina/intelligence-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { buildContext, type ContextBuilderDeps, type ContextBuilderLimits } from "../context/context-builder"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { getStorage } from "../routes/handlers"
import type { JhadinaWorldId } from "../jhadina/jhadina-world-registry"
import { createIntelligenceAuditLedger } from "./durable-audit-ledger"
import {
  decideAndProposeMemoryGoverned,
  type GovernedIntelligenceProposalResult,
} from "./governed-intelligence-proposal"
import { MEMORY_PROPOSE_CAPABILITY, type MemoryProposeAction } from "./memory-propose-capability"
import { createProductionIntelligenceRouter } from "./production-model-provider"

/**
 * Phase 1 Step 5 — instantiate the Jhadina operating loop.
 *
 *   Observe   -- a Jhadina command is received (this function's input)
 *   Remember  -- relevant durable memory assembled by the Context Builder
 *   Understand-- a bounded ContextPacket assembled (Step 4, real, not a
 *                hand-built fake)
 *   Decide    -- IntelligenceRouter proposes (Step 3, real)
 *   Authorize -- SecurityCoreActionPolicy evaluates; ApprovalReceipt
 *                requested/consumed if required (Step 3, real)
 *   Act       -- ActionExecutor executes the fixed memory.propose
 *                capability (Step 3, real)
 *   Verify    -- durable read-back confirms the action actually landed
 *                (new in this milestone — see below)
 *   Learn     -- the resulting observation reaches Memory Core as a
 *                PENDING candidate; it does not become durable approved
 *                memory without the human approve/reject step Step 2
 *                already established
 *
 * This file is pure composition of already-real pieces. It is not a new
 * executor, policy engine, audit ledger, or memory abstraction — it
 * calls `decideAndProposeMemoryGoverned` (Step 3) directly rather than
 * through `runGovernedIntelligenceProposal` (its usual entry point) only
 * so this function can retain the same `ledger` reference for the new
 * Verify stage's audit event; the governed lifecycle itself
 * (identity -> decide -> policy -> approval -> execute -> audit) is
 * byte-for-byte the same call Step 3 already tests.
 *
 * `@jhadina/core-spine`'s `JhadinaSpine`/`createJhadinaSpine()` is
 * deliberately NOT instantiated here. See the architectural note at the
 * bottom of this file.
 */

export interface JhadinaCommandInput {
  userId: string
  activeTask: string
  surface?: JhadinaWorldId
  route?: string
  activeProject?: string
  memoryRelevanceQuery?: string
  contextLimits?: Partial<ContextBuilderLimits>
}

export interface JhadinaCommandOverrides {
  identityVerifier?: JhadinaIdentityVerifier
  ledger?: SupabaseAuditLedger
  router?: IntelligenceRouter
  approvalStore?: ApprovalReceiptStore
  /** Test-only escape hatch — production always uses the real base Security
   * Core policy (decideAndProposeMemoryGoverned's own default). Exposed here
   * only so tests can exercise deny/approval-required paths without a second
   * policy mechanism. */
  policy?: ActionPolicy<MemoryProposeAction>
  onEvent?: (event: IntelligenceRouterEvent) => void
}

export interface JhadinaCommandResult extends GovernedIntelligenceProposalResult {
  /** True whenever there was nothing to verify (no PROCEED action ran) or the
   * executed action's effect was durably confirmed by an independent read-back. */
  verified: boolean
  verificationReason?: string
}

const defaultApprovalStore = new InMemoryApprovalReceiptStore()

export async function handleJhadinaCommand(
  input: JhadinaCommandInput,
  overrides: JhadinaCommandOverrides = {},
): Promise<JhadinaCommandResult> {
  // -- Observe / Remember / Understand: real storage, real Context Builder --
  const storage = getStorage()
  const memoryRepo = new MemoryRepository(storage)
  const reasoningRepo = new ReasoningEventRepository(storage)
  const contextDeps: ContextBuilderDeps = {
    memoryRepo,
    timelineRepo: new TimelineRepository(storage),
  }
  const assembled = await buildContext(contextDeps, {
    userId: input.userId,
    activeTask: input.activeTask,
    surface: input.surface,
    route: input.route,
    activeProject: input.activeProject,
    memoryRelevanceQuery: input.memoryRelevanceQuery,
    limits: input.contextLimits,
  })

  // -- Decide / Authorize / Act: the exact Step 3 governed lifecycle --------
  const identityVerifier = overrides.identityVerifier ?? (await createRequestIdentityVerifier())
  const ledger = overrides.ledger ?? (await createIntelligenceAuditLedger())
  const router = overrides.router ?? createProductionIntelligenceRouter(overrides.onEvent)
  const approvalStore = overrides.approvalStore ?? defaultApprovalStore

  const result = await decideAndProposeMemoryGoverned(
    { identityVerifier, ledger, router, memoryRepo, reasoningRepo, approvalStore, policy: overrides.policy },
    input.userId,
    assembled.contextPacket,
  )

  // -- Verify: an independent durable read-back, not just trusting the
  // handler's return value. A PENDING candidate must actually be
  // findable, for this exact user, with the exact content that was
  // executed -- otherwise the audit trail says "completed" while nothing
  // real happened, which fail-closed behavior must not allow to pass
  // silently.
  if (!result.candidate) {
    // ASK/DECLINE/DEFER, or policy/approval never reached execution --
    // there is nothing to verify. Trivially verified, not silently skipped.
    return { ...result, verified: true, verificationReason: "no action was executed for this proposal" }
  }

  const verification = await verifyCandidateDurable(memoryRepo, result.verifiedUserId, result.candidate)
  const verifyEventId = `verify:${result.candidate.id}:${Date.now()}`
  await ledger.append({
    id: verifyEventId,
    actionId: result.candidate.id,
    userId: result.verifiedUserId,
    type: MEMORY_PROPOSE_CAPABILITY,
    status: verification.verified ? "completed" : "failed",
    timestamp: new Date().toISOString(),
    metadata: { stage: "verify", reason: verification.reason ?? "durable read-back matched executed content" },
  })

  if (!verification.verified) {
    throw new Error(`JHADINA_COMMAND_VERIFICATION_FAILED:${verification.reason}`)
  }

  return { ...result, verified: true, verificationReason: verification.reason }
}

async function verifyCandidateDurable(
  memoryRepo: MemoryRepository,
  userId: string,
  candidate: NonNullable<GovernedIntelligenceProposalResult["candidate"]>,
): Promise<{ verified: boolean; reason?: string }> {
  // Reuses MemoryRepository's existing public read surface (listPending)
  // rather than reaching into storage directly or adding a new method --
  // the same repository Step 2 already built and Step 3 already writes
  // through.
  const pending = await memoryRepo.listPending(userId, 1000)
  const found = pending.find((c) => c.id === candidate.id)

  if (!found) {
    return { verified: false, reason: "candidate not found in durable storage after execution" }
  }
  if (found.status !== "PENDING") {
    return { verified: false, reason: `candidate status is ${found.status}, expected PENDING` }
  }
  if (found.content !== candidate.content) {
    return { verified: false, reason: "candidate content mismatch on read-back" }
  }
  return { verified: true }
}

/**
 * ARCHITECTURAL NOTE — why JhadinaSpine/createJhadinaSpine is not called
 * here, discovered while building this milestone, not guessed at
 * beforehand:
 *
 * core-spine's `SpinePorts` requires `PolicyPort.evaluate(proposal):
 * Promise<PolicyDecision>` and `ActionPort.prepare/execute` using
 * core-spine's OWN `ActionRequest`/`ActionResult`/`PolicyDecision`
 * shapes -- which are structurally different from, and not losslessly
 * convertible to, the real concrete types this file actually uses
 * (action-core's `ActionRequest<T>`/`ActionPolicyDecision`,
 * `SecurityCoreActionPolicy`, `ActionExecutor`). core-spine's
 * `ActionRequest`, for example, requires `operation`/`input`/
 * `reversible`/`consequenceLevel` fields that have no equivalent
 * anywhere in the real governed-action pipeline today. JH-046 already
 * named this exact duplication ("a third shape of the same concept
 * already exists in jhadina-action-core") as a known, unresolved
 * overlap -- it did not resolve it, and this milestone does not either.
 *
 * Writing a `PolicyPort`/`ActionPort` adapter here to force this real,
 * tested, working pipeline through `createJhadinaSpine()`'s literal
 * signature would mean either inventing fields with no real meaning
 * (fabricating `reversible`/`consequenceLevel` for memory.propose) or
 * silently dropping real behavior (the approval-receipt mechanics,
 * which `ActionPort` has no representation for at all) -- exactly the
 * kind of "claim something is implemented merely because an interface
 * exists" this whole engagement has been instructed to avoid. `Decision`/
 * `Context` (this milestone) are the two ports that already match
 * cleanly (`IntelligenceRouter implements DecisionPort`; this file's
 * `assembled.contextPacket` is exactly a `ContextPacket`) -- the
 * mismatch is specifically `PolicyPort`/`ActionPort`, not the whole
 * pipeline. Reconciling that (either adapting the concrete types to
 * core-spine's abstract ones, or revising core-spine's ports to match
 * what's actually real) is Step 6-or-later work, named here rather than
 * silently worked around.
 */
