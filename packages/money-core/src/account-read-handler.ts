import type { ActionHandler, ActionRequest } from '@jhadina/action-core';
import { assertCapability, type BankAdapter, type MoneyAccount } from './bank-adapter.js';

export type AccountReadAction = {
  capability: 'money.account.read';
  provider: string;
};

export type AccountReadHandlerDeps = {
  getProvider: (provider: string) => BankAdapter;
  assertUserWorkspace?: (userId: string) => Promise<void>;
};

export class MoneyAccountReadHandler implements ActionHandler<AccountReadAction, MoneyAccount[]> {
  constructor(private readonly deps: AccountReadHandlerDeps) {}

  supports(type: string): boolean {
    return type === 'money.account.read';
  }

  async execute(action: AccountReadAction, request: ActionRequest<AccountReadAction>): Promise<MoneyAccount[]> {
    if (!request.userId) throw new Error('MONEY_USER_REQUIRED');
    await this.deps.assertUserWorkspace?.(request.userId);

    const context = {
      userId: request.userId,
      capability: action.capability,
      requestId: request.id,
    } as const;
    assertCapability(context, 'money.account.read');

    const adapter = this.deps.getProvider(action.provider);
    return adapter.listAccounts(context);
  }
}
