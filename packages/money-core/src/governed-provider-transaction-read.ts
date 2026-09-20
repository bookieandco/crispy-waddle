import type { ActionIdentityVerifier, AuditRpcClient, VerifiedActionExecutor, ActionRequest } from '@jhadina/action-core';
import { MoneyProviderHealthGate, type ProviderConfig, type ProviderHealthChecker } from './provider-health.js';
import type { BankAdapter, MoneyTransaction } from './bank-adapter.js';
import type { TransactionReadAction, MoneyAccountOwnership } from './transaction-read-handler.js';
import { createProductionMoneyTransactionReadExecutor } from './production-transaction-read.js';

export type GovernedProviderTransactionReadOptions={identityVerifier:ActionIdentityVerifier;supabase:AuditRpcClient;provider:BankAdapter;providerConfig?:Readonly<Record<string,ProviderConfig>>;healthChecker?:ProviderHealthChecker;ownership:(userId:string)=>MoneyAccountOwnership};
export function createGovernedProviderTransactionReadExecutor(options:GovernedProviderTransactionReadOptions):VerifiedActionExecutor<TransactionReadAction,MoneyTransaction[]> {
  const healthGate=new MoneyProviderHealthGate(options.providerConfig,options.healthChecker);
  const executor=createProductionMoneyTransactionReadExecutor({identityVerifier:options.identityVerifier,supabase:options.supabase,provider:options.provider,ownership:options.ownership});
  const original=executor.execute.bind(executor);
  return {async execute(request:ActionRequest<TransactionReadAction>){const identity=await options.identityVerifier.verify(request);if(identity.userId!==request.userId)throw new Error('Action identity mismatch');if(!identity.sessionId)throw new Error('Action session missing');await healthGate.requireReady(options.provider,'money.transaction.read');return original(request)}} as VerifiedActionExecutor<TransactionReadAction,MoneyTransaction[]>;
}
