import { SupabaseAuditLedger, SupabaseNonceReplayGuard, type ActionAuditEvent, type ApprovalReceiptStore, type AuditRpcClient } from "@jhadina/action-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { approveGrowthDraftGoverned, type GovernedGrowthApprovalResult } from "./governed-approval"
import { createGrowthAuditLedger, createGrowthAuditRpcClient, GROWTH_AUDIT_DOMAIN } from "./durable-audit-ledger"
import { createDurableApprovalReceiptStore } from "../security/durable-approval-receipt-store"

/**
 * Production composition root for the Growth approval spine.
 *
 * Approval receipts and one-shot action replay protection are durable in
 * Supabase. Tests may inject both stores explicitly; production has no
 * process-local approval/replay fallback.
 */
export type GovernedGrowthRuntimeOverrides = {
  /** Test-only: createRequestIdentityVerifier() makes a real Supabase call with no meaning outside a real request. */
  identityVerifier?: JhadinaIdentityVerifier
  /** Test-only: substitutes a SupabaseAuditLedger wrapping a fake RPC client instead of a live database. */
  ledger?: SupabaseAuditLedger
  /** Test-only: substitutes an in-memory/fake receipt store; production defaults to Supabase. */
  approvalStore?: ApprovalReceiptStore
  /** Test-only: substitutes the durable replay guard. */
  replayGuard?: SupabaseNonceReplayGuard
}

export async function runGovernedGrowthDraftApproval(
  claimedUserId: string,
  draftId: string,
  overrides: GovernedGrowthRuntimeOverrides = {},
): Promise<GovernedGrowthApprovalResult> {
  const identityVerifier = overrides.identityVerifier ?? (await createRequestIdentityVerifier())
  const ledger = overrides.ledger ?? (await createGrowthAuditLedger())
  const approvalStore = overrides.approvalStore ?? (await createDurableApprovalReceiptStore())
  const replayRpc: AuditRpcClient = await createGrowthAuditRpcClient()
  const replayGuard = overrides.replayGuard ?? new SupabaseNonceReplayGuard(replayRpc)
  return approveGrowthDraftGoverned({ identityVerifier, ledger, approvalStore, replayGuard }, claimedUserId, draftId)
}

export interface GovernedGrowthActivityResult {
  events: readonly ActionAuditEvent[]
  verifiedUserId: string
}

export async function listGovernedGrowthActivity(
  claimedUserId: string,
  overrides: GovernedGrowthRuntimeOverrides = {},
): Promise<GovernedGrowthActivityResult> {
  const identityVerifier = overrides.identityVerifier ?? (await createRequestIdentityVerifier())
  const identity = await identityVerifier.verify({ userId: claimedUserId })

  const ledger = overrides.ledger ?? (await createGrowthAuditLedger())
  const events = await ledger.list({ domain: GROWTH_AUDIT_DOMAIN, actorId: identity.userId })
  return { events, verifiedUserId: identity.userId }
}