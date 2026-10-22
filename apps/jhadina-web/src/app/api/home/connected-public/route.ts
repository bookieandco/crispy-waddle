import {NextResponse} from "next/server"
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity"
import {createClient} from "@/lib/supabase/server"
import {assertOwnerUuid,assertRuntimeFeedStoreCommissioned} from "@/lib/social/feed-storage-gate"
import {parsePublicAccount,readPublicAccount} from "@/lib/social/owner-public-connections"
import type {ExternalFeedCandidate} from "@/lib/social/connected-source-contract"

export const runtime="nodejs"
export const dynamic="force-dynamic"
const reply=(value:Record<string,unknown>,status:number)=>NextResponse.json(value,{
 status,headers:{"cache-control":"private, no-store"},
})

/** Bounded, on-demand reads of public sources the signed-in owner explicitly saved.
 * There is NO polling, cron, publisher permission, memory admission or feed-item write.
 */
export async function GET(){
 let ownerId:string
 try{
  const identity=await(await createRequestIdentityVerifier()).verify({})
  assertOwnerUuid(identity.userId)
  ownerId=identity.userId
 }catch{return reply({ok:false,error:"SIGN_IN_REQUIRED",items:[]},401)}
 try{assertRuntimeFeedStoreCommissioned()}catch{
  return reply({ok:false,error:"FEED_STORAGE_NOT_ENABLED",items:[]},503)
 }
 try{
  const client=await createClient()
  const {data,error}=await client.from("jhadina_feed_connections")
   .select("provider,source_account,state,source_kind,capability")
   .eq("user_id",ownerId).eq("source_kind","public_author").eq("capability","public_read")
   .eq("state","healthy").order("created_at",{ascending:true}).limit(4)
  if(error)throw Error("PUBLIC_SOURCE_LIST_UNAVAILABLE")
  const accounts=(data??[]).flatMap(row=>{
   try{return [parsePublicAccount({provider:row.provider,handle:row.source_account})]}
   catch{return []}
  })
  const results=await Promise.allSettled(accounts.map(account=>readPublicAccount(account)))
  const items:ExternalFeedCandidate[]=[]
  let failed=0
  for(let i=0;i<results.length;i++){
   const result=results[i]
   const account=accounts[i]
   if(!account||!result||result.status!=="fulfilled"){failed++;continue}
   const list=result.value.filter(item=>
     item.provider===account.provider&&
     item.sourceTrust==="provider_verified"&&
     item.sourceAccount.toLowerCase()===account.handle.toLowerCase())
   items.push(...list.slice(0,10))
  }
  return reply({ok:true,kind:"saved_public_author_sources",durableAccounts:true,
   privateAccountConnected:false,autoSync:false,
   checked:accounts.length,failed,items:items.slice(0,30)},200)
 }catch{return reply({ok:false,error:"PUBLIC_SOURCE_READ_UNAVAILABLE",items:[]},503)}
}
