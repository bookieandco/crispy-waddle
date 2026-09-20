import { createClient } from "../supabase/server"
import { createServiceRoleClient } from "../supabase/service-role"
import type { BankAdapter } from "@jhadina/money-core"
import { createOwnedPlaidAdapter } from "./bank-link-runtime"

export type MoneyOwnershipResolver={ownedAccountIds(userId:string):Promise<ReadonlySet<string>>;adapterForAccount(userId:string,accountId:string):Promise<BankAdapter>;ownedAdapters(userId:string):Promise<readonly BankAdapter[]>}
async function assertIdentity(supabase:Awaited<ReturnType<typeof createClient>>,userId:string){const {data:{claims},error}=await supabase.auth.getClaims();if(error||!claims?.sub||claims.sub!==userId)throw new Error("MONEY_OWNERSHIP_IDENTITY_MISMATCH")}
function privateClient(){const client=createServiceRoleClient();if(!client)throw new Error("MONEY_PRIVATE_STORE_NOT_CONFIGURED");return client}
export async function createMoneyOwnershipResolver():Promise<MoneyOwnershipResolver>{
  const supabase=await createClient()
  return {
    async ownedAccountIds(userId){await assertIdentity(supabase,userId);const {data,error}=await supabase.rpc("jhadina_money_owned_account_ids");if(error)throw new Error(`MONEY_OWNERSHIP_LOOKUP_FAILED:${error.message}`);const rows=(data??[]) as Array<{provider_account_id?:string|null}>;return new Set(rows.map(r=>r.provider_account_id).filter((id):id is string=>Boolean(id)))},
    async adapterForAccount(userId,accountId){await assertIdentity(supabase,userId);const admin=privateClient();const {data:account,error}=await admin.from("jhadina_money_bank_accounts").select("connection_id").eq("user_id",userId).eq("provider_account_id",accountId).eq("status","active").maybeSingle();if(error||!account)throw new Error("MONEY_ACCOUNT_ACCESS_DENIED");const {data:connection,error:connectionError}=await admin.from("jhadina_money_bank_connections").select("id").eq("id",account.connection_id).eq("user_id",userId).eq("status","active").maybeSingle();if(connectionError||!connection)throw new Error("MONEY_ACCOUNT_ACCESS_DENIED");const {data:credential,error:credentialError}=await admin.from("jhadina_money_bank_credentials").select("encrypted_access_token").eq("connection_id",connection.id).maybeSingle();if(credentialError||!credential?.encrypted_access_token)throw new Error("MONEY_ACCOUNT_ACCESS_DENIED");return createOwnedPlaidAdapter(credential.encrypted_access_token)},
    async ownedAdapters(userId){await assertIdentity(supabase,userId);const admin=privateClient();const {data,error}=await admin.from("jhadina_money_bank_connections").select("id").eq("user_id",userId).eq("status","active");if(error)throw new Error(`MONEY_OWNERSHIP_LOOKUP_FAILED:${error.message}`);const adapters:BankAdapter[]=[];for(const row of data??[]){const {data:credential,error:credentialError}=await admin.from("jhadina_money_bank_credentials").select("encrypted_access_token").eq("connection_id",row.id).maybeSingle();if(credentialError||!credential?.encrypted_access_token)throw new Error("MONEY_PRIVATE_CREDENTIAL_MISSING");adapters.push(createOwnedPlaidAdapter(credential.encrypted_access_token))}return adapters}
  }
}
