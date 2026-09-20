import {
  MoneyProviderRegistry,
  PLAID_READ_ONLY_CONFIG,
  createPlaidProviderAdapterFactory,
  type CredentialResolver,
  type ProviderConfig,
} from "@jhadina/money-core"

/**
 * PL-8 production provider composition.
 *
 * Production credential resolution is intentionally broker-only. The provider
 * factory must never resolve process.env itself. Tests may inject a resolver;
 * the real composition root must construct BrokerCredentialResolver.
 */
export const PLAID_PROVIDER = "plaid"

export type CreateMoneyPlaidProductionRegistryOptions = {
  /** Test-only dependency injection; production must provide BrokerCredentialResolver. */
  credentialResolver?: CredentialResolver
  /** Test-only. Never set this in real composition code. */
  baseUrl?: string
}

export type MoneyPlaidProductionRegistry = {
  registry: MoneyProviderRegistry
  providerConfig: Readonly<Record<string, ProviderConfig>>
}

export async function createMoneyPlaidProductionRegistry(
  options: CreateMoneyPlaidProductionRegistryOptions = {},
): Promise<MoneyPlaidProductionRegistry> {
  const credentialResolver = options.credentialResolver
  if (!credentialResolver) throw new Error("CREDENTIAL_BROKER_REQUIRED")

  const factory = options.baseUrl
    ? createPlaidProviderAdapterFactory(options.baseUrl, credentialResolver)
    : createPlaidProviderAdapterFactory(undefined, credentialResolver)

  const adapter = await factory.create(PLAID_PROVIDER)
  const registry = new MoneyProviderRegistry()
  registry.register(adapter)

  return { registry, providerConfig: { [PLAID_PROVIDER]: PLAID_READ_ONLY_CONFIG } }
}
