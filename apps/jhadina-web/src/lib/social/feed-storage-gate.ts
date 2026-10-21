import {getSupabasePublicConfig} from "../supabase/public-config"
import {normalizeFeedCandidate,type ExternalFeedCandidate} from "./connected-source-contract"

/**
 * JH-UX2.STORAGE.01 read-only gate. No database claims, cron jobs, service
 * credentials, inserts, account linkage or implicit Memory permissions.
 * Fail closed unless the operator has commissioned the real schema and RLS.
 */
export const OWNER_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function assertOwnerUuid(userId:unknown):asserts userId is string{
 if(typeof userId!=="string" || !OWNER_UUID.test(userId))throw Error("FEED_OWNER_ID_UNVERIFIED")
}
export function assertFeedStoreCommissioned(input:{
 flag?:string;ref?:string;configuredUrl?:string
}):void{
 if(input.flag!=="true")throw Error("FEED_STORE_NOT_COMMISSIONED")
 if(!input.ref || !/^[a-z0-9]{20}$/.test(input.ref))throw Error("FEED_STORE_PROJECT_UNVERIFIED")
 let origin:string
 try{origin=new URL(input.configuredUrl??"").origin}catch{throw Error("FEED_STORE_PROJECT_UNVERIFIED")}
 if(origin!==`https://${input.ref}.supabase.co`)throw Error("FEED_STORE_PROJECT_MISMATCH")
}
export function assertRuntimeFeedStoreCommissioned(){
 const {url}=getSupabasePublicConfig()
 assertFeedStoreCommissioned({
  flag:process.env.JHADINA_FEED_STORAGE_ENABLED,
  ref:process.env.JHADINA_FEED_STORAGE_PROJECT_REF,
  configuredUrl:url,
 })
}
export type FeedStorageRow={
 user_id:string;provider:ExternalFeedCandidate["provider"];source_account:string;
 external_id:string;title:string;summary:string;occurred_at:string;url:string;
 provenance:string[];source_trust:string;
}
export function validateStoredFeedRows(ownerId:string,rows:readonly FeedStorageRow[]):ExternalFeedCandidate[]{
 assertOwnerUuid(ownerId)
 if(rows.length>25)throw Error("FEED_STORE_RESULT_LIMIT")
 return rows.map(row=>{
  if(row.user_id!==ownerId || row.source_trust!=="provider_verified")
   throw Error("FEED_STORE_ROW_NOT_OWNER_VERIFIED")
  return normalizeFeedCandidate({
   provider:row.provider,sourceAccount:row.source_account,externalId:row.external_id,
   title:row.title,summary:row.summary,occurredAt:row.occurred_at,url:row.url,
   provenance:row.provenance
  })
 })
}
