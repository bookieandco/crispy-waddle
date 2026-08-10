import { buildPlaidReadOnlyAdapter } from './plaid-provider-builder.js';

const adapter = buildPlaidReadOnlyAdapter({
  provider: 'plaid',
  secret: JSON.stringify({ clientId: 'client', secret: 'secret', accessToken: 'access' }),
  config: { provider: 'plaid', enabled: true, credentialRef: 'money/plaid/default', capabilities: ['money.account.read'] },
});

if (adapter.provider !== 'plaid') throw new Error('PLAID_BUILDER_PROVIDER_FAILED');
console.log('Plaid provider builder passed');
