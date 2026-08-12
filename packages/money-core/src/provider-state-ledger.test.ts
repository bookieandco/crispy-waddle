import { ProviderStateLedger } from './provider-state-ledger.js';

const ledger = new ProviderStateLedger();

const first = ledger.append({
  provider: 'plaid',
  enabled: false,
  credentialRef: 'money/plaid/default',
  capabilities: [],
  status: 'disabled',
  updatedAt: '2026-08-10T00:00:00.000Z',
  changedBy: 'system',
  actionId: 'bootstrap',
  reason: 'initial provider registration',
});

if (first.version !== 1) throw new Error('PROVIDER_STATE_VERSION_1_FAILED');
if (first.credentialRef !== 'money/plaid/default') throw new Error('CREDENTIAL_REF_MISSING');

const second = ledger.append({
  provider: 'plaid',
  enabled: true,
  credentialRef: 'money/plaid/default',
  capabilities: ['money.account.read'],
  status: 'healthy',
  updatedAt: '2026-08-10T00:01:00.000Z',
  changedBy: 'user',
  actionId: 'enable-plaid',
  reason: 'approved account-read capability',
});

if (second.version !== 2 || second.previousVersion !== 1) throw new Error('PROVIDER_STATE_VERSION_2_FAILED');
if (ledger.current('plaid')?.enabled !== true) throw new Error('CURRENT_PROVIDER_STATE_FAILED');

const restored = ledger.restore('plaid', 1, 'user', 'rollback-plaid', 'revert provider enablement');
if (restored.version !== 3 || restored.enabled !== false) throw new Error('PROVIDER_STATE_RESTORE_FAILED');
if (ledger.historyFor('plaid').length !== 3) throw new Error('PROVIDER_STATE_HISTORY_FAILED');

let missingRejected = false;
try { ledger.restore('plaid', 99, 'user', 'bad-rollback', 'invalid version'); } catch { missingRejected = true; }
if (!missingRejected) throw new Error('PROVIDER_STATE_INVALID_RESTORE_FAILED');

console.log('Provider state ledger passed');
