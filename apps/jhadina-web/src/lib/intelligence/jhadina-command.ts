import {
  InMemoryApprovalReceiptStore,
  JhadinaValuesActionPolicy,
  type ActionPolicy,
  type ApprovalReceiptStore,
  type SupabaseAuditLedger,
} from "@jhadina/action-core"
import { JHADINA_BASE_SECURITY_POLICY, JHADINA_DEFAULT_VALUES_CONFIGURATION } from "@jhadina/security-core"
import { IntelligenceRouter, type IntelligenceRouterEvent } from "@jhadina/intelligence-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { buildContext, type ContextBuilderDeps, type ContextBuilderLimits } from "../context/context-builder"
import { getJhadinaApplication } from "../application/createJhadinaApplication"
import { createIntelligenceAuditLedger } from "./durable-audit-ledger"
import {
  decideAndProposeMemoryGoverned,
  type GovernedIntelligenceProposalResult,
} from "./governed-intelligence-proposal"
import { MEMORY_PROPOSE_CAPABILITY, type MemoryProposeAction } from "./memory-propose-capability"
import { createProductionIntelligenceRouter } from "./production-model-provider"
import type { JhadinaWorldId } from "../jhadina/jhadina-world-registry"

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
  verified: boolean
  verificationReason?: string
}

const defaultApprovalStore = new InMemoryApprovalReceiptStore()

export async function handleJhadinaCommand(
  input: JhadinaCommandInput,
  overrides: JhadinaCommandOverrides = {},
): Promise<JhadinaCommandResult> {
  const application = getJhadinaApplication()
  const { memoryRepo, reasoningRepo, timelineRepo } = application

  const contextDeps: ContextBuilderDeps = {
    memoryRepo,
    timelineRepo,
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

  const identityVerifier = overrides.identityVerifier ?? (await createRequestIdentityVerifier())
  const ledger = overrides.ledger ?? (await createIntelligenceAuditLedger())
  const router = overrides.router ?? createProductionIntelligenceRouter(overrides.onEvent)
  const approvalStore = overrides.approvalStore ?? defaultApprovalStore
  const policy = overrides.policy
    ?? new JhadinaValuesActionPolicy<MemoryProposeAction>(JHADINA_BASE_SECURITY_POLICY, JHADINA_DEFAULT_VALUES_CONFIGURATION)

  const result = await decideAndProposeMemoryGoverned(
    { identityVerifier, ledger, router, memoryRepo, reasoningRepo, approvalStore, policy },
    input.userId,
    assembled.contextPacket,
  )

  if (!result.candidate) {
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
  memoryRepo: import("../repositories/MemoryRepository").MemoryRepository,
  userId: string,
  candidate: NonNullable<GovernedIntelligenceProposalResult["candidate"]>,
): Promise<{ verified: boolean; reason?: string }> {
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
 * ARCHITECTURAL NOTE — core-spine is intentionally not instantiated here.
 * Its PolicyPort/ActionPort shapes do not losslessly represent the real
 * action-core approval-receipt lifecycle. Reconciling those duplicated
 * abstractions remains later work rather than fabricating fields or dropping
 * real governance behavior.
 */
