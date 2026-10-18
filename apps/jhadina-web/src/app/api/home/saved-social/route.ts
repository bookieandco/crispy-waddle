import {NextResponse} from "next/server"
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity"
import {createClient} from "@/lib/supabase/server"
import {assertOwnerUuid,assertRuntimeFeedStoreCommissioned,validateStoredFeedRows,type FeedStorageRow} from "@/lib/social/feed-storage-gate"

export const runtime="nodejs"
export const dynamic="force-dynamic"
const reply=(value:Record<string,unknown>,status:number)=>NextResponse.json(value,{status,headers:{"Cache-Control":"private, no-store"}})

/** Read-only owner feed; deliberately HTTP 503 before migration / RLS commission. */
export async function GET(){
 let ownerId:string
 try{
  const identity=await(await createRequestIdentityVerifier()).verify({})
  assertOwnerUuid(identity.userId)
  ownerId=identity.userId
 }catch{return reply({ok:false,status:"sign_in_required",items:[]},401)}
 try{assertRuntimeFeedStoreCommissioned()}
 catch{return reply({ok:false,status:"storage_unavailable",items:[],durable:false},503)}
 try{
  const client=await createClient()
  const {data,error}=await client.from("jhadina_feed_items")
   .select("user_id,provider,source_account,external_id,title,summary,occurred_at,url,provenance,source_trust")
   .eq("user_id",ownerId).order("occurred_at",{ascending:false}).limit(25)
  if(error)throw Error("FEED_STORAGE_QUERY_FAILED")
  const items=validateStoredFeedRows(ownerId,(data??[]) as FeedStorageRow[])
  return reply({ok:true,status:"ready",items,durable:true},200)
 }catch{return reply({ok:false,status:"storage_unavailable",items:[],durable:false},503)}
}
