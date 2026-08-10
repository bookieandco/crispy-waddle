import { MoneyProviderHealthGate } from './provider-health.js';
import type { BankAdapter } from './bank-adapter.js';

const adapter: BankAdapter = {
  provider: 'test-bank',
  async listAccounts() { return []; },
  async listTransactions() { return []; },
};

const capability = 'money.account.read' as never;

const unconfigured = await new MoneyProviderHealthGate().check(adapter, capability);
if (unconfigured.status !== 'UNCONFIGURED') throw new Error('HEALTH_UNCONFIGURED_FAILED');

const disabled = await new MoneyProviderHealthGate({
  'test-bank': { credentialRef: 'secret://bank', capabilities: [] },
}).check(adapter, capability);
if (disabled.status !== 'CAPABILITY_DISABLED') throw new Error('HEALTH_CAPABILITY_FAILED');

const ready = await new MoneyProviderHealthGate({
  'test-bank': { credentialRef: 'secret://bank', capabilities: [capability] },
}).check(adapter, capability);
if (ready.status !== 'READY') throw new Error('HEALTH_READY_FAILED');

console.log('Provider health gate passed');
