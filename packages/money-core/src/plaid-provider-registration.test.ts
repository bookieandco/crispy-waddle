import { EnvironmentCredentialResolver } from './credential-resolver.js';
import {
  createPlaidProviderAdapterFactory,
  PLAID_READ_ONLY_CONFIG,
  PLAID_SANDBOX_BASE_URL,
  assertPlaidSandboxBaseUrl,
} from './plaid-provider-registration.js';

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

// Plaid's adapter is account-read-only: transaction reads are always
// rejected, regardless of capability, because the path isn't implemented.
let transactionReadRejected = false;
try {
  await adapter.listTransactions(
    {
      userId: 'test-user',
      capability: 'money.transaction.read',
      requestId: 'test-request',
    },
    'test-account',
  );
} catch (error) {
  transactionReadRejected = error instanceof Error && error.message === 'PLAID_TRANSACTION_READ_NOT_IMPLEMENTED';
}
if (!transactionReadRejected) throw new Error('PLAID_READ_ONLY_SCOPE_BROKEN');

// Sandbox-boundary assertion: a production Plaid host is rejected before
// any adapter is constructed, even though credentials and capability
// scope are otherwise identical to the passing case above.
let productionBaseUrlRejected = false;
try {
  createPlaidProviderAdapterFactory(
    'https://production.plaid.com',
    new EnvironmentCredentialResolver({
      JHADINA_SECRET_PLAID_DEFAULT: JSON.stringify({
        clientId: 'test-client',
        secret: 'test-secret',
        accessToken: 'test-token',
      }),
    }),
  );
} catch (error) {
  productionBaseUrlRejected = error instanceof Error && error.message === `PLAID_BASE_URL_MUST_BE_SANDBOX:https://production.plaid.com`;
}
if (!productionBaseUrlRejected) throw new Error('PLAID_SANDBOX_BOUNDARY_NOT_ENFORCED');

// The guard is independently correct, not just correct as wired into the factory.
if (assertPlaidSandboxBaseUrl(PLAID_SANDBOX_BASE_URL) !== undefined) {
  throw new Error('PLAID_SANDBOX_URL_UNEXPECTEDLY_REJECTED');
}
let directGuardRejected = false;
try {
  assertPlaidSandboxBaseUrl('https://production.plaid.com');
} catch (error) {
  directGuardRejected = error instanceof Error && error.message.startsWith('PLAID_BASE_URL_MUST_BE_SANDBOX:');
}
if (!directGuardRejected) throw new Error('PLAID_SANDBOX_GUARD_NOT_INDEPENDENTLY_CORRECT');

console.log('Plaid provider registration passed');
