import { createClient } from "../supabase/server"

export type MoneyOwnershipResolver={ownedAccountIds(userId:string):Promise<ReadonlySet<string>>}
export async function createMoneyOwnershipResolver():Promise<MoneyOwnershipResolver>{
  const supabase=await createClient()
  return {async ownedAccountIds(userId:string){
    const {data:{claims},error:claimsError}=await supabase.auth.getClaims()
    if(claimsError||!claims?.sub||claims.sub!==userId) throw new Error("MONEY_OWNERSHIP_IDENTITY_MISMATCH")
    const {data,error}=await supabase.rpc("jhadina_money_owned_account_ids")
    if(error) throw new Error(`MONEY_OWNERSHIP_LOOKUP_FAILED:${error.message}`)
    const rows=(data??[]) as Array<{provider_account_id?:string|null}>
    return new Set(rows.map(row=>row.provider_account_id).filter((id):id is string=>Boolean(id)))
  }}
}
