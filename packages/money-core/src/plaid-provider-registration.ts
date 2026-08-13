import { ProviderAdapterFactory, type ProviderAdapterFactoryOptions } from './provider-adapter-factory.js';
import { createPlaidReadOnlyAdapterBuilder } from './plaid-provider-builder.js';

export const PLAID_READ_ONLY_CONFIG = {
  enabled: true,
  credentialRef: 'money/plaid/default',
  capabilities: ['money.account.read'] as const,
};

/** Registers Plaid with only the account-read capability enabled. */
export function createPlaidProviderAdapterFactory(
  baseUrl = process.env.JHADINA_PLAID_BASE_URL ?? 'https://sandbox.plaid.com',
  credentialResolver: ProviderAdapterFactoryOptions['credentialResolver'],
): ProviderAdapterFactory {
  return new ProviderAdapterFactory({
    credentialResolver,
    configs: { plaid: PLAID_READ_ONLY_CONFIG },
    builders: {
      plaid: createPlaidReadOnlyAdapterBuilder(baseUrl),
    },
  });
}
