import { randomUUID } from 'node:crypto';
import type { ActionHandler, ActionRequest } from '@jhadina/action-core';
import { assertCapability, type BankAdapter } from './bank-adapter.js';
import { type ApprovalPort } from './approval-port.js';
import { type IdempotencyStore } from './idempotency-store.js';
import { authorizeAndConsumeMoneyPermit, toExecutionAction, type MoneyExecutionPermit } from './execution-permit-gate.js';
import { createExecutionAttempt, type ExecutionAttemptStore } from './execution-attempt.js';
import type { PermitStore } from './execution-permit.js';

export type PaymentCreateAction = {
  capability: 'money.payment.create';
  provider: string;
  accountId: string;
  amount: number;
  currency: string;
  payeeId: string;
};

export type TransferCreateAction = {
  capability: 'money.transfer.create';
  provider: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
};

export type TransactionWriteAction = PaymentCreateAction | TransferCreateAction;
export type TransactionWriteResult = { providerReference: string; status: string };

export type TransactionWriteHandlerDeps = {
  getProvider: (provider: string) => BankAdapter;
  approval: ApprovalPort;
  idempotency: IdempotencyStore;
  permitStore: PermitStore;
  getExecutionPermit: (requestId: string) => Promise<MoneyExecutionPermit>;
  executionAttempts: ExecutionAttemptStore;
  policyClock?: () => string;
  assertUserWorkspace?: (userId: string) => Promise<void>;
  assertAccountAccess?: (userId: string, accountId: string) => Promise<void>;
};

function assertPositiveAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('MONEY_AMOUNT_INVALID');
}

function assertCurrency(currency: string) {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('MONEY_CURRENCY_INVALID');
}

export class MoneyTransactionWriteHandler implements ActionHandler<TransactionWriteAction, TransactionWriteResult> {
  constructor(private readonly deps: TransactionWriteHandlerDeps) {}

  supports(type: string): boolean {
    return type === 'money.payment.create' || type === 'money.transfer.create';
  }

  async execute(action: TransactionWriteAction, request: ActionRequest<TransactionWriteAction>): Promise<TransactionWriteResult> {
    if (!request.userId) throw new Error('MONEY_USER_REQUIRED');
    await this.deps.assertUserWorkspace?.(request.userId);

    assertCapability(
      { userId: request.userId, capability: action.capability, requestId: request.id },
      action.capability,
    );
    await this.deps.approval.requireApproved({
      requestId: request.id,
      userId: request.userId,
      capability: action.capability,
    });

    assertPositiveAmount(action.amount);
    assertCurrency(action.currency);

    const claim = await this.deps.idempotency.claim({
      requestId: request.id,
      userId: request.userId,
      capability: action.capability,
    });

    if (!claim.claimed) {
      if (claim.record.userId !== request.userId || claim.record.capability !== action.capability) {
        throw new Error('MONEY_IDEMPOTENCY_IDENTITY_MISMATCH');
      }
      return claim.record.status === 'completed' && claim.record.result
        ? claim.record.result
        : this.deps.idempotency.waitForCompletion(request.id);
    }

    const permit = await this.deps.getExecutionPermit(request.id);
    const executionAction = toExecutionAction(action, request);
    await authorizeAndConsumeMoneyPermit(
      this.deps.permitStore,
      permit,
      executionAction,
      this.deps.policyClock?.() ?? new Date().toISOString(),
    );

    const attempt = createExecutionAttempt({
      attemptId: randomUUID(),
      requestId: request.id,
      permitId: permit.permitId,
      action: executionAction,
      operation: action.capability,
      now: this.deps.policyClock?.() ?? new Date().toISOString(),
    });
    await this.deps.executionAttempts.start(attempt);

    const adapter = this.deps.getProvider(action.provider);
    let result: TransactionWriteResult;
    try {
      if (action.capability === 'money.payment.create') {
        await this.deps.assertAccountAccess?.(request.userId, action.accountId);
        if (!adapter.createPayment) throw new Error('MONEY_PAYMENT_UNSUPPORTED');
        result = await adapter.createPayment(
          { userId: request.userId, capability: action.capability, requestId: request.id, idempotencyKey: attempt.idempotencyKey },
          { accountId: action.accountId, amount: action.amount, currency: action.currency, payeeId: action.payeeId },
        );
      } else {
        await this.deps.assertAccountAccess?.(request.userId, action.fromAccountId);
        await this.deps.assertAccountAccess?.(request.userId, action.toAccountId);
        if (action.fromAccountId === action.toAccountId) throw new Error('MONEY_TRANSFER_SAME_ACCOUNT');
        if (!adapter.createTransfer) throw new Error('MONEY_TRANSFER_UNSUPPORTED');
        result = await adapter.createTransfer(
          { userId: request.userId, capability: action.capability, requestId: request.id, idempotencyKey: attempt.idempotencyKey },
          { fromAccountId: action.fromAccountId, toAccountId: action.toAccountId, amount: action.amount, currency: action.currency },
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.deps.executionAttempts.complete(attempt.attemptId, {
        state: 'UNKNOWN',
        errorCode: 'MONEY_PROVIDER_OUTCOME_UNKNOWN',
        errorMessage: message,
        recoveryRequired: true,
      });
      throw new Error(`MONEY_EXECUTION_RECOVERY_REQUIRED:${attempt.attemptId}`);
    }

    await this.deps.executionAttempts.complete(attempt.attemptId, {
      state: 'SUCCEEDED',
      providerReference: result.providerReference,
      recoveryRequired: false,
    });
    await this.deps.idempotency.complete(request.id, result);
    return result;
  }
}
