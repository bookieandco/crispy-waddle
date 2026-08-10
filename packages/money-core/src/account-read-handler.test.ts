import { MoneyAccountReadHandler } from './account-read-handler.js';
import type { BankAdapter } from './bank-adapter.js';

const adapter: BankAdapter = {
  provider: 'test-bank',
  async listAccounts(context) {
    if (context.capability !== 'money.account.read') throw new Error('CAPABILITY_LEAK');
    return [{ id: 'acct-1', provider: 'test-bank', externalId: 'ext-1', type: 'checking', currency: 'USD', maskedName: 'Checking •••• 1234' }];
  },
  async listTransactions() { return []; },
};

const handler = new MoneyAccountReadHandler({
  getProvider: () => adapter,
  assertUserWorkspace: async (userId) => {
    if (userId !== 'user-1') throw new Error('WORKSPACE_DENIED');
  },
});

const result = await handler.execute(
  { capability: 'money.account.read', provider: 'test-bank' },
  { requestId: 'test-account-read', userId: 'user-1', action: { capability: 'money.account.read', provider: 'test-bank' } },
);

if (result[0]?.maskedName !== 'Checking •••• 1234') throw new Error('ACCOUNT_READ_FAILED');

let denied = false;
try {
  await handler.execute(
    { capability: 'money.account.read', provider: 'test-bank' },
    { requestId: 'test-account-read-2', userId: 'user-2', action: { capability: 'money.account.read', provider: 'test-bank' } },
  );
} catch {
  denied = true;
}
if (!denied) throw new Error('CROSS_USER_ACCOUNT_READ_ALLOWED');
