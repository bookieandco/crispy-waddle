import { EnvironmentCredentialResolver } from './credential-resolver.js';
import { ProviderAdapterFactory } from './provider-adapter-factory.js';

const adapter = {
  async listAccounts() { return []; },
  async listTransactions() { return []; },
  async listStatements() { return []; },
  async createPayment() { throw new Error('PAYMENT_DISABLED_IN_TEST'); },
  async createTransfer() { throw new Error('TRANSFER_DISABLED_IN_TEST'); },
};

const factory = new ProviderAdapterFactory({
  credentialResolver: new EnvironmentCredentialResolver({ JHADINA_SECRET_COINBASE_DEFAULT: 'secret' }),
  configs: {
    coinbase: { provider: 'coinbase', enabled: true, credentialRef: 'money/coinbase/default', capabilities: ['money.account.read'] },
    disabled: { provider: 'disabled', enabled: false, credentialRef: 'money/disabled/default', capabilities: [] },
  },
  builders: { coinbase: () => adapter },
});

if (await factory.create('coinbase') !== adapter) throw new Error('ADAPTER_FACTORY_CREATE_FAILED');

for (const provider of ['missing', 'disabled'] as const) {
  let rejected = false;
  try { await factory.create(provider); } catch { rejected = true; }
  if (!rejected) throw new Error(`ADAPTER_FACTORY_FAIL_CLOSED_FAILED:${provider}`);
}

let missingSecretRejected = false;
try {
  await new ProviderAdapterFactory({
    credentialResolver: new EnvironmentCredentialResolver({}),
    configs: { coinbase: { provider: 'coinbase', enabled: true, credentialRef: 'money/coinbase/default', capabilities: ['money.account.read'] } },
    builders: { coinbase: () => adapter },
  }).create('coinbase');
} catch { missingSecretRejected = true; }
if (!missingSecretRejected) throw new Error('ADAPTER_FACTORY_SECRET_GATE_FAILED');

console.log('Provider adapter factory passed');
