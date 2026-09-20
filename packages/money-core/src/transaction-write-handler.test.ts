import assert from 'node:assert/strict';
import test from 'node:test';
import type { ActionRequest } from '@jhadina/action-core';
import {
  createMoneyActionCoreAuthority,
  issueActionCoreBoundExecutionPermit,
} from './action-core-authority-bridge.js';
import {
  type ExecutionAttempt,
  type ExecutionAttemptOutcome,
  type ExecutionAttemptStore,
} from './execution-attempt.js';
import type {
  ExecutionAction,
  ExecutionPermit,
  PermitStore,
} from './execution-permit.js';
import type { MoneyExecutionPermit } from './execution-permit-gate.js';
import { createInMemoryIdempotencyStore } from './idempotency-store.js';
import {
  MoneyTransactionWriteHandler,
  type PaymentCreateAction,
  type TransactionWriteAction,
  type TransferCreateAction,
} from './transaction-write-handler.js';

class InMemoryExecutionAttemptStore
  implements ExecutionAttemptStore
{
  readonly attempts = new Map<string, ExecutionAttempt>();

  start(attempt: ExecutionAttempt): void {
    if (this.attempts.has(attempt.attemptId)) {
      throw new Error('ATTEMPT_ALREADY_EXISTS');
    }
    this.attempts.set(attempt.attemptId, { ...attempt });
  }

  complete(
    attemptId: string,
    outcome: ExecutionAttemptOutcome,
    completedAt = '2026-09-02T00:00:05Z',
  ): void {
    const current = this.attempts.get(attemptId);
    if (!current || current.state !== 'STARTED') {
      throw new Error('ATTEMPT_NOT_STARTABLE');
    }
    this.attempts.set(attemptId, {
      ...current,
      ...outcome,
      completedAt,
    });
  }

  resolve(
    attemptId: string,
    outcome: ExecutionAttemptOutcome,
    completedAt = '2026-09-02T00:00:05Z',
  ): void {
    const current = this.attempts.get(attemptId);
    if (!current) throw new Error('ATTEMPT_NOT_FOUND');
    this.attempts.set(attemptId, {
      ...current,
      ...outcome,
      completedAt,
    });
  }

  get(attemptId: string): ExecutionAttempt | undefined {
    const attempt = this.attempts.get(attemptId);
    return attempt ? { ...attempt } : undefined;
  }
}

class InMemoryPermitStore implements PermitStore {
  readonly permits = new Map<string, ExecutionPermit>();

  issue(permit: ExecutionPermit): void {
    this.permits.set(permit.permitId, permit);
  }

  get(permitId: string): ExecutionPermit | undefined {
    return this.permits.get(permitId);
  }

  consume(permitId: string, nonce: string): boolean {
    const permit = this.permits.get(permitId);
    if (
      !permit ||
      permit.nonce !== nonce ||
      permit.state !== 'ISSUED'
    ) {
      return false;
    }
    this.permits.set(
      permitId,
      Object.freeze({ ...permit, state: 'CONSUMED' }),
    );
    return true;
  }

  revoke(permitId: string): void {
    const permit = this.permits.get(permitId);
    if (permit) {
      this.permits.set(
        permitId,
        Object.freeze({ ...permit, state: 'REVOKED' }),
      );
    }
  }

  haltAll(): void {
    for (const [id, permit] of this.permits) {
      if (permit.state === 'ISSUED') {
        this.permits.set(
          id,
          Object.freeze({ ...permit, state: 'HALTED' }),
        );
      }
    }
  }
}

function requestFor(
  id: string,
  action: TransactionWriteAction,
): ActionRequest<TransactionWriteAction> {
  return {
    id,
    userId: 'user-1',
    type: action.capability,
    action,
    requestedAt: '2026-09-02T00:00:00Z',
    approvalReceiptId: `approval-${id}`,
  };
}

function permitReference(
  permit: ExecutionPermit,
): MoneyExecutionPermit {
  return {
    permitId: permit.permitId,
    nonce: permit.nonce,
    authorityId: permit.binding.authorityId,
    actionRequestFingerprint:
      permit.binding.actionRequestFingerprint,
    policyVersion: permit.binding.policyVersion,
    policyHash: permit.binding.policyHash,
    approvalId: permit.binding.approvalId,
    opportunityId: permit.binding.opportunityId,
    riskDecisionId: permit.binding.riskDecisionId,
    allocationDecisionId: permit.binding.allocationDecisionId,
  };
}

function createHarness() {
  const calls: string[] = [];
  const providerIdentities: string[] = [];
  const permitStore = new InMemoryPermitStore();
  const executionAttempts = new InMemoryExecutionAttemptStore();

  const handler = new MoneyTransactionWriteHandler({
    getProvider: () => ({
      provider: 'test-bank',
      async listAccounts() {
        return [];
      },
      async listTransactions() {
        return [];
      },
      async createPayment(context, input) {
        calls.push(`payment:${input.accountId}`);
        providerIdentities.push(
          `${context.executionId}:${context.idempotencyKey}:${context.actionFingerprint}`,
        );
        if (context.requestId === 'provider-fails') {
          throw new Error('TEST_PROVIDER_TIMEOUT');
        }
        return {
          providerReference: 'pay-1',
          status: 'submitted',
        };
      },
      async createTransfer(_context, input) {
        calls.push(
          `transfer:${input.fromAccountId}:${input.toAccountId}`,
        );
        return {
          providerReference: 'tr-1',
          status: 'submitted',
        };
      },
    }),
    idempotency: createInMemoryIdempotencyStore(),
    permitStore,
    async getExecutionPermit(request, executionAction) {
      const authority = createMoneyActionCoreAuthority(request, {
        authorityId: `authority-${request.id}`,
        decision: 'approval_required',
        policyVersion: 'test-policy-v1',
        policyHash: 'test-policy-hash',
        authorizedAt: '2026-09-02T00:00:01Z',
        expiresAt: '2026-09-02T00:10:00Z',
      });
      const permit = issueActionCoreBoundExecutionPermit(
        request,
        executionAction,
        authority,
        {
          expiresAt: '2026-09-02T00:05:00Z',
          now: '2026-09-02T00:00:02Z',
          permitId: `permit-${request.id}`,
          nonce: `nonce-${request.id}`,
        },
      );
      permitStore.issue(permit);
      return permitReference(permit);
    },
    executionAttempts,
    policyClock: () => '2026-09-02T00:00:03Z',
    assertUserWorkspace: async () => {},
    assertAccountAccess: async (userId, accountId) => {
      if (
        userId === 'user-1' &&
        ['acct-1', 'acct-2'].includes(accountId)
      ) {
        return;
      }
      throw new Error(
        `MONEY_ACCOUNT_ACCESS_DENIED:${accountId}`,
      );
    },
  });

  return {
    handler,
    calls,
    providerIdentities,
    permitStore,
    executionAttempts,
  };
}

test('payment follows permit -> attempt -> provider path without second approval port', async () => {
  const harness = createHarness();
  const action: PaymentCreateAction = {
    capability: 'money.payment.create',
    provider: 'test-bank',
    accountId: 'acct-1',
    amount: 25,
    currency: 'USD',
    payeeId: 'payee-1',
  };
  const result = await harness.handler.execute(
    action,
    requestFor('payment-1', action),
  );

  assert.equal(result.providerReference, 'pay-1');
  assert.deepEqual(harness.calls, ['payment:acct-1']);
  assert.equal(harness.providerIdentities.length, 1);

  const attempt = [...harness.executionAttempts.attempts.values()][0];
  assert.equal(attempt?.state, 'SUCCEEDED');
  assert.equal(attempt?.providerReference, 'pay-1');
  assert.equal(
    harness.permitStore.get('permit-payment-1')?.state,
    'CONSUMED',
  );
});

test('transfer retains account ownership checks', async () => {
  const harness = createHarness();
  const action: TransferCreateAction = {
    capability: 'money.transfer.create',
    provider: 'test-bank',
    fromAccountId: 'acct-1',
    toAccountId: 'acct-2',
    amount: 10,
    currency: 'USD',
  };
  const result = await harness.handler.execute(
    action,
    requestFor('transfer-1', action),
  );
  assert.equal(result.providerReference, 'tr-1');
  assert.deepEqual(harness.calls, ['transfer:acct-1:acct-2']);
});

test('invalid economics fail before permit/provider mutation', async () => {
  const cases: Array<
    [TransactionWriteAction, RegExp]
  > = [
    [
      {
        capability: 'money.payment.create',
        provider: 'test-bank',
        accountId: 'acct-1',
        amount: 0,
        currency: 'USD',
        payeeId: 'payee-1',
      },
      /MONEY_AMOUNT_INVALID/,
    ],
    [
      {
        capability: 'money.payment.create',
        provider: 'test-bank',
        accountId: 'acct-1',
        amount: 1,
        currency: 'usd',
        payeeId: 'payee-1',
      },
      /MONEY_CURRENCY_INVALID/,
    ],
    [
      {
        capability: 'money.transfer.create',
        provider: 'test-bank',
        fromAccountId: 'acct-1',
        toAccountId: 'acct-1',
        amount: 1,
        currency: 'USD',
      },
      /MONEY_TRANSFER_SAME_ACCOUNT/,
    ],
  ];

  for (let index = 0; index < cases.length; index += 1) {
    const harness = createHarness();
    const [action, expected] = cases[index]!;
    await assert.rejects(
      () =>
        harness.handler.execute(
          action,
          requestFor(`invalid-${index}`, action),
        ),
      expected,
    );
    assert.equal(harness.calls.length, 0);
  }
});

test('ActionRequest capability mutation fails closed', async () => {
  const harness = createHarness();
  const action: PaymentCreateAction = {
    capability: 'money.payment.create',
    provider: 'test-bank',
    accountId: 'acct-1',
    amount: 5,
    currency: 'USD',
    payeeId: 'payee-1',
  };
  const request = {
    ...requestFor('capability-mismatch', action),
    type: 'money.transfer.create',
  };

  await assert.rejects(
    () => harness.handler.execute(action, request),
    /MONEY_ACTION_REQUEST_CAPABILITY_MISMATCH/,
  );
  assert.equal(harness.calls.length, 0);
});

test('provider ambiguity creates UNKNOWN recovery-required attempt', async () => {
  const harness = createHarness();
  const action: PaymentCreateAction = {
    capability: 'money.payment.create',
    provider: 'test-bank',
    accountId: 'acct-1',
    amount: 9,
    currency: 'USD',
    payeeId: 'payee-1',
  };

  await assert.rejects(
    () =>
      harness.handler.execute(
        action,
        requestFor('provider-fails', action),
      ),
    /MONEY_EXECUTION_RECOVERY_REQUIRED/,
  );

  const attempt = [
    ...harness.executionAttempts.attempts.values(),
  ].find((candidate) => candidate.requestId === 'provider-fails');
  assert.equal(attempt?.state, 'UNKNOWN');
  assert.equal(attempt?.recoveryRequired, true);
  assert.equal(
    attempt?.errorCode,
    'MONEY_PROVIDER_OUTCOME_UNKNOWN',
  );
});

test('idempotent replay returns prior result without second provider call or permit', async () => {
  const harness = createHarness();
  const action: PaymentCreateAction = {
    capability: 'money.payment.create',
    provider: 'test-bank',
    accountId: 'acct-1',
    amount: 7,
    currency: 'USD',
    payeeId: 'payee-1',
  };
  const request = requestFor('idempotent-1', action);

  const first = await harness.handler.execute(action, request);
  const second = await harness.handler.execute(action, request);

  assert.equal(first.providerReference, 'pay-1');
  assert.equal(second.providerReference, 'pay-1');
  assert.equal(harness.calls.length, 1);
  assert.equal(harness.executionAttempts.attempts.size, 1);
});
