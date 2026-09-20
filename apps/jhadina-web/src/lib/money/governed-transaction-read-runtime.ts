import { createGovernedProviderTransactionReadExecutor, MoneyProviderRegistry, PLAID_READ_ONLY_CONFIG, type MoneyTransaction } from "@jhadina/money-core"
import type { ActionIdentityVerifier, AuditRpcClient } from "@jhadina/action-core"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import { createMoneyAuditRpcClient } from "./durable-audit-ledger"
import { createMoneyOwnershipResolver, type MoneyOwnershipResolver } from "./ownership-resolver"
import { PLAID_PROVIDER, type MoneyPlaidProductionRegistry } from "./production-provider"

export type GovernedTransactionRuntimeOverrides={identityVerifier?:JhadinaIdentityVerifier;supabase?:AuditRpcClient;providers?:MoneyPlaidProductionRegistry;ownershipResolver?:MoneyOwnershipResolver}
function toActionIdentityVerifier(verifier:JhadinaIdentityVerifier):ActionIdentityVerifier{return {async verify(request){return verifier.verify({userId:request.userId})}}}

/** Session-authoritative transaction read. Durable per-user ownership is required and unknown/revoked accounts fail closed before provider I/O. */
export async function runSessionGovernedMoneyTransactionRead(accountId:string,requestId:string,overrides:GovernedTransactionRuntimeOverrides={}):Promise<{transactions:readonly MoneyTransaction[];verifiedUserId:string}>{
  const identityVerifier=overrides.identityVerifier??(await createRequestIdentityVerifier());const identity=await identityVerifier.verify({});
  const supabase=overrides.supabase??(await createMoneyAuditRpcClient());
  const ownershipResolver=overrides.ownershipResolver??(await createMoneyOwnershipResolver());
  const owned=await ownershipResolver.ownedAccountIds(identity.userId);
  let registry:MoneyProviderRegistry;let providerConfig:Readonly<Record<string,typeof PLAID_READ_ONLY_CONFIG>>;
  if(overrides.providers){registry=overrides.providers.registry;providerConfig=overrides.providers.providerConfig as Readonly<Record<string,typeof PLAID_READ_ONLY_CONFIG>>}else{const adapter=await ownershipResolver.adapterForAccount(identity.userId,accountId);registry=new MoneyProviderRegistry();registry.register(adapter);providerConfig={[PLAID_PROVIDER]:PLAID_READ_ONLY_CONFIG}}
  const executor=createGovernedProviderTransactionReadExecutor({identityVerifier:toActionIdentityVerifier(identityVerifier),supabase,provider:registry.get(PLAID_PROVIDER),providerConfig,ownership:(userId)=>({userId,accountIds:owned})});
  const transactions=await executor.execute({id:requestId,userId:identity.userId,type:"money.transaction.read",requestedAt:new Date().toISOString(),action:{capability:"money.transaction.read",accountId}});
  return {transactions,verifiedUserId:identity.userId};
}
