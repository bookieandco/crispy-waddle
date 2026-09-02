import type { ContextPacket } from "@jhadina/core-spine"
import { IntelligenceRouter, type IntelligenceRouterEvent } from "@jhadina/intelligence-core"
import { SupabaseNonceReplayGuard, type ApprovalReceiptStore, type ActionAuditEvent, type SupabaseAuditLedger } from "@jhadina/action-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { getStorage } from "../routes/handlers"
import { createProductionIntelligenceRouter } from "./production-model-provider"
import { createIntelligenceAuditLedger, createIntelligenceAuditRpcClient, INTELLIGENCE_AUDIT_DOMAIN } from "./durable-audit-ledger"
import { createDurableApprovalReceiptStore } from "../security/durable-approval-receipt-store"
import { decideAndProposeMemoryGoverned, type GovernedIntelligenceProposalResult } from "./governed-intelligence-proposal"

export type GovernedIntelligenceRuntimeOverrides = {
  identityVerifier?: JhadinaIdentityVerifier
  ledger?: SupabaseAuditLedger
  router?: IntelligenceRouter
  approvalStore?: ApprovalReceiptStore
  replayGuard?: InstanceType<typeof SupabaseNonceReplayGuard>
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
  const approvalStore = overrides.approvalStore ?? (await createDurableApprovalReceiptStore())
  const replayGuard = overrides.replayGuard ?? new SupabaseNonceReplayGuard(await createIntelligenceAuditRpcClient())

  return decideAndProposeMemoryGoverned(
    { identityVerifier, ledger, router, memoryRepo, reasoningRepo, approvalStore, replayGuard },
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
