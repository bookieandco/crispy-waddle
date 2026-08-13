import { MoneyTransactionReadHandler } from './transaction-read-handler.js';

const calls: string[] = [];
const handler = new MoneyTransactionReadHandler(
  {
    provider: 'test-bank',
    async listAccounts() { return []; },
    async listTransactions(context, accountId) {
      calls.push(`${context.userId}:${context.capability}:${accountId}`);
      return [{ id: 'tx-1', accountId, amount: -12, currency: 'USD', occurredAt: '2026-08-09T00:00:00Z' }];
    },
  },
  (userId) => ({ userId, accountIds: new Set(userId === 'user-1' ? ['acct-1'] : ['acct-2']) }),
);

const result = await handler.execute(
  { capability: 'money.transaction.read', accountId: 'acct-1' },
  { id: 'request-1', userId: 'user-1', action: { capability: 'money.transaction.read', accountId: 'acct-1' } } as any,
);

if (result.length !== 1 || calls[0] !== 'user-1:money.transaction.read:acct-1') throw new Error('TRANSACTION_READ_FAILED');

let denied = false;
try {
  await handler.execute(
    { capability: 'money.transaction.read', accountId: 'acct-1' },
    { id: 'request-2', userId: 'user-2', action: { capability: 'money.transaction.read', accountId: 'acct-1' } } as any,
  );
} catch (error) {
  denied = error instanceof Error && error.message.startsWith('MONEY_ACCOUNT_ACCESS_DENIED');
}
if (!denied) throw new Error('TRANSACTION_CROSS_USER_ACCESS_NOT_DENIED');
