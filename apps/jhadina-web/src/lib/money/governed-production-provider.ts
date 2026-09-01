import { BrokerCredentialResolver, EnvironmentCredentialStore, MoneyProviderRegistry, PLAID_READ_ONLY_CONFIG, createPlaidProviderAdapterFactory, type ProviderConfig } from "@jhadina/money-core"
import { CredentialBroker, RpcCredentialLeaseStore } from "@jhadina/security-core"
import { createClient } from "../supabase/server"

export const PLAID_PROVIDER = "plaid"

export type GovernedMoneyPlaidProductionRegistry = {
  registry: MoneyProviderRegistry
  providerConfig: Readonly<Record<string, ProviderConfig>>
}

export async function createGovernedMoneyPlaidProductionRegistry(actorId: string, requestId: string): Promise<GovernedMoneyPlaidProductionRegistry> {
  if (!actorId || !requestId) throw new Error("MONEY_CREDENTIAL_IDENTITY_REQUIRED")
  const supabase = await createClient()
  const leaseStore = new RpcCredentialLeaseStore({
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      const { data, error } = await supabase.rpc(fn, args)
      return { data: (data ?? null) as T | null, error: error ? { message: error.message } : null }
    },
  })
  const broker = new CredentialBroker(new EnvironmentCredentialStore(), {
    maxTtlMs: 60_000,
    providerCapabilities: { [PLAID_PROVIDER]: ["money.account.read"] },
    allowedCredentialRefs: [PLAID_READ_ONLY_CONFIG.credentialRef],
    maxUses: 1,
  }, Date.now, () => crypto.randomUUID(), leaseStore)
  const now = Date.now()
  const resolver = new BrokerCredentialResolver(broker, {
    requestId,
    actorId,
    workerId: "jhadina-web",
    workerTrust: "trusted-compute",
    capability: "money.account.read",
    provider: PLAID_PROVIDER,
    credentialRef: PLAID_READ_ONLY_CONFIG.credentialRef,
    purpose: "governed-money-account-read",
    issuedAt: now,
    expiresAt: now + 30_000,
    nonce: crypto.randomUUID(),
  })
  const adapter = await createPlaidProviderAdapterFactory(undefined, resolver).create(PLAID_PROVIDER)
  const registry = new MoneyProviderRegistry()
  registry.register(adapter)
  return { registry, providerConfig: { [PLAID_PROVIDER]: PLAID_READ_ONLY_CONFIG } }
}
