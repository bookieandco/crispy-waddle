import { PlaidReadOnlyAdapter } from './plaid-read-only-adapter.js';
import type { ProviderAdapterBuilder } from './provider-adapter-factory.js';

/** Build Plaid's read-only adapter from the server-resolved credential bundle. */
export const buildPlaidReadOnlyAdapter: ProviderAdapterBuilder = ({ secret }) =>
  new PlaidReadOnlyAdapter({
    baseUrl: process.env.JHADINA_PLAID_BASE_URL ?? 'https://sandbox.plaid.com',
    credentialBundle: secret,
  });

/** Same as `buildPlaidReadOnlyAdapter`, but with the base URL fixed by the caller
 * (e.g. `createPlaidProviderAdapterFactory`'s configurable `baseUrl` parameter)
 * instead of falling back to the environment variable. */
export function createPlaidReadOnlyAdapterBuilder(baseUrl: string): ProviderAdapterBuilder {
  return ({ secret }) => new PlaidReadOnlyAdapter({ baseUrl, credentialBundle: secret });
}
