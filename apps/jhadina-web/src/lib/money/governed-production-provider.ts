import { BrokerCredentialResolver, EnvironmentCredentialStore, MoneyProviderRegistry, PLAID_READ_ONLY_CONFIG, PLAID_SANDBOX_BASE_URL, createPlaidProviderAdapterFactory, type ProviderConfig } from "@jhadina/money-core"
import { CredentialBroker, EgressPolicy, RpcCredentialLeaseStore, RpcKillSwitchStore, SecurityKillSwitch } from "@jhadina/security-core"
import { createClient } from "../supabase/server"

export const PLAID_PROVIDER = "plaid"

export type GovernedMoneyPlaidProductionRegistry = {
  registry: MoneyProviderRegistry
  providerConfig: Readonly<Record<string, ProviderConfig>>
}

export async function createGovernedMoneyPlaidProductionRegistry(actorId: string, requestId: string): Promise<GovernedMoneyPlaidProductionRegistry> {
  if (!actorId || !requestId) throw new Error("MONEY_CREDENTIAL_IDENTITY_REQUIRED")
  const supabase = await createClient()
  const rpcClient = {
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      const { data, error } = await supabase.rpc(fn, args)
      return { data: (data ?? null) as T | null, error: error ? { message: error.message } : null }
    },
  }
  const leaseStore = new RpcCredentialLeaseStore(rpcClient)
  const killSwitch = new SecurityKillSwitch(new RpcKillSwitchStore(rpcClient))
  const broker = new CredentialBroker(new EnvironmentCredentialStore(), {
    maxTtlMs: 60_000,
    providerCapabilities: { [PLAID_PROVIDER]: ["money.account.read"] },
    allowedCredentialRefs: [PLAID_READ_ONLY_CONFIG.credentialRef],
    maxUses: 1,
  }, Date.now, () => crypto.randomUUID(), leaseStore, {
    killSwitch,
    posture: "normal",
    policyDecision: "allow",
  })
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
  }, "trusted-compute", {
    policy: new EgressPolicy([
      {
        capability: "money.account.read",
        hosts: [new URL(PLAID_SANDBOX_BASE_URL).hostname],
        protocols: ["https"],
        ports: [443],
        maxPayloadBytes: 1_048_576,
        allowedDataClasses: ["internal"],
      },
    ]),
    destination: PLAID_SANDBOX_BASE_URL,
    dataClass: "internal",
  })
  const adapter = await createPlaidProviderAdapterFactory(PLAID_SANDBOX_BASE_URL, resolver).create(PLAID_PROVIDER)
  const registry = new MoneyProviderRegistry()
  registry.register(adapter)
  return { registry, providerConfig: { [PLAID_PROVIDER]: PLAID_READ_ONLY_CONFIG } }
}
