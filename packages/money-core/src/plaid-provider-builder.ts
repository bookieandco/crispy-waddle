import { PlaidReadOnlyAdapter } from './plaid-read-only-adapter.js';
import type { ProviderAdapterBuilder } from './provider-adapter-factory.js';

/** Build Plaid's read-only adapter from the server-resolved credential bundle. */
export const buildPlaidReadOnlyAdapter: ProviderAdapterBuilder = ({ secret }) =>
  new PlaidReadOnlyAdapter({
    baseUrl: process.env.JHADINA_PLAID_BASE_URL ?? 'https://sandbox.plaid.com',
    credentialBundle: secret,
  });
