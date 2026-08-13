import {
  createProductionActionExecutor,
  SecurityCoreActionPolicy,
  type ActionIdentityVerifier,
  type AuditRpcClient,
} from '@jhadina/action-core';
import { createMoneySecurityCore } from './governed-account-read.js';
import { MoneyAccountReadHandler, type AccountReadHandlerDeps, type AccountReadAction } from './account-read-handler.js';
import type { MoneyAccount } from './bank-adapter.js';

export type ProductionMoneyAccountReadOptions = {
  identityVerifier: ActionIdentityVerifier;
  supabase: AuditRpcClient;
  bank: AccountReadHandlerDeps;
};

/** First real Money Core capability composed through the shared production spine. */
export function createProductionMoneyAccountReadExecutor(
  options: ProductionMoneyAccountReadOptions,
) {
  const policy = new SecurityCoreActionPolicy<AccountReadAction>(
    createMoneySecurityCore(),
    'money',
  );

  const handler = new MoneyAccountReadHandler(options.bank);

  return createProductionActionExecutor<AccountReadAction, MoneyAccount[]>({
    identityVerifier: options.identityVerifier,
    policy,
    handlers: [handler],
    supabase: options.supabase,
    domain: 'money',
    capabilityForType: () => 'money.account.read',
  });
}
