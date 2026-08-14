import {
  EnvironmentCredentialResolver,
  MoneyProviderRegistry,
  PLAID_READ_ONLY_CONFIG,
  createPlaidProviderAdapterFactory,
  type CredentialResolver,
  type ProviderConfig,
} from "@jhadina/money-core"

/**
 * PL-8 (Jhadina OS Integration Phase 2, Money real-integration Phase 1):
 * the real Plaid credential-resolution and provider-registration
 * boundary — Money's own version of Commerce's
 * production-payment-provider.ts (PL-6).
 *
 * EnvironmentCredentialResolver(real process.env) ->
 * createPlaidProviderAdapterFactory (money-core; asserts the resolved
 * baseUrl is Plaid's sandbox host before constructing anything,
 * PLAID_BASE_URL_MUST_BE_SANDBOX if not) -> ProviderAdapterFactory.create
 * ('plaid') -> a MoneyProviderRegistry with exactly one provider
 * registered.
 *
 * There is still no live call proven end to end here: no real
 * JHADINA_SECRET_PLAID_DEFAULT value exists anywhere in this
 * environment. That is this milestone's deliberate scope boundary
 * (Phase 1 is "complete the wiring," not "prove a live call," per
 * explicit instruction) — once a real sandbox credential bundle is set
 * as JHADINA_SECRET_PLAID_DEFAULT, createMoneyPlaidProductionRegistry()
 * with no overrides is the real, live-capable path; nothing else
 * changes.
 *
 * credentialResolver is exposed purely as a test-only escape hatch
 * (mirroring every prior proof's injectable-transport pattern) — real
 * composition code should never set it.
 */

export const PLAID_PROVIDER = "plaid"

export type CreateMoneyPlaidProductionRegistryOptions = {
  credentialResolver?: CredentialResolver
  /** Test-only. Never set this in real composition code — see file header. */
  baseUrl?: string
}

export type MoneyPlaidProductionRegistry = {
  registry: MoneyProviderRegistry
  providerConfig: Readonly<Record<string, ProviderConfig>>
}

export async function createMoneyPlaidProductionRegistry(
  options: CreateMoneyPlaidProductionRegistryOptions = {},
): Promise<MoneyPlaidProductionRegistry> {
  const credentialResolver = options.credentialResolver ?? new EnvironmentCredentialResolver()

  // Credential resolution AND the sandbox-boundary assertion both happen
  // before any adapter exists — createPlaidProviderAdapterFactory throws
  // PLAID_BASE_URL_MUST_BE_SANDBOX synchronously if the resolved baseUrl
  // isn't sandbox.plaid.com, and ProviderAdapterFactory.create() resolves
  // (and validates) the credential before the adapter is constructed.
  const factory = options.baseUrl
    ? createPlaidProviderAdapterFactory(options.baseUrl, credentialResolver)
    : createPlaidProviderAdapterFactory(undefined, credentialResolver)

  const adapter = await factory.create(PLAID_PROVIDER)

  const registry = new MoneyProviderRegistry()
  registry.register(adapter)

  return { registry, providerConfig: { [PLAID_PROVIDER]: PLAID_READ_ONLY_CONFIG } }
}
