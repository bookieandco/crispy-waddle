import type { ContextPacket } from "@jhadina/core-spine"
import { IntelligenceRouter, type IntelligenceRouterEvent } from "@jhadina/intelligence-core"
import { InMemoryApprovalReceiptStore, type ApprovalReceiptStore } from "@jhadina/action-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { getStorage } from "../routes/handlers"
import { createProductionIntelligenceRouter } from "./production-model-provider"
import { createIntelligenceAuditLedger, INTELLIGENCE_AUDIT_DOMAIN } from "./durable-audit-ledger"
import { createSupabaseLearningRecordRepository } from "../learning/supabase-learning-record-repository"
import {
  decideAndProposeMemoryGoverned,
  type GovernedIntelligenceProposalResult,
} from "./governed-intelligence-proposal"
import type { SupabaseAuditLedger, ActionAuditEvent } from "@jhadina/action-core"

/**
 * Process-local composition root for the Intelligence Router proof.
 * Production execution now injects the server-only durable LearningRecord
 * repository, so successful governed actions become durable learning facts.
 */
const approvalStore = new InMemoryApprovalReceiptStore()

export type GovernedIntelligenceRuntimeOverrides = {
  identityVerifier?: JhadinaIdentityVerifier
  ledger?: SupabaseAuditLedger
  router?: IntelligenceRouter
  approvalStore?: ApprovalReceiptStore
  learningRecordRepository?: ReturnType<typeof createSupabaseLearningRecordRepository>
  onEvent?: (event: IntelligenceRouterEvent) => void
}

export async function runGovernedIntelligenceProposal(
  claimedUserId: string,
  context: ContextPacket,
  overrides: GovernedIntelligenceRuntimeOverrides = {},
): Promise<GovernedIntelligenceProposalResult> {
  const identityVerifier = overrides.identityVerifier ?? (await createRequestIdentityVerifier())
  const ledger = overrides.ledger ?? (await createIntelligenceAuditLedger())
  const router = overrides.router ?? createProductionIntelligenceRouter(overrides.onEvent)
  const storage = getStorage()
  const memoryRepo = new MemoryRepository(storage)
  const reasoningRepo = new ReasoningEventRepository(storage)
  const learningRecordRepository = overrides.learningRecordRepository ?? createSupabaseLearningRecordRepository()

  return decideAndProposeMemoryGoverned(
    {
      identityVerifier,
      ledger,
      router,
      memoryRepo,
      reasoningRepo,
      approvalStore: overrides.approvalStore ?? approvalStore,
      learningRecordRepository,
    },
    claimedUserId,
    context,
  )
}

export interface GovernedIntelligenceActivityResult {
  events: readonly ActionAuditEvent[]
  verifiedUserId: string
}

export async function listGovernedIntelligenceActivity(
  claimedUserId: string,
  overrides: Pick<GovernedIntelligenceRuntimeOverrides, "identityVerifier" | "ledger"> = {},
): Promise<GovernedIntelligenceActivityResult> {
  const identityVerifier = overrides.identityVerifier ?? (await createRequestIdentityVerifier())
  const identity = await identityVerifier.verify({ userId: claimedUserId })

  const ledger = overrides.ledger ?? (await createIntelligenceAuditLedger())
  const events = await ledger.list({ domain: INTELLIGENCE_AUDIT_DOMAIN, actorId: identity.userId })
  return { events, verifiedUserId: identity.userId }
}
