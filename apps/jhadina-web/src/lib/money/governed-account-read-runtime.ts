import {
  createGovernedProviderAccountReadExecutor,
  type MoneyAccount,
} from "@jhadina/money-core"
import type { ActionIdentityVerifier, AuditRpcClient } from "@jhadina/action-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { createMoneyAuditRpcClient } from "./durable-audit-ledger"
import { assertMoneyProviderWorkspace } from "./workspace-entitlement"
import {
  createMoneyPlaidProductionRegistry,
  PLAID_PROVIDER,
  type MoneyPlaidProductionRegistry,
} from "./production-provider"

export type GovernedMoneyRuntimeOverrides = {
  identityVerifier?: JhadinaIdentityVerifier
  supabase?: AuditRpcClient
  providers?: MoneyPlaidProductionRegistry
  /** Test-only ownership boundary override. Production uses the durable checker. */
  assertUserWorkspace?: (userId: string) => Promise<void>
}

export interface GovernedMoneyAccountReadResult {
  accounts: readonly MoneyAccount[]
  verifiedUserId: string
}

function toActionIdentityVerifier(verifier: JhadinaIdentityVerifier): ActionIdentityVerifier {
  return {
    async verify(request) {
      return verifier.verify({ userId: request.userId })
    },
  }
}

export async function runGovernedMoneyAccountRead(
  requestId: string,
  overrides: GovernedMoneyRuntimeOverrides = {},
): Promise<GovernedMoneyAccountReadResult> {
  const identityVerifier = overrides.identityVerifier ?? (await createRequestIdentityVerifier())
  const identity = await identityVerifier.verify()
  const supabase: AuditRpcClient = overrides.supabase ?? (await createMoneyAuditRpcClient())
  const { registry, providerConfig } = overrides.providers ?? (await createMoneyPlaidProductionRegistry())

  const executor = createGovernedProviderAccountReadExecutor({
    identityVerifier: toActionIdentityVerifier(identityVerifier),
    supabase,
    providers: registry,
    providerConfig,
    // Fail closed: an authenticated user must also own an active connection.
    assertUserWorkspace:
      overrides.assertUserWorkspace ?? ((userId) => assertMoneyProviderWorkspace(userId, PLAID_PROVIDER)),
  })

  const accounts = await executor.execute({
    id: requestId,
    userId: identity.userId,
    type: "money.account.read",
    requestedAt: new Date().toISOString(),
    action: { capability: "money.account.read", provider: PLAID_PROVIDER },
  })

  return { accounts, verifiedUserId: identity.userId }
}
