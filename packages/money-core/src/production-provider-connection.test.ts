import { MoneyProviderRegistry } from './provider-registry.js';
import { ProductionProviderConnection } from './production-provider-connection.js';
import type { BankAdapter } from './bank-adapter.js';

const adapter: BankAdapter = {
  provider: 'test-bank',
  async listAccounts() { return []; },
  async listTransactions() { return []; },
  async listStatements() { return []; },
  async createPayment() { throw new Error('NOT_ENABLED'); },
  async createTransfer() { throw new Error('NOT_ENABLED'); },
};

const registry = new MoneyProviderRegistry();
registry.register(adapter);

const ready = new ProductionProviderConnection({
  registry,
  config: {
    'test-bank': {
      enabled: true,
      credentialRef: 'money/test-bank/default',
      capabilities: ['money.account.read'],
    },
  },
});

const resolved = await ready.getReadyProvider('test-bank', 'money.account.read');
if (resolved !== adapter) throw new Error('PROVIDER_CONNECTION_RESOLUTION_FAILED');

const unconfigured = new ProductionProviderConnection({
  registry,
  config: { 'test-bank': { enabled: true } },
});

const health = await unconfigured.check('test-bank', 'money.account.read');
if (health.status !== 'UNCONFIGURED') throw new Error(`PROVIDER_HEALTH_STATE_FAILED:${health.status}`);

let denied = false;
try {
  await unconfigured.getReadyProvider('test-bank', 'money.account.read');
} catch (error) {
  denied = error instanceof Error && error.message === 'BANK_PROVIDER_NOT_READY:test-bank:UNCONFIGURED';
}
if (!denied) throw new Error('UNCONFIGURED_PROVIDER_WAS_NOT_BLOCKED');

console.log('Production provider connection passed');
