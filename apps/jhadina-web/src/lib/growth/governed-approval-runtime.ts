import { InMemoryActionLedger } from "@jhadina/action-core"
import { InMemoryApprovalReceiptStore } from "@jhadina/action-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
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
 */
const ledger = new InMemoryActionLedger()
const approvalStore = new InMemoryApprovalReceiptStore()

export function getGovernedGrowthApprovalLedger() {
  return ledger
}

export async function runGovernedGrowthDraftApproval(
  claimedUserId: string,
  draftId: string,
): Promise<GovernedGrowthApprovalResult> {
  const identityVerifier = await createRequestIdentityVerifier()
  return approveGrowthDraftGoverned({ identityVerifier, ledger, approvalStore }, claimedUserId, draftId)
}
