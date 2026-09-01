import {
  JhadinaValuesActionPolicy,
  SupabaseApprovalReceiptStore,
  SupabaseNonceReplayGuard,
  type ActionPolicy,
  type ApprovalReceiptStore,
  type SupabaseAuditLedger,
} from "@jhadina/action-core"
import { JHADINA_BASE_SECURITY_POLICY, JHADINA_DEFAULT_VALUES_CONFIGURATION } from "@jhadina/security-core"
import { IntelligenceRouter, type IntelligenceRouterEvent } from "@jhadina/intelligence-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { buildContext, type ContextBuilderDeps, type ContextBuilderLimits } from "../context/context-builder"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { getStorage } from "../routes/handlers"
import type { JhadinaWorldId } from "../jhadina/jhadina-world-registry"
import { createIntelligenceAuditLedger, createIntelligenceAuditRpcClient } from "./durable-audit-ledger"
import { createClient } from "../supabase/server"
import { decideAndProposeMemoryGoverned, type GovernedIntelligenceProposalResult } from "./governed-intelligence-proposal"
import { MEMORY_PROPOSE_CAPABILITY, type MemoryProposeAction } from "./memory-propose-capability"
import { createProductionIntelligenceRouter } from "./production-model-provider"

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
  replayGuard?: InstanceType<typeof SupabaseNonceReplayGuard>
  policy?: ActionPolicy<MemoryProposeAction>
  onEvent?: (event: IntelligenceRouterEvent) => void
}

export interface JhadinaCommandResult extends GovernedIntelligenceProposalResult {
  verified: boolean
  verificationReason?: string
}

export async function handleJhadinaCommand(
  input: JhadinaCommandInput,
  overrides: JhadinaCommandOverrides = {},
): Promise<JhadinaCommandResult> {
  const storage = getStorage()
  const memoryRepo = new MemoryRepository(storage)
  const reasoningRepo = new ReasoningEventRepository(storage)
  const contextDeps: ContextBuilderDeps = { memoryRepo, timelineRepo: new TimelineRepository(storage) }
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
  const approvalStore = overrides.approvalStore ?? new SupabaseApprovalReceiptStore(await createClient())
  const replayGuard = overrides.replayGuard ?? new SupabaseNonceReplayGuard(await createIntelligenceAuditRpcClient())
  const policy = overrides.policy ?? new JhadinaValuesActionPolicy<MemoryProposeAction>(
    JHADINA_BASE_SECURITY_POLICY,
    JHADINA_DEFAULT_VALUES_CONFIGURATION,
  )

  const result = await decideAndProposeMemoryGoverned(
    { identityVerifier, ledger, router, memoryRepo, reasoningRepo, approvalStore, replayGuard, policy },
    input.userId,
    assembled.contextPacket,
  )

  if (!result.candidate) return { ...result, verified: true, verificationReason: "no action was executed for this proposal" }

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

  if (!verification.verified) throw new Error(`JHADINA_COMMAND_VERIFICATION_FAILED:${verification.reason}`)
  return { ...result, verified: true, verificationReason: verification.reason }
}

async function verifyCandidateDurable(
  memoryRepo: MemoryRepository,
  userId: string,
  candidate: NonNullable<GovernedIntelligenceProposalResult["candidate"]>,
): Promise<{ verified: boolean; reason?: string }> {
  const pending = await memoryRepo.listPending(userId, 1000)
  const found = pending.find((c) => c.id === candidate.id)
  if (!found) return { verified: false, reason: "candidate not found in durable storage after execution" }
  if (found.status !== "PENDING") return { verified: false, reason: `candidate status is ${found.status}, expected PENDING` }
  if (found.content !== candidate.content) return { verified: false, reason: "candidate content mismatch on read-back" }
  return { verified: true }
}
