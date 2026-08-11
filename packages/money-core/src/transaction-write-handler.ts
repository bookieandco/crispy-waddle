import type { ActionHandler, ActionRequest } from '@jhadina/action-core';
import { assertCapability, type BankAdapter } from './bank-adapter.js';

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

export type TransactionWriteHandlerDeps = {
  getProvider: (provider: string) => BankAdapter;
  assertUserWorkspace?: (userId: string) => Promise<void>;
  assertApproval?: (request: ActionRequest<TransactionWriteAction>) => Promise<void>;
  assertAccountAccess?: (userId: string, accountId: string) => Promise<void>;
};

function assertPositiveAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('MONEY_AMOUNT_INVALID');
}

function assertCurrency(currency: string) {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('MONEY_CURRENCY_INVALID');
}

export class MoneyTransactionWriteHandler implements ActionHandler<TransactionWriteAction, { providerReference: string; status: string }> {
  constructor(private readonly deps: TransactionWriteHandlerDeps) {}

  supports(type: string): boolean {
    return type === 'money.payment.create' || type === 'money.transfer.create';
  }

  async execute(action: TransactionWriteAction, request: ActionRequest<TransactionWriteAction>) {
    if (!request.userId) throw new Error('MONEY_USER_REQUIRED');
    await this.deps.assertUserWorkspace?.(request.userId);
    await this.deps.assertApproval?.(request);

    assertCapability(
      { userId: request.userId, capability: action.capability, requestId: request.requestId },
      action.capability,
    );

    assertPositiveAmount(action.amount);
    assertCurrency(action.currency);

    const adapter = this.deps.getProvider(action.provider);

    if (action.capability === 'money.payment.create') {
      await this.deps.assertAccountAccess?.(request.userId, action.accountId);
      if (!adapter.createPayment) throw new Error('MONEY_PAYMENT_UNSUPPORTED');
      return adapter.createPayment(
        { userId: request.userId, capability: action.capability, requestId: request.requestId },
        { accountId: action.accountId, amount: action.amount, currency: action.currency, payeeId: action.payeeId },
      );
    }

    await this.deps.assertAccountAccess?.(request.userId, action.fromAccountId);
    await this.deps.assertAccountAccess?.(request.userId, action.toAccountId);
    if (action.fromAccountId === action.toAccountId) throw new Error('MONEY_TRANSFER_SAME_ACCOUNT');
    if (!adapter.createTransfer) throw new Error('MONEY_TRANSFER_UNSUPPORTED');
    return adapter.createTransfer(
      { userId: request.userId, capability: action.capability, requestId: request.requestId },
      { fromAccountId: action.fromAccountId, toAccountId: action.toAccountId, amount: action.amount, currency: action.currency },
    );
  }
}
