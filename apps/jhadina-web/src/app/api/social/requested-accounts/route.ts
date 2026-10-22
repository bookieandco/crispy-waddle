import {NextResponse} from "next/server"
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity"
import {createClient} from "@/lib/supabase/server"
import {assertOwnerUuid} from "@/lib/social/feed-storage-gate"
import {presentOwnerSelectedProfiles} from "@/lib/social/requested-account-contract"

export const runtime="nodejs"
export const dynamic="force-dynamic"
const reply=(data:Record<string,unknown>,status:number)=>NextResponse.json(data,{
 status,headers:{"cache-control":"private, no-store"},
})
/** Owner-only selection inventory. A selected URL is NOT an API authorization.
 * Do not join it to social publisher accounts or verified feed_connections.
 */
export async function GET(){
 let ownerId:string
 try{
  const identity=await(await createRequestIdentityVerifier()).verify({})
  assertOwnerUuid(identity.userId)
  ownerId=identity.userId
 }catch{return reply({ok:false,error:"SIGN_IN_REQUIRED",profiles:[]},401)}
 try{
  const client=await createClient()
  const {data,error}=await client.from("jhadina_feed_account_requests")
   .select("provider,handle,profile_url,status,requested_at")
   .eq("user_id",ownerId).order("requested_at",{ascending:true}).limit(25)
  if(error)throw Error("SOCIAL_PROFILE_READ_FAILED")
  const profiles=presentOwnerSelectedProfiles(data??[])
  return reply({ok:true,profiles,authorizedAccountCount:0,
   note:"These are owner-submitted profile addresses, not connected provider accounts."},200)
 }catch{return reply({ok:false,error:"SOCIAL_PROFILE_LIST_UNAVAILABLE",profiles:[]},503)}
}
