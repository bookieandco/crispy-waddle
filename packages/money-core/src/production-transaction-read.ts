import { createProductionActionExecutor, SecurityCoreActionPolicy, type ActionIdentityVerifier, type AuditRpcClient } from '@jhadina/action-core';
import { createMoneySecurityCore } from './governed-account-read.js';
import { MoneyTransactionReadHandler, type TransactionReadAction, type MoneyAccountOwnership } from './transaction-read-handler.js';
import type { BankAdapter, MoneyTransaction } from './bank-adapter.js';

export type ProductionMoneyTransactionReadOptions={identityVerifier:ActionIdentityVerifier;supabase:AuditRpcClient;provider:BankAdapter;ownership:(userId:string)=>MoneyAccountOwnership};
export function createProductionMoneyTransactionReadExecutor(options:ProductionMoneyTransactionReadOptions){
  return createProductionActionExecutor<TransactionReadAction,MoneyTransaction[]>({identityVerifier:options.identityVerifier,policy:new SecurityCoreActionPolicy<TransactionReadAction>(createMoneySecurityCore(),'money'),handlers:[new MoneyTransactionReadHandler(options.provider,options.ownership)],supabase:options.supabase,domain:'money',capabilityForType:()=> 'money.transaction.read'});
}
