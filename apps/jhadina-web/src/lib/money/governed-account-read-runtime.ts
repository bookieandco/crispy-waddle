import {
  createGovernedProviderAccountReadExecutor,
  type MoneyAccount,
} from "@jhadina/money-core"
import type { ActionIdentityVerifier, AuditRpcClient } from "@jhadina/action-core"
import {
  CredentialBroker,
  JHADINA_BASE_SECURITY_POLICY,
  JhadinaSecurityCore,
  createSecurityRequest,
} from "@jhadina/security-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { createClient } from "../supabase/server"
import { createMoneyAuditRpcClient } from "./durable-audit-ledger"
import { BrokerCredentialResolver, createServerEnvironmentSecretStore } from "../security/broker-credential-resolver"
import { SupabaseCredentialLeaseStore } from "../security/supabase-credential-lease-store"
import {
  createMoneyPlaidProductionRegistry,
  PLAID_PROVIDER,
  type MoneyPlaidProductionRegistry,
} from "./production-provider"

/**
 * PL-8 production composition: identity -> canonical security policy ->
 * short-lived broker lease -> durable one-time lease consumption -> provider.
 * Provider code never resolves process.env directly.
 *
 * The traffic gate intentionally fails closed until the native/network kill
 * switch state is supplied. Do not replace it with an unconditional true;
 * that is the remaining A1/A5 integration seam.
 */
export type GovernedMoneyRuntimeOverrides = {
  /** Test-only identity substitution. */
  identityVerifier?: JhadinaIdentityVerifier
  /** Test-only audit transport substitution. */
  supabase?: AuditRpcClient
  /** Test-only provider registry substitution. */
  providers?: MoneyPlaidProductionRegistry
  /** Explicitly supplied by the trusted transport/kill-switch layer. */
  credentialTrafficAllowed?: boolean
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

async function createBrokerCredentialResolver(
  actorId: string,
  workerId: string,
  trafficAllowed: boolean,
): Promise<BrokerCredentialResolver> {
  const client = await createClient()
  const security = new JhadinaSecurityCore(JHADINA_BASE_SECURITY_POLICY)
  const leaseStore = new SupabaseCredentialLeaseStore(client)
  const broker = new CredentialBroker(
    createServerEnvironmentSecretStore(),
    leaseStore,
    {
      authorize(input) {
        const request = createSecurityRequest({
          requestId: `${workerId}:credential`,
          actorId: input.actorId,
          domain: input.domain,
          capability: input.capability,
          resourceId: input.resourceId,
        })
        return security.authorize(request) === "allow" ? "allow" : "deny"
      },
      allowTraffic: () => trafficAllowed,
      allowCredentialEgress: (input) =>
        input.domain === "money"
        && input.capability === "money.account.read"
        && /^money\/plaid\/[a-z0-9][a-z0-9._-]*$/i.test(input.credentialRef),
    },
  )

  return new BrokerCredentialResolver({
    broker,
    actorId,
    workerId,
    domain: "money",
    capability: "money.account.read",
  })
}

export async function runGovernedMoneyAccountRead(
  claimedUserId: string,
  requestId: string,
  overrides: GovernedMoneyRuntimeOverrides = {},
): Promise<GovernedMoneyAccountReadResult> {
  const identityVerifier = overrides.identityVerifier ?? (await createRequestIdentityVerifier())
  const identity = await identityVerifier.verify({ userId: claimedUserId })
  if (identity.userId !== claimedUserId) throw new Error("Action identity mismatch")
  if (!identity.sessionId) throw new Error("Action session missing")

  const supabase: AuditRpcClient = overrides.supabase ?? (await createMoneyAuditRpcClient())
  const providers = overrides.providers
    ? overrides.providers
    : await createMoneyPlaidProductionRegistry({
        credentialResolver: await createBrokerCredentialResolver(
          identity.userId,
          requestId,
          overrides.credentialTrafficAllowed === true,
        ),
      })

  const executor = createGovernedProviderAccountReadExecutor({
    identityVerifier: toActionIdentityVerifier(identityVerifier),
    supabase,
    providers: providers.registry,
    providerConfig: providers.providerConfig,
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
