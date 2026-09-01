import { SupabaseAuditLedger, SupabaseNonceReplayGuard, type ActionAuditEvent, type ApprovalReceiptStore, type AuditRpcClient } from "@jhadina/action-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { approveGrowthDraftGoverned, type GovernedGrowthApprovalResult } from "./governed-approval"
import { createGrowthAuditLedger, createGrowthAuditRpcClient, GROWTH_AUDIT_DOMAIN } from "./durable-audit-ledger"
import { createDurableApprovalReceiptStore } from "../security/durable-approval-receipt-store"

/** Production composition root for Growth: durable approval receipts and durable one-shot replay protection. */
export type GovernedGrowthRuntimeOverrides = {
  identityVerifier?: JhadinaIdentityVerifier
  ledger?: SupabaseAuditLedger
  approvalStore?: ApprovalReceiptStore
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
  const replayGuard = overrides.replayGuard ?? new SupabaseNonceReplayGuard(await createGrowthAuditRpcClient())
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
