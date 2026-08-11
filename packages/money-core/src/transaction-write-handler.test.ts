import { MoneyTransactionWriteHandler } from './transaction-write-handler.js';
import type { ApprovalPort } from './approval-port.js';

const calls: string[] = [];
let approvalCalls = 0;
const approval: ApprovalPort = {
  async requireApproved(request) {
    approvalCalls++;
    if (request.requestId === 'reject-1') throw new Error('MONEY_APPROVAL_REJECTED');
  },
};

const handler = new MoneyTransactionWriteHandler({
  getProvider: () => ({
    provider: 'test-bank',
    async listAccounts() { return []; },
    async listTransactions() { return []; },
    async createPayment(context, input) {
      calls.push(`payment:${context.userId}:${context.capability}:${input.accountId}`);
      return { providerReference: 'pay-1', status: 'submitted' };
    },
    async createTransfer(context, input) {
      calls.push(`transfer:${context.userId}:${context.capability}:${input.fromAccountId}:${input.toAccountId}`);
      return { providerReference: 'tr-1', status: 'submitted' };
    },
  }),
  approval,
  assertUserWorkspace: async () => {},
  assertAccountAccess: async (userId, accountId) => {
    if (userId === 'user-1' && ['acct-1', 'acct-2'].includes(accountId)) return;
    throw new Error(`MONEY_ACCOUNT_ACCESS_DENIED:${accountId}`);
  },
});

const payment = await handler.execute(
  { capability: 'money.payment.create', provider: 'test-bank', accountId: 'acct-1', amount: 25, currency: 'USD', payeeId: 'payee-1' },
  { id: 'req-1', requestId: 'req-1', userId: 'user-1', action: {} } as any,
);
if (payment.providerReference !== 'pay-1' || calls[0] !== 'payment:user-1:money.payment.create:acct-1') throw new Error('PAYMENT_WRITE_FAILED');

const transfer = await handler.execute(
  { capability: 'money.transfer.create', provider: 'test-bank', fromAccountId: 'acct-1', toAccountId: 'acct-2', amount: 10, currency: 'USD' },
  { id: 'req-2', requestId: 'req-2', userId: 'user-1', action: {} } as any,
);
if (transfer.providerReference !== 'tr-1' || calls[1] !== 'transfer:user-1:money.transfer.create:acct-1:acct-2') throw new Error('TRANSFER_WRITE_FAILED');

const cases: Array<[string, any, string]> = [
  ['bad amount', { capability: 'money.payment.create', provider: 'test-bank', accountId: 'acct-1', amount: 0, currency: 'USD', payeeId: 'p' }, 'MONEY_AMOUNT_INVALID'],
  ['bad currency', { capability: 'money.payment.create', provider: 'test-bank', accountId: 'acct-1', amount: 1, currency: 'usd', payeeId: 'p' }, 'MONEY_CURRENCY_INVALID'],
  ['same transfer account', { capability: 'money.transfer.create', provider: 'test-bank', fromAccountId: 'acct-1', toAccountId: 'acct-1', amount: 1, currency: 'USD' }, 'MONEY_TRANSFER_SAME_ACCOUNT'],
  ['unauthorized account', { capability: 'money.payment.create', provider: 'test-bank', accountId: 'acct-x', amount: 1, currency: 'USD', payeeId: 'p' }, 'MONEY_ACCOUNT_ACCESS_DENIED'],
];

for (const [name, action, expected] of cases) {
  let error = '';
  try {
    await handler.execute(action, { id: `req-${name}`, requestId: `req-${name}`, userId: 'user-1', action: {} } as any);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  if (!error.startsWith(expected)) throw new Error(`${name.toUpperCase().replaceAll(' ', '_')}_NOT_REJECTED:${error}`);
}

let missingUser = false;
try {
  await handler.execute(
    { capability: 'money.payment.create', provider: 'test-bank', accountId: 'acct-1', amount: 1, currency: 'USD', payeeId: 'p' },
    { id: 'req-no-user', requestId: 'req-no-user', userId: '', action: {} } as any,
  );
} catch (e) {
  missingUser = e instanceof Error && e.message === 'MONEY_USER_REQUIRED';
}
if (!missingUser) throw new Error('MISSING_USER_NOT_REJECTED');

let rejected = false;
const beforeCalls = calls.length;
try {
  await handler.execute(
    { capability: 'money.payment.create', provider: 'test-bank', accountId: 'acct-1', amount: 5, currency: 'USD', payeeId: 'p' },
    { id: 'reject-1', requestId: 'reject-1', userId: 'user-1', action: {} } as any,
  );
} catch (e) {
  rejected = e instanceof Error && e.message === 'MONEY_APPROVAL_REJECTED';
}
if (!rejected || calls.length !== beforeCalls) throw new Error('REJECTED_APPROVAL_REACHED_PROVIDER');
if (approvalCalls < 3) throw new Error('APPROVAL_PORT_NOT_CALLED');
