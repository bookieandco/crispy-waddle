import { EnvironmentCredentialResolver } from './credential-resolver.js';
import { createPlaidProviderAdapterFactory, PLAID_READ_ONLY_CONFIG } from './plaid-provider-registration.js';

if (PLAID_READ_ONLY_CONFIG.capabilities.length !== 1 || PLAID_READ_ONLY_CONFIG.capabilities[0] !== 'money.account.read') {
  throw new Error('PLAID_CAPABILITY_SCOPE_FAILED');
}

const factory = createPlaidProviderAdapterFactory(
  'https://sandbox.plaid.com',
  new EnvironmentCredentialResolver({
    JHADINA_SECRET_PLAID_DEFAULT: JSON.stringify({
      clientId: 'test-client',
      secret: 'test-secret',
      accessToken: 'test-token',
    }),
  }),
);

const adapter = await factory.create('plaid');
if (adapter.provider !== 'plaid') throw new Error('PLAID_PROVIDER_NOT_REGISTERED');

let unknownCapabilityRejected = false;
try {
  await adapter.listTransactions({
    capability: 'money.transaction.read',
    requestId: 'test-request',
  });
} catch (error) {
  unknownCapabilityRejected = error instanceof Error && error.message === 'CAPABILITY_NOT_ALLOWED:money.transaction.read';
}
if (!unknownCapabilityRejected) throw new Error('PLAID_READ_ONLY_SCOPE_BROKEN');

console.log('Plaid provider registration passed');
