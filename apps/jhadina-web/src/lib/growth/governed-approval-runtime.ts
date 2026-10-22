import { SupabaseAuditLedger, type ActionAuditEvent, type ApprovalReceiptStore } from "@jhadina/action-core"
import { createSupabaseActionApprovalReceiptStore } from "../supabase-action-approval-receipt-store"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { approveGrowthDraftGoverned, type GovernedGrowthApprovalResult } from "./governed-approval"
import { createGrowthAuditLedger, GROWTH_AUDIT_DOMAIN } from "./durable-audit-ledger"

/** Request-scoped production Growth approval composition. Receipts are
 * durably created/approved/consumed by auth.uid()-bound atomic DB functions.
 * Test overrides never affect production defaults. */
export type GovernedGrowthRuntimeOverrides = {
  /** Test-only: createRequestIdentityVerifier() makes a real Supabase call with no meaning outside a real request. */
  identityVerifier?: JhadinaIdentityVerifier
  /** Test-only: substitutes a SupabaseAuditLedger wrapping a fake RPC client instead of a live database. */
  ledger?: SupabaseAuditLedger
  /** Test-only: inject the approval store without a live database. */
  approvalStore?: ApprovalReceiptStore
}

export async function runGovernedGrowthDraftApproval(
  claimedUserId: string,
  draftId: string,
  overrides: GovernedGrowthRuntimeOverrides = {},
): Promise<GovernedGrowthApprovalResult> {
  const identityVerifier = overrides.identityVerifier ?? (await createRequestIdentityVerifier())
  const ledger = overrides.ledger ?? (await createGrowthAuditLedger())
  return approveGrowthDraftGoverned({ identityVerifier, ledger, approvalStore: overrides.approvalStore ?? createSupabaseActionApprovalReceiptStore() }, claimedUserId, draftId)
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
