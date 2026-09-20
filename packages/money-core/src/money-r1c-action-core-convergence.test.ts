import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ActionExecutor,
  InMemoryActionLedger,
  InMemoryApprovalReceiptStore,
  createApprovalReceiptVerifier,
  type ActionPolicy,
  type ActionRequest,
} from '@jhadina/action-core';
import {
  createMoneyActionCoreAuthority,
  issueActionCoreBoundExecutionPermit,
} from './action-core-authority-bridge.js';
import type {
  ExecutionAttempt,
  ExecutionAttemptOutcome,
  ExecutionAttemptStore,
} from './execution-attempt.js';
import type {
  ExecutionPermit,
  PermitStore,
} from './execution-permit.js';
import type { MoneyExecutionPermit } from './execution-permit-gate.js';
import { createInMemoryIdempotencyStore } from './idempotency-store.js';
import {
  MoneyTransactionWriteHandler,
  type PaymentCreateAction,
  type TransactionWriteAction,
} from './transaction-write-handler.js';

function approvalFingerprint(
  request: Pick<
    ActionRequest<TransactionWriteAction>,
    'id' | 'userId' | 'type' | 'action' | 'requestedAt'
  >,
): string {
  return JSON.stringify({
    id: request.id,
    userId: request.userId,
    type: request.type,
    action: request.action,
    requestedAt: request.requestedAt,
  });
}

class PermitMemoryStore implements PermitStore {
  private readonly values = new Map<string, ExecutionPermit>();

  issue(permit: ExecutionPermit): void {
    this.values.set(permit.permitId, permit);
  }

  get(permitId: string): ExecutionPermit | undefined {
    return this.values.get(permitId);
  }

  consume(permitId: string, nonce: string): boolean {
    const permit = this.values.get(permitId);
    if (
      !permit ||
      permit.state !== 'ISSUED' ||
      permit.nonce !== nonce
    ) {
      return false;
    }
    this.values.set(
      permitId,
      Object.freeze({ ...permit, state: 'CONSUMED' }),
    );
    return true;
  }

  revoke(permitId: string): void {
    const permit = this.values.get(permitId);
    if (permit) {
      this.values.set(
        permitId,
        Object.freeze({ ...permit, state: 'REVOKED' }),
      );
    }
  }

  haltAll(): void {
    for (const [id, permit] of this.values) {
      if (permit.state === 'ISSUED') {
        this.values.set(
          id,
          Object.freeze({ ...permit, state: 'HALTED' }),
        );
      }
    }
  }
}

class AttemptMemoryStore implements ExecutionAttemptStore {
  readonly values = new Map<string, ExecutionAttempt>();

  start(attempt: ExecutionAttempt): void {
    this.values.set(attempt.attemptId, attempt);
  }

  complete(
    attemptId: string,
    outcome: ExecutionAttemptOutcome,
    completedAt = '2026-09-02T00:00:05Z',
  ): void {
    const current = this.values.get(attemptId);
    if (!current) throw new Error('ATTEMPT_NOT_FOUND');
    this.values.set(attemptId, {
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
    this.complete(attemptId, outcome, completedAt);
  }

  get(attemptId: string): ExecutionAttempt | undefined {
    return this.values.get(attemptId);
  }
}

function permitRef(
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
  };
}

test('canonical chain is ActionRequest -> policy -> approval -> permit -> attempt -> provider', async () => {
  const providerCalls: string[] = [];
  const permitStore = new PermitMemoryStore();
  const attemptStore = new AttemptMemoryStore();

  const action: PaymentCreateAction = {
    capability: 'money.payment.create',
    provider: 'test-bank',
    accountId: 'acct-1',
    amount: 15,
    currency: 'USD',
    payeeId: 'payee-1',
  };

  const baseRequest: ActionRequest<TransactionWriteAction> = {
    id: 'chain-1',
    userId: 'user-1',
    type: action.capability,
    action,
    requestedAt: '2026-09-02T00:00:00Z',
  };

  const approvalStore = new InMemoryApprovalReceiptStore();
  const pending = await approvalStore.createPending({
    actionId: baseRequest.id,
    userId: baseRequest.userId,
    type: baseRequest.type,
    fingerprint: approvalFingerprint(baseRequest),
    expiresAt: '2099-01-01T00:00:00Z',
  });
  await approvalStore.approve(pending.id, baseRequest.userId);

  const approvedRequest: ActionRequest<TransactionWriteAction> = {
    ...baseRequest,
    approvalReceiptId: pending.id,
  };

  const policy: ActionPolicy<TransactionWriteAction> = {
    async evaluate() {
      return 'approval_required';
    },
  };

  const handler = new MoneyTransactionWriteHandler({
    getProvider: () => ({
      provider: 'test-bank',
      async listAccounts() {
        return [];
      },
      async listTransactions() {
        return [];
      },
      async createPayment(_context, input) {
        providerCalls.push(input.accountId);
        return {
          providerReference: 'provider-payment-1',
          status: 'submitted',
        };
      },
    }),
    idempotency: createInMemoryIdempotencyStore(),
    permitStore,
    async getExecutionPermit(request, executionAction) {
      // This function runs only after ActionExecutor has accepted policy and
      // consumed the Action Core approval receipt.
      const authority = createMoneyActionCoreAuthority(request, {
        authorityId: 'action-core-authority:chain-1',
        decision: 'approval_required',
        policyVersion: 'action-core-policy:v1',
        policyHash: 'action-core-policy-hash',
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
          permitId: 'permit:chain-1',
          nonce: 'nonce:chain-1',
        },
      );
      permitStore.issue(permit);
      return permitRef(permit);
    },
    executionAttempts: attemptStore,
    policyClock: () => '2026-09-02T00:00:03Z',
    assertAccountAccess: async () => {},
  });

  const executor = new ActionExecutor<
    TransactionWriteAction,
    { providerReference: string; status: string }
  >(
    policy,
    new InMemoryActionLedger(),
    [handler],
    createApprovalReceiptVerifier(
      approvalStore,
      approvalFingerprint,
    ),
  );

  const result = await executor.execute(approvedRequest);
  assert.equal(result.providerReference, 'provider-payment-1');
  assert.deepEqual(providerCalls, ['acct-1']);
  assert.equal(attemptStore.values.size, 1);
  assert.equal(
    permitStore.get('permit:chain-1')?.state,
    'CONSUMED',
  );
});

test('missing Action Core approval prevents permit, attempt, and provider execution', async () => {
  let permitRequests = 0;
  let providerCalls = 0;

  const action: PaymentCreateAction = {
    capability: 'money.payment.create',
    provider: 'test-bank',
    accountId: 'acct-1',
    amount: 15,
    currency: 'USD',
    payeeId: 'payee-1',
  };
  const request: ActionRequest<TransactionWriteAction> = {
    id: 'chain-denied',
    userId: 'user-1',
    type: action.capability,
    action,
    requestedAt: '2026-09-02T00:00:00Z',
  };

  const policy: ActionPolicy<TransactionWriteAction> = {
    async evaluate() {
      return 'approval_required';
    },
  };

  const handler = new MoneyTransactionWriteHandler({
    getProvider: () => ({
      provider: 'test-bank',
      async listAccounts() {
        return [];
      },
      async listTransactions() {
        return [];
      },
      async createPayment() {
        providerCalls += 1;
        return {
          providerReference: 'should-not-run',
          status: 'submitted',
        };
      },
    }),
    idempotency: createInMemoryIdempotencyStore(),
    permitStore: new PermitMemoryStore(),
    async getExecutionPermit() {
      permitRequests += 1;
      throw new Error('SHOULD_NOT_REQUEST_PERMIT');
    },
    executionAttempts: new AttemptMemoryStore(),
  });

  const executor = new ActionExecutor<
    TransactionWriteAction,
    { providerReference: string; status: string }
  >(policy, new InMemoryActionLedger(), [handler]);

  await assert.rejects(
    () => executor.execute(request),
    /Approval required/,
  );
  assert.equal(permitRequests, 0);
  assert.equal(providerCalls, 0);
});
