import { SupabaseAuditLedger, type ActionAuditEvent, type ApprovalReceiptStore } from "@jhadina/action-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { approveGrowthDraftGoverned, type GovernedGrowthApprovalResult } from "./governed-approval"
import { createGrowthAuditLedger, GROWTH_AUDIT_DOMAIN } from "./durable-audit-ledger"
import { createDurableApprovalReceiptStore } from "../security/durable-approval-receipt-store"

/**
 * Production composition root for the Growth approval spine.
 *
 * Approval receipts are durable in Supabase. Tests may inject an
 * ApprovalReceiptStore explicitly; there is no process-local production
 * receipt store.
 */
export type GovernedGrowthRuntimeOverrides = {
  /** Test-only: createRequestIdentityVerifier() makes a real Supabase call with no meaning outside a real request. */
  identityVerifier?: JhadinaIdentityVerifier
  /** Test-only: substitutes a SupabaseAuditLedger wrapping a fake RPC client instead of a live database. */
  ledger?: SupabaseAuditLedger
  /** Test-only: substitutes an in-memory/fake receipt store; production defaults to Supabase. */
  approvalStore?: ApprovalReceiptStore
}

export async function runGovernedGrowthDraftApproval(
  claimedUserId: string,
  draftId: string,
  overrides: GovernedGrowthRuntimeOverrides = {},
): Promise<GovernedGrowthApprovalResult> {
  const identityVerifier = overrides.identityVerifier ?? (await createRequestIdentityVerifier())
  const ledger = overrides.ledger ?? (await createGrowthAuditLedger())
  const approvalStore = overrides.approvalStore ?? (await createDurableApprovalReceiptStore())
  return approveGrowthDraftGoverned({ identityVerifier, ledger, approvalStore }, claimedUserId, draftId)
}

export interface GovernedGrowthActivityResult {
  events: readonly ActionAuditEvent[]
  verifiedUserId: string
}

/**
 * Activity Timeline's read boundary. Identity-gated the same way
 * approval is — a caller only ever sees their own governed Growth
 * events, never another user's; the database itself enforces this a
 * second time (list_jhadina_audit_events requires auth.uid() to match
 * the requested actor).
 */
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