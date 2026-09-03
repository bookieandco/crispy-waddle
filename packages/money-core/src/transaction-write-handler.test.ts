import { MoneyTransactionWriteHandler } from './transaction-write-handler.js';
import { createInMemoryIdempotencyStore } from './idempotency-store.js';
import { issueExecutionPermit, type ExecutionPermit, type PermitStore } from './execution-permit.js';
import type { ExecutionAttempt, ExecutionAttemptStore } from './execution-attempt.js';
import type { ApprovalPort } from './approval-port.js';

const calls: string[] = [];
const idempotencyKeys: string[] = [];
let approvalCalls = 0;

const approval: ApprovalPort = {
  async requireApproved(request) {
    approvalCalls++;
    if (request.requestId === 'reject-1') throw new Error('MONEY_APPROVAL_REJECTED');
  },
};

class InMemoryExecutionAttemptStore implements ExecutionAttemptStore {
  readonly attempts = new Map<string, ExecutionAttempt>();
  start(attempt: ExecutionAttempt) {
    if (this.attempts.has(attempt.attemptId)) throw new Error('ATTEMPT_ALREADY_EXISTS');
    this.attempts.set(attempt.attemptId, { ...attempt });
  }
  complete(attemptId: string, outcome: Pick<ExecutionAttempt, 'state' | 'providerReference' | 'errorCode' | 'errorMessage' | 'recoveryRequired'>, completedAt = new Date().toISOString()) {
    const current = this.attempts.get(attemptId);
    if (!current || current.state !== 'STARTED') throw new Error('ATTEMPT_NOT_STARTABLE');
    this.attempts.set(attemptId, { ...current, ...outcome, completedAt });
  }
  get(attemptId: string) {
    const attempt = this.attempts.get(attemptId);
    return attempt ? { ...attempt } : undefined;
  }
}

class InMemoryPermitStore implements PermitStore {
  readonly permits = new Map<string, ExecutionPermit>();
  issue(permit: ExecutionPermit) { this.permits.set(permit.permitId, { ...permit, binding: { ...permit.binding } }); }
  get(permitId: string) { const permit = this.permits.get(permitId); return permit ? { ...permit, binding: { ...permit.binding } } : undefined; }
  consume(permitId: string, nonce: string) {
    const permit = this.permits.get(permitId);
    if (!permit || permit.nonce !== nonce || permit.state !== 'ISSUED') return false;
    this.permits.set(permitId, { ...permit, state: 'CONSUMED' });
    return true;
  }
  revoke(permitId: string) { const permit = this.permits.get(permitId); if (permit) this.permits.set(permitId, { ...permit, state: 'REVOKED' }); }
  haltAll() { for (const [id, permit] of this.permits) if (permit.state === 'ISSUED') this.permits.set(id, { ...permit, state: 'HALTED' }); }
}

const permitStore = new InMemoryPermitStore();
const executionAttempts = new InMemoryExecutionAttemptStore();
const requestPermits = new Map<string, ExecutionPermit>();
const currentActions = new Map<string, any>();

const handler = new MoneyTransactionWriteHandler({
  getProvider: () => ({
    provider: 'test-bank',
    async listAccounts() { return []; },
    async listTransactions() { return []; },
    async createPayment(context, input) {
      calls.push(`payment:${context.userId}:${context.capability}:${input.accountId}`);
      idempotencyKeys.push(context.idempotencyKey ?? '');
      if (context.requestId === 'provider-fails') throw new Error('TEST_PROVIDER_TIMEOUT');
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { providerReference: 'pay-1', status: 'submitted' };
    },
    async createTransfer(context, input) {
      calls.push(`transfer:${context.userId}:${context.capability}:${input.fromAccountId}:${input.toAccountId}`);
      idempotencyKeys.push(context.idempotencyKey ?? '');
      return { providerReference: 'tr-1', status: 'submitted' };
    },
  }),
  approval,
  idempotency: createInMemoryIdempotencyStore(),
  permitStore,
  getExecutionPermit: async (requestId) => {
    const existing = requestPermits.get(requestId);
    if (existing) return existing;
    const action = currentActions.get(requestId);
    if (!action) throw new Error('TEST_ACTION_NOT_REGISTERED');
    const executionAction = {
      actionId: requestId, userId: 'user-1', capability: action.capability, provider: action.provider,
      accountId: action.accountId, fromAccountId: action.fromAccountId, toAccountId: action.toAccountId,
      payeeId: action.payeeId, amount: String(action.amount), currency: action.currency,
    };
    const permit = issueExecutionPermit({
      action: executionAction, policyVersion: 'test-policy-v1', policyHash: 'test-policy-hash',
      expiresAt: '2099-01-01T00:00:00.000Z', now: '2026-09-02T00:00:00.000Z',
      permitId: `permit-${requestId}`, nonce: `nonce-${requestId}`,
    });
    permitStore.issue(permit);
    requestPermits.set(requestId, permit);
    return permit;
  },
  executionAttempts,
  policyClock: () => '2026-09-02T00:00:00.000Z',
  assertUserWorkspace: async () => {},
  assertAccountAccess: async (userId, accountId) => {
    if (userId === 'user-1' && ['acct-1', 'acct-2'].includes(accountId)) return;
    throw new Error(`MONEY_ACCOUNT_ACCESS_DENIED:${accountId}`);
  },
});

const request = (requestId: string, action: any = {}) => {
  currentActions.set(requestId, action);
  return { id: requestId, requestId, userId: 'user-1', action } as any;
};

const paymentAction = { capability: 'money.payment.create', provider: 'test-bank', accountId: 'acct-1', amount: 25, currency: 'USD', payeeId: 'payee-1' };
const payment = await handler.execute(paymentAction, request('req-1', paymentAction));
if (payment.providerReference !== 'pay-1' || calls[0] !== 'payment:user-1:money.payment.create:acct-1') throw new Error('PAYMENT_WRITE_FAILED');
const firstAttempt = [...executionAttempts.attempts.values()][0];
if (!firstAttempt || firstAttempt.state !== 'SUCCEEDED' || firstAttempt.providerReference !== 'pay-1' || firstAttempt.recoveryRequired) throw new Error('EXECUTION_ATTEMPT_SUCCESS_NOT_RECORDED');
if (!idempotencyKeys[0]) throw new Error('PROVIDER_IDEMPOTENCY_KEY_MISSING');

const transferAction = { capability: 'money.transfer.create', provider: 'test-bank', fromAccountId: 'acct-1', toAccountId: 'acct-2', amount: 10, currency: 'USD' };
const transfer = await handler.execute(transferAction, request('req-2', transferAction));
if (transfer.providerReference !== 'tr-1' || calls[1] !== 'transfer:user-1:money.transfer.create:acct-1:acct-2') throw new Error('TRANSFER_WRITE_FAILED');

const cases: Array<[string, any, string]> = [
  ['bad amount', { ...paymentAction, amount: 0 }, 'MONEY_AMOUNT_INVALID'],
  ['bad currency', { ...paymentAction, amount: 1, currency: 'usd' }, 'MONEY_CURRENCY_INVALID'],
  ['same transfer account', { ...transferAction, fromAccountId: 'acct-1', toAccountId: 'acct-1', amount: 1 }, 'MONEY_TRANSFER_SAME_ACCOUNT'],
  ['unauthorized account', { ...paymentAction, accountId: 'acct-x', amount: 1 }, 'MONEY_ACCOUNT_ACCESS_DENIED'],
];
for (const [name, action, expected] of cases) {
  let error = '';
  try { await handler.execute(action, request(`req-${name}`, action)); } catch (e) { error = e instanceof Error ? e.message : String(e); }
  if (!error.startsWith(expected)) throw new Error(`${name.toUpperCase().replaceAll(' ', '_')}_NOT_REJECTED:${error}`);
}

let missingUser = false;
try { await handler.execute(paymentAction, { id: 'req-no-user', requestId: 'req-no-user', userId: '', action: paymentAction } as any); }
catch (e) { missingUser = e instanceof Error && e.message === 'MONEY_USER_REQUIRED'; }
if (!missingUser) throw new Error('MISSING_USER_NOT_REJECTED');

let rejected = false;
const beforeCalls = calls.length;
try { await handler.execute({ ...paymentAction, amount: 5 }, request('reject-1', { ...paymentAction, amount: 5 })); }
catch (e) { rejected = e instanceof Error && e.message === 'MONEY_APPROVAL_REJECTED'; }
if (!rejected || calls.length !== beforeCalls) throw new Error('REJECTED_APPROVAL_REACHED_PROVIDER');

const concurrentId = 'race-1';
const concurrentAction = { ...paymentAction, amount: 7 };
const beforeRace = calls.length;
const results = await Promise.all(Array.from({ length: 10 }, () => handler.execute(concurrentAction, request(concurrentId, concurrentAction))));
if (results.length !== 10 || results.some((r) => r.providerReference !== 'pay-1')) throw new Error('IDEMPOTENCY_RESULT_MISMATCH');
if (calls.length !== beforeRace + 1) throw new Error(`IDEMPOTENCY_DUPLICATE_PROVIDER_CALLS:${calls.length - beforeRace}`);
if (approvalCalls < 10) throw new Error('APPROVAL_PORT_NOT_CALLED');

const providerFailureAction = { ...paymentAction, amount: 9 };
let recoveryError = '';
try { await handler.execute(providerFailureAction, request('provider-fails', providerFailureAction)); }
catch (e) { recoveryError = e instanceof Error ? e.message : String(e); }
if (!recoveryError.startsWith('MONEY_EXECUTION_RECOVERY_REQUIRED:')) throw new Error(`PROVIDER_FAILURE_NOT_ESCALATED:${recoveryError}`);
const failedAttempt = [...executionAttempts.attempts.values()].find((attempt) => attempt.requestId === 'provider-fails');
if (!failedAttempt || failedAttempt.state !== 'UNKNOWN' || !failedAttempt.recoveryRequired || failedAttempt.errorCode !== 'MONEY_PROVIDER_OUTCOME_UNKNOWN') throw new Error('PROVIDER_FAILURE_NOT_MARKED_UNKNOWN');

const stableAction = { ...paymentAction, amount: 11 };
await handler.execute(stableAction, request('stable-key-1', stableAction));
const stableAttempt = [...executionAttempts.attempts.values()].find((attempt) => attempt.requestId === 'stable-key-1');
if (!stableAttempt || !stableAttempt.idempotencyKey) throw new Error('STABLE_ATTEMPT_KEY_MISSING');
if (stableAttempt.idempotencyKey !== idempotencyKeys[idempotencyKeys.length - 1]) throw new Error('PROVIDER_KEY_MISMATCH');
