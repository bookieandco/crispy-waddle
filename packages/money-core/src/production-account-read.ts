import type { ActionIdentityVerifier, AuditRpcClient, VerifiedActionExecutor } from '@jhadina/action-core';
import type { AccountReadAction } from './account-read-handler.js';
import { MoneyAccountReadHandler } from './account-read-handler.js';
import type { BankAdapter, MoneyAccount } from './bank-adapter.js';

export type ProductionMoneyAccountReadOptions = {
  identityVerifier: ActionIdentityVerifier;
  supabase: AuditRpcClient;
  bank: {
    getProvider(provider: string): BankAdapter;
    assertUserWorkspace?(userId: string): Promise<void>;
  };
};

export function createProductionMoneyAccountReadExecutor(
  options: ProductionMoneyAccountReadOptions,
): VerifiedActionExecutor<AccountReadAction, MoneyAccount[]> {
  const handler = new MoneyAccountReadHandler(options.identityVerifier, options.supabase, options.bank);
  return handler as unknown as VerifiedActionExecutor<AccountReadAction, MoneyAccount[]>;
}
