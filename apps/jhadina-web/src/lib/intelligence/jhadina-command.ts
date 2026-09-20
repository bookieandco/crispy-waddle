import {
  InMemoryApprovalReceiptStore,
  JhadinaValuesActionPolicy,
  type ActionPolicy,
  type ApprovalReceiptStore,
  type SupabaseAuditLedger,
} from "@jhadina/action-core"
import { JHADINA_BASE_SECURITY_POLICY, JHADINA_DEFAULT_VALUES_CONFIGURATION } from "@jhadina/security-core"
import { IntelligenceRouter, type IntelligenceRouterEvent } from "@jhadina/intelligence-core"
import type { SpatialContextProvider } from "../context/context-builder"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { buildContext, type ContextBuilderDeps, type ContextBuilderLimits } from "../context/context-builder"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { getStorage } from "../routes/handlers"
import type { JhadinaWorldId } from "../jhadina/jhadina-world-registry"
import { createIntelligenceAuditLedger } from "./durable-audit-ledger"
import { decideAndProposeMemoryGoverned, type GovernedIntelligenceProposalResult } from "./governed-intelligence-proposal"
import { MEMORY_PROPOSE_CAPABILITY, type MemoryProposeAction } from "./memory-propose-capability"
import { createProductionIntelligenceRouter } from "./production-model-provider"
import { createProductionSpatialContextProvider } from "../context/production-spatial-context-provider"

export interface JhadinaCommandInput {
  userId: string
  activeTask: string
  surface?: JhadinaWorldId
  route?: string
  activeProject?: string
  memoryRelevanceQuery?: string
  geographicScope?: unknown
  temporalScope?: { from: string | null; to: string | null; asOf: string | null }
  contextLimits?: Partial<ContextBuilderLimits>
}

export interface JhadinaCommandOverrides {
  identityVerifier?: JhadinaIdentityVerifier
  ledger?: SupabaseAuditLedger
  router?: IntelligenceRouter
  approvalStore?: ApprovalReceiptStore
  policy?: ActionPolicy<MemoryProposeAction>
  onEvent?: (event: IntelligenceRouterEvent) => void
  /** Read-only spatial adapter. It is the only permitted entry from Ask Jhadina into spatial intelligence. */
  spatialContextProvider?: SpatialContextProvider
}

export interface JhadinaCommandResult extends GovernedIntelligenceProposalResult {
  verified: boolean
  verificationReason?: string
}

const defaultApprovalStore = new InMemoryApprovalReceiptStore()

export async function handleJhadinaCommand(input: JhadinaCommandInput, overrides: JhadinaCommandOverrides = {}): Promise<JhadinaCommandResult> {
  const storage = getStorage()
  const memoryRepo = new MemoryRepository(storage)
  const reasoningRepo = new ReasoningEventRepository(storage)
  const spatialContextProvider = overrides.spatialContextProvider ?? createProductionSpatialContextProvider(input.userId)
  const contextDeps: ContextBuilderDeps = {
    memoryRepo,
    timelineRepo: new TimelineRepository(storage),
    spatialContextProvider,
  }
  const assembled = await buildContext(contextDeps, {
    userId: input.userId,
    activeTask: input.activeTask,
    surface: input.surface,
    route: input.route,
    activeProject: input.activeProject,
    memoryRelevanceQuery: input.memoryRelevanceQuery,
    geographicScope: input.geographicScope,
    temporalScope: input.temporalScope,
    limits: input.contextLimits,
  })

  const identityVerifier = overrides.identityVerifier ?? (await createRequestIdentityVerifier())
  const ledger = overrides.ledger ?? (await createIntelligenceAuditLedger())
  const router = overrides.router ?? createProductionIntelligenceRouter(overrides.onEvent)
  const approvalStore = overrides.approvalStore ?? defaultApprovalStore
  const policy = overrides.policy ?? new JhadinaValuesActionPolicy<MemoryProposeAction>(JHADINA_BASE_SECURITY_POLICY, JHADINA_DEFAULT_VALUES_CONFIGURATION)

  const result = await decideAndProposeMemoryGoverned(
    { identityVerifier, ledger, router, memoryRepo, reasoningRepo, approvalStore, policy },
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

async function verifyCandidateDurable(memoryRepo: MemoryRepository, userId: string, candidate: NonNullable<GovernedIntelligenceProposalResult["candidate"]>): Promise<{ verified: boolean; reason?: string }> {
  const pending = await memoryRepo.listPending(userId, 1000)
  const found = pending.find((c) => c.id === candidate.id)
  if (!found) return { verified: false, reason: "candidate not found in durable storage after execution" }
  if (found.status !== "PENDING") return { verified: false, reason: `candidate status is ${found.status}, expected PENDING` }
  if (found.content !== candidate.content) return { verified: false, reason: "candidate content mismatch on read-back" }
  return { verified: true }
}

/**
 * Policy/action execution remains in the existing governed pipeline. This command layer only composes
 * the read-only spatial contribution into the canonical ContextPacket; it does not create a spatial
 * executor, policy engine, or alternate authority boundary.
 */
