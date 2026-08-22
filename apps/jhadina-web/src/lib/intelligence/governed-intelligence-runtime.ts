import type { ContextPacket } from "@jhadina/core-spine"
import { IntelligenceRouter, type IntelligenceRouterEvent } from "@jhadina/intelligence-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { getStorage } from "../routes/handlers"
import { createProductionIntelligenceRouter } from "./production-model-provider"
import { createIntelligenceAuditLedger, INTELLIGENCE_AUDIT_DOMAIN } from "./durable-audit-ledger"
import {
  decideAndProposeMemoryGoverned,
  type GovernedIntelligenceProposalResult,
} from "./governed-intelligence-proposal"
import type { SupabaseAuditLedger, ActionAuditEvent } from "@jhadina/action-core"

/**
 * Process-local composition root for the Intelligence Router proof —
 * same shape as Growth's governed-approval-runtime.ts. Not yet mounted
 * behind an HTTP route: Step 3's scope is the router and its governance
 * wiring, not "Ask Jhadina" (Step 7), which needs a real Context Builder
 * (Step 4) to supply `ContextPacket`s from live requests. This function
 * is the callable, tested seam Step 7 will mount.
 */
export type GovernedIntelligenceRuntimeOverrides = {
  identityVerifier?: JhadinaIdentityVerifier
  ledger?: SupabaseAuditLedger
  router?: IntelligenceRouter
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

  return decideAndProposeMemoryGoverned(
    { identityVerifier, ledger, router, memoryRepo, reasoningRepo },
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
