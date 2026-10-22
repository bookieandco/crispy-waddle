import {NextRequest,NextResponse} from "next/server"
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity"
import {createClient} from "@/lib/supabase/server"
import {createRuntimeServiceRoleClient} from "@/lib/supabase/service-role"
import {assertOwnerUuid,assertRuntimeFeedStoreCommissioned} from "@/lib/social/feed-storage-gate"
import {parsePublicAccount,publicAccountMayBeSaved,readPublicAccount} from "@/lib/social/owner-public-connections"

export const runtime="nodejs"
export const dynamic="force-dynamic"
const reply=(value:Record<string,unknown>,status:number)=>NextResponse.json(value,{
 status,headers:{"cache-control":"private, no-store"},
})
async function owner(){
 const identity=await(await createRequestIdentityVerifier()).verify({})
 assertOwnerUuid(identity.userId)
 return identity.userId
}
function sameOriginJson(request:NextRequest){
 const origin=request.headers.get("origin")
 const referer=request.headers.get("referer")
 const expected=request.nextUrl.origin
 return origin===expected&&(!referer||new URL(referer).origin===expected)&&
  request.headers.get("content-type")?.toLowerCase().startsWith("application/json")===true
}
async function decode(request:NextRequest){
 try{return parsePublicAccount(await request.json())}catch{return null}
}
/** A registered public author is not proof of private account ownership or OAuth. */
export async function GET(){
 let ownerId:string
 try{ownerId=await owner()}catch{return reply({ok:false,error:"SIGN_IN_REQUIRED",sources:[]},401)}
 try{assertRuntimeFeedStoreCommissioned()}catch{return reply({ok:false,error:"FEED_STORAGE_NOT_ENABLED",sources:[]},503)}
 try{
  const supabase=await createClient()
  const {data,error}=await supabase.from("jhadina_feed_connections")
   .select("provider,source_account,source_kind,capability,state,last_verified_at")
   .eq("user_id",ownerId).eq("source_kind","public_author").order("created_at",{ascending:true}).limit(10)
  if(error)throw Error("FEED_CONNECTION_LIST_FAILED")
  return reply({ok:true,sources:(data??[]).filter(s=>
   ["bluesky","mastodon","github"].includes(s.provider)&&s.capability==="public_read").map(s=>({
    provider:s.provider,handle:s.source_account,state:s.state,lastVerifiedAt:s.last_verified_at,
    ownership:"public_author_only",authorizedPrivateFeed:false,
   }))},200)
 }catch{return reply({ok:false,error:"FEED_CONNECTION_LIST_UNAVAILABLE",sources:[]},503)}
}
export async function POST(request:NextRequest){
 if(!sameOriginJson(request))return reply({ok:false,error:"ORIGIN_OR_CONTENT_TYPE_INVALID"},403)
 let ownerId:string
 try{ownerId=await owner()}catch{return reply({ok:false,error:"SIGN_IN_REQUIRED"},401)}
 try{assertRuntimeFeedStoreCommissioned()}catch{return reply({ok:false,error:"FEED_STORAGE_NOT_ENABLED"},503)}
 const account=await decode(request)
 if(!account)return reply({ok:false,error:"PUBLIC_SOURCE_INVALID"},400)
 try{
  const viewer=await createClient()
  const {data:existing,error:listError}=await viewer.from("jhadina_feed_connections")
   .select("provider,source_account").eq("user_id",ownerId).eq("source_kind","public_author").limit(11)
  if(listError)throw Error("ACCOUNT_COUNT_FAILED")
  if((existing??[]).length>=10&&!(existing??[]).some(x=>
    x.provider===account.provider&&x.source_account===account.handle))
   return reply({ok:false,error:"PUBLIC_SOURCE_LIMIT_REACHED"},429)
  const items=await readPublicAccount(account)
  if(!publicAccountMayBeSaved(items,account))
   return reply({ok:false,error:"PUBLIC_SOURCE_NOT_VERIFIED_OR_NO_POSTS"},422)
  const privileged=await createRuntimeServiceRoleClient()
  if(!privileged)return reply({ok:false,error:"FEED_WRITE_PATH_UNAVAILABLE"},503)
  const timestamp=new Date().toISOString()
  const {error}=await privileged.from("jhadina_feed_connections").upsert({
   user_id:ownerId,provider:account.provider,source_account:account.handle,
   source_kind:"public_author",capability:"public_read",
   state:"healthy",scopes:[],last_verified_at:timestamp,updated_at:timestamp,
  },{onConflict:"user_id,provider,source_account"})
  if(error)throw Error("PUBLIC_SOURCE_REGISTER_FAILED")
  return reply({ok:true,provider:account.provider,handle:account.handle,
   mode:"public_author_only",privateAccountConnected:false,autoSync:false},201)
 }catch{return reply({ok:false,error:"PUBLIC_SOURCE_REGISTER_UNAVAILABLE"},503)}
}
export async function DELETE(request:NextRequest){
 if(!sameOriginJson(request))return reply({ok:false,error:"ORIGIN_OR_CONTENT_TYPE_INVALID"},403)
 let ownerId:string
 try{ownerId=await owner()}catch{return reply({ok:false,error:"SIGN_IN_REQUIRED"},401)}
 try{assertRuntimeFeedStoreCommissioned()}catch{return reply({ok:false,error:"FEED_STORAGE_NOT_ENABLED"},503)}
 const account=await decode(request)
 if(!account)return reply({ok:false,error:"PUBLIC_SOURCE_INVALID"},400)
 try{
  const privileged=await createRuntimeServiceRoleClient()
  if(!privileged)return reply({ok:false,error:"FEED_WRITE_PATH_UNAVAILABLE"},503)
  const {error}=await privileged.from("jhadina_feed_connections")
   .delete().eq("user_id",ownerId).eq("provider",account.provider)
   .eq("source_account",account.handle).eq("source_kind","public_author")
   .eq("capability","public_read")
  if(error)throw Error("PUBLIC_SOURCE_DELETE_FAILED")
  return reply({ok:true,provider:account.provider,handle:account.handle,mode:"public_author_only"},200)
 }catch{return reply({ok:false,error:"PUBLIC_SOURCE_DELETE_UNAVAILABLE"},503)}
}
