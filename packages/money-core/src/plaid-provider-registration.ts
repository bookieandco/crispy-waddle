import { ProviderAdapterFactory, type ProviderAdapterFactoryOptions } from './provider-adapter-factory.js';
import { createPlaidReadOnlyAdapterBuilder } from './plaid-provider-builder.js';

export const PLAID_READ_ONLY_CONFIG = {
  enabled: true,
  credentialRef: 'money/plaid/default',
  capabilities: ['money.account.read'] as const,
};

export const PLAID_SANDBOX_BASE_URL = 'https://sandbox.plaid.com';

/**
 * Fail closed unless the resolved Plaid endpoint is Plaid's own sandbox
 * host. Unlike Stripe (whose safety boundary is key-prefix-based —
 * sk_test_ vs sk_live_, enforced by Commerce's assertStripeSandboxKey),
 * the same Plaid credential bundle shape authenticates against both
 * sandbox.plaid.com and Plaid's production hosts — the base URL alone
 * decides which one gets called. Before this assertion, nothing in this
 * package stopped a misconfigured baseUrl (or a change to the
 * JHADINA_PLAID_BASE_URL default) from reaching a real account. This is
 * that boundary, checked before any adapter is constructed.
 */
export function assertPlaidSandboxBaseUrl(baseUrl: string): void {
  if (baseUrl !== PLAID_SANDBOX_BASE_URL) {
    throw new Error(`PLAID_BASE_URL_MUST_BE_SANDBOX:${baseUrl}`);
  }
}

/** Registers Plaid with only the account-read capability enabled. */
export function createPlaidProviderAdapterFactory(
  baseUrl = process.env.JHADINA_PLAID_BASE_URL ?? PLAID_SANDBOX_BASE_URL,
  credentialResolver: ProviderAdapterFactoryOptions['credentialResolver'],
): ProviderAdapterFactory {
  assertPlaidSandboxBaseUrl(baseUrl);
  return new ProviderAdapterFactory({
    credentialResolver,
    configs: { plaid: PLAID_READ_ONLY_CONFIG },
    builders: {
      plaid: createPlaidReadOnlyAdapterBuilder(baseUrl),
    },
  });
}
