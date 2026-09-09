import { InMemoryApprovalReceiptStore, SupabaseAuditLedger, type ActionAuditEvent } from "@jhadina/action-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { approveGrowthDraftGoverned, type GovernedGrowthApprovalResult } from "./governed-approval"
import { createGrowthAuditLedger, GROWTH_AUDIT_DOMAIN } from "./durable-audit-ledger"

const approvalStore = new InMemoryApprovalReceiptStore()

export type GovernedGrowthRuntimeOverrides = {
  identityVerifier?: JhadinaIdentityVerifier
  ledger?: SupabaseAuditLedger
}

export async function runGovernedGrowthDraftApproval(
  draftId: string,
  overrides: GovernedGrowthRuntimeOverrides = {},
): Promise<GovernedGrowthApprovalResult> {
  const identityVerifier = overrides.identityVerifier ?? (await createRequestIdentityVerifier())
  const ledger = overrides.ledger ?? (await createGrowthAuditLedger())
  return approveGrowthDraftGoverned({ identityVerifier, ledger, approvalStore }, draftId)
}

export interface GovernedGrowthActivityResult {
  events: readonly ActionAuditEvent[]
  verifiedUserId: string
}

export async function listGovernedGrowthActivity(
  overrides: GovernedGrowthRuntimeOverrides = {},
): Promise<GovernedGrowthActivityResult> {
  const identityVerifier = overrides.identityVerifier ?? (await createRequestIdentityVerifier())
  const identity = await identityVerifier.verify()
  const ledger = overrides.ledger ?? (await createGrowthAuditLedger())
  const events = await ledger.list({ domain: GROWTH_AUDIT_DOMAIN, actorId: identity.userId })
  return { events, verifiedUserId: identity.userId }
}
