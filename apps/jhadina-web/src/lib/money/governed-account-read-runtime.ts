import {
  createGovernedProviderAccountReadExecutor,
  type MoneyAccount,
} from "@jhadina/money-core"
import { SupabaseNonceReplayGuard, type ActionIdentityVerifier, type AuditRpcClient } from "@jhadina/action-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { createMoneyAuditRpcClient } from "./durable-audit-ledger"
import {
  createMoneyPlaidProductionRegistry,
  PLAID_PROVIDER,
  type MoneyPlaidProductionRegistry,
} from "./production-provider"

export type GovernedMoneyRuntimeOverrides = {
  identityVerifier?: JhadinaIdentityVerifier
  supabase?: AuditRpcClient
  providers?: MoneyPlaidProductionRegistry
  replayGuard?: InstanceType<typeof SupabaseNonceReplayGuard>
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
  claimedUserId: string,
  requestId: string,
  overrides: GovernedMoneyRuntimeOverrides = {},
): Promise<GovernedMoneyAccountReadResult> {
  const identityVerifier = overrides.identityVerifier ?? (await createRequestIdentityVerifier())
  const supabase: AuditRpcClient = overrides.supabase ?? (await createMoneyAuditRpcClient())
  const { registry, providerConfig } = overrides.providers ?? (await createMoneyPlaidProductionRegistry())
  const replayGuard = overrides.replayGuard ?? new SupabaseNonceReplayGuard(supabase)

  const executor = createGovernedProviderAccountReadExecutor({
    identityVerifier: toActionIdentityVerifier(identityVerifier),
    supabase,
    providers: registry,
    providerConfig,
    replayGuard,
  })

  const accounts = await executor.execute({
    id: requestId,
    userId: claimedUserId,
    type: "money.account.read",
    requestedAt: new Date().toISOString(),
    nonce: requestId,
    action: { capability: "money.account.read", provider: PLAID_PROVIDER },
  })

  return { accounts, verifiedUserId: claimedUserId }
}
