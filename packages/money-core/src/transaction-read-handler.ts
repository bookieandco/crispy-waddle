import type { ActionHandler, ActionRequest } from '@jhadina/action-core';
import { assertCapability, type BankAdapter, type MoneyTransaction } from './bank-adapter.js';

export type TransactionReadAction = {
  capability: 'money.transaction.read';
  accountId: string;
};

export type MoneyAccountOwnership = {
  userId: string;
  accountIds: ReadonlySet<string>;
};

export class MoneyTransactionReadHandler implements ActionHandler<TransactionReadAction, MoneyTransaction[]> {
  constructor(
    private readonly provider: BankAdapter,
    private readonly ownership: (userId: string) => MoneyAccountOwnership,
  ) {}

  supports(type: string): boolean {
    return type === 'money.transaction.read';
  }

  async execute(
    action: TransactionReadAction,
    request: ActionRequest<TransactionReadAction>,
  ): Promise<MoneyTransaction[]> {
    if (!request.userId) throw new Error('MONEY_USER_REQUIRED');
    assertCapability({ userId: request.userId, capability: action.capability, requestId: request.id }, 'money.transaction.read');

    const owner = this.ownership(request.userId);
    if (owner.userId !== request.userId || !owner.accountIds.has(action.accountId)) {
      throw new Error(`MONEY_ACCOUNT_ACCESS_DENIED:${action.accountId}`);
    }

    return this.provider.listTransactions({
      userId: request.userId,
      capability: action.capability,
      requestId: request.id,
    }, action.accountId);
  }
}
