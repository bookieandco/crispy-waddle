import { createGovernedProviderTransactionReadExecutor, type MoneyTransaction } from "@jhadina/money-core"
import type { ActionIdentityVerifier, AuditRpcClient } from "@jhadina/action-core"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import { createMoneyAuditRpcClient } from "./durable-audit-ledger"
import { createMoneyOwnershipResolver, type MoneyOwnershipResolver } from "./ownership-resolver"
import { createMoneyPlaidProductionRegistry, PLAID_PROVIDER, type MoneyPlaidProductionRegistry } from "./production-provider"

export type GovernedTransactionRuntimeOverrides={identityVerifier?:JhadinaIdentityVerifier;supabase?:AuditRpcClient;providers?:MoneyPlaidProductionRegistry;ownershipResolver?:MoneyOwnershipResolver}
function toActionIdentityVerifier(verifier:JhadinaIdentityVerifier):ActionIdentityVerifier{return {async verify(request){return verifier.verify({userId:request.userId})}}}

/** Session-authoritative transaction read. Ownership fails closed until a durable per-user bank-connection map is supplied. */
export async function runSessionGovernedMoneyTransactionRead(accountId:string,requestId:string,overrides:GovernedTransactionRuntimeOverrides={}):Promise<{transactions:readonly MoneyTransaction[];verifiedUserId:string}>{
  const identityVerifier=overrides.identityVerifier??(await createRequestIdentityVerifier());const identity=await identityVerifier.verify({});
  const supabase=overrides.supabase??(await createMoneyAuditRpcClient());const {registry,providerConfig}=overrides.providers??(await createMoneyPlaidProductionRegistry());
  const ownershipResolver=overrides.ownershipResolver??(await createMoneyOwnershipResolver());
  const owned=await ownershipResolver.ownedAccountIds(identity.userId);
  const executor=createGovernedProviderTransactionReadExecutor({identityVerifier:toActionIdentityVerifier(identityVerifier),supabase,provider:registry.get(PLAID_PROVIDER),providerConfig,ownership:(userId)=>({userId,accountIds:owned})});
  const transactions=await executor.execute({id:requestId,userId:identity.userId,type:"money.transaction.read",requestedAt:new Date().toISOString(),action:{capability:"money.transaction.read",accountId}});
  return {transactions,verifiedUserId:identity.userId};
}
