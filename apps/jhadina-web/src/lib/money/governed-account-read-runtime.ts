import {
  createGovernedProviderAccountReadExecutor,
  type MoneyAccount,
} from "@jhadina/money-core"
import type { ActionIdentityVerifier, AuditRpcClient } from "@jhadina/action-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { createMoneyAuditRpcClient } from "./durable-audit-ledger"
import {
  createMoneyPlaidProductionRegistry,
  PLAID_PROVIDER,
  type MoneyPlaidProductionRegistry,
} from "./production-provider"

/**
 * PL-8 (Jhadina OS Integration Phase 2, Money real-integration Phase 1):
 * process-local composition root for the real Money account-read path —
 * Money's own version of Growth's governed-approval-runtime.ts.
 *
 * Real identity -> real durable SupabaseAuditLedger -> the real
 * governed Plaid provider registry -> money-core's own
 * createGovernedProviderAccountReadExecutor (identity verified before
 * the health/capability gate, exactly one ActionPolicy, assertCapability
 * enforced inside the adapter — none of that is reimplemented here).
 *
 * assertUserWorkspace is deliberately left unset: there is no stored
 * "which Plaid Item does this user own" mapping anywhere in this
 * codebase yet (no bank-connection table, no migration) — building one
 * is new infrastructure this Phase-1 wiring milestone was not
 * authorized to add. Every verified identity that reaches this runtime
 * is therefore allowed to read the single configured 'plaid' provider's
 * accounts; this is a real, known, intentionally-surfaced gap (not
 * hidden) and matches the current absence of any "connect your bank"
 * flow. It must be closed before this path is exposed to more than one
 * real bank connection per user.
 */
export type GovernedMoneyRuntimeOverrides = {
  /** Test-only: createRequestIdentityVerifier() makes a real Supabase call with no meaning outside a real request. */
  identityVerifier?: JhadinaIdentityVerifier
  /** Test-only: substitutes a fake AuditRpcClient instead of a live database. createProductionActionExecutor wraps whatever is passed here in its own real SupabaseAuditLedger — never pass an already-built ledger. */
  supabase?: AuditRpcClient
  /** Test-only: substitutes an already-built provider registry instead of the real Plaid credential-resolution path. */
  providers?: MoneyPlaidProductionRegistry
}

export interface GovernedMoneyAccountReadResult {
  accounts: readonly MoneyAccount[]
  verifiedUserId: string
}

/**
 * money-core's createGovernedProviderAccountReadExecutor expects
 * action-core's native ActionIdentityVerifier (verify(request:
 * ActionRequest): Promise<VerifiedIdentity>), while
 * createRequestIdentityVerifier() returns this app's own
 * JhadinaIdentityVerifier (verify(request: {userId}): Promise<{userId,
 * sessionId}>) — the same type Growth's and Commerce's composition
 * roots already use. The two return shapes are identical
 * (userId/sessionId); this adapts the narrower request shape rather
 * than relying on structural bivariance to paper over the difference.
 */
function toActionIdentityVerifier(verifier: JhadinaIdentityVerifier): ActionIdentityVerifier {
  return {
    async verify(request) {
      return verifier.verify({ userId: request.userId })
    },
  }
}

export async function runGovernedMoneyAccountRead(
  claimedUserId: string,
  requestId: string,
  overrides: GovernedMoneyRuntimeOverrides = {},
): Promise<GovernedMoneyAccountReadResult> {
  const identityVerifier = overrides.identityVerifier ?? (await createRequestIdentityVerifier())
  const supabase: AuditRpcClient = overrides.supabase ?? (await createMoneyAuditRpcClient())
  const { registry, providerConfig } = overrides.providers ?? (await createMoneyPlaidProductionRegistry())

  const executor = createGovernedProviderAccountReadExecutor({
    identityVerifier: toActionIdentityVerifier(identityVerifier),
    supabase,
    providers: registry,
    providerConfig,
  })

  const accounts = await executor.execute({
    id: requestId,
    userId: claimedUserId,
    type: "money.account.read",
    requestedAt: new Date().toISOString(),
    action: { capability: "money.account.read", provider: PLAID_PROVIDER },
  })

  return { accounts, verifiedUserId: claimedUserId }
}
