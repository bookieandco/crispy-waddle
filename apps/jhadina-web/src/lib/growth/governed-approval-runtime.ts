import { InMemoryActionLedger, type ActionAuditEvent } from "@jhadina/action-core"
import { InMemoryApprovalReceiptStore } from "@jhadina/action-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { approveGrowthDraftGoverned, type GovernedGrowthApprovalResult } from "./governed-approval"

/**
 * Process-local composition root for the Growth approval spine proof.
 *
 * Reference wiring only: an in-memory ledger and approval-receipt store,
 * matching this vertical's current maturity level (Growth drafts
 * themselves are in-memory too — see engine.ts). Swapping in
 * SupabaseAuditLedger (already implemented in @jhadina/action-core) is a
 * one-line change once this proof needs to survive process restarts;
 * doing that isn't part of proving the lifecycle itself.
 *
 * Integration Phase 2: this is the same ledger the Activity Timeline
 * reads back through listGovernedGrowthActivity below — the loop only
 * proves anything if both sides share the same store, which they do
 * (module-level singleton, one process).
 */
const ledger = new InMemoryActionLedger()
const approvalStore = new InMemoryApprovalReceiptStore()

export function getGovernedGrowthApprovalLedger() {
  return ledger
}

/**
 * identityVerifierOverride exists only so tests can exercise this exact
 * composition root (the function API routes actually call) without a
 * live Supabase session — createRequestIdentityVerifier() makes a real
 * server-side Supabase call that has no meaning outside a real request.
 * Production callers (the API routes) never pass it; the real verifier
 * is always used there.
 */
export async function runGovernedGrowthDraftApproval(
  claimedUserId: string,
  draftId: string,
  identityVerifierOverride?: JhadinaIdentityVerifier,
): Promise<GovernedGrowthApprovalResult> {
  const identityVerifier = identityVerifierOverride ?? (await createRequestIdentityVerifier())
  return approveGrowthDraftGoverned({ identityVerifier, ledger, approvalStore }, claimedUserId, draftId)
}

export interface GovernedGrowthActivityResult {
  events: readonly ActionAuditEvent[]
  verifiedUserId: string
}

/**
 * Activity Timeline's read boundary. Identity-gated the same way
 * approval is — a caller only ever sees their own governed Growth
 * events, never another user's, and an unverifiable claim fails closed
 * with nothing returned (never a partial or default-user fallback).
 */
export async function listGovernedGrowthActivity(
  claimedUserId: string,
  identityVerifierOverride?: JhadinaIdentityVerifier,
): Promise<GovernedGrowthActivityResult> {
  const identityVerifier = identityVerifierOverride ?? (await createRequestIdentityVerifier())
  const identity = await identityVerifier.verify({ userId: claimedUserId })
  const events = ledger.list().filter((event) => event.userId === identity.userId)
  return { events, verifiedUserId: identity.userId }
}
