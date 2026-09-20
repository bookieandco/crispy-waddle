import { createClient } from "../supabase/server"
import type { BankAdapter } from "@jhadina/money-core"
import { createOwnedPlaidAdapter } from "./bank-link-runtime"

export type MoneyOwnershipResolver={ownedAccountIds(userId:string):Promise<ReadonlySet<string>>;adapterForAccount(userId:string,accountId:string):Promise<BankAdapter>;ownedAdapters(userId:string):Promise<readonly BankAdapter[]>}
async function assertIdentity(supabase:Awaited<ReturnType<typeof createClient>>,userId:string){const {data:{claims},error}=await supabase.auth.getClaims();if(error||!claims?.sub||claims.sub!==userId)throw new Error("MONEY_OWNERSHIP_IDENTITY_MISMATCH")}
export async function createMoneyOwnershipResolver():Promise<MoneyOwnershipResolver>{
  const supabase=await createClient()
  return {
    async ownedAccountIds(userId){await assertIdentity(supabase,userId);const {data,error}=await supabase.rpc("jhadina_money_owned_account_ids");if(error)throw new Error(`MONEY_OWNERSHIP_LOOKUP_FAILED:${error.message}`);const rows=(data??[]) as Array<{provider_account_id?:string|null}>;return new Set(rows.map(r=>r.provider_account_id).filter((id):id is string=>Boolean(id)))},
    async adapterForAccount(userId,accountId){await assertIdentity(supabase,userId);const {data:account,error}=await supabase.from("jhadina_money_bank_accounts").select("connection_id").eq("user_id",userId).eq("provider_account_id",accountId).eq("status","active").maybeSingle();if(error||!account)throw new Error("MONEY_ACCOUNT_ACCESS_DENIED");const {data:connection,error:connectionError}=await supabase.from("jhadina_money_bank_connections").select("encrypted_access_token").eq("id",account.connection_id).eq("user_id",userId).eq("status","active").maybeSingle();if(connectionError||!connection?.encrypted_access_token)throw new Error("MONEY_ACCOUNT_ACCESS_DENIED");return createOwnedPlaidAdapter(connection.encrypted_access_token)},
    async ownedAdapters(userId){await assertIdentity(supabase,userId);const {data,error}=await supabase.from("jhadina_money_bank_connections").select("encrypted_access_token").eq("user_id",userId).eq("status","active");if(error)throw new Error(`MONEY_OWNERSHIP_LOOKUP_FAILED:${error.message}`);return (data??[]).map(row=>createOwnedPlaidAdapter(row.encrypted_access_token))}
  }
}
