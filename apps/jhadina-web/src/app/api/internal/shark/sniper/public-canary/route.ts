import {NextRequest,NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {readPublicSniperPairOnce,readPublicSniperProfilesOnce} from '@/lib/shark/sniper-live-paper-feed'
export const dynamic='force-dynamic'
export const runtime='nodejs'
const headers={'Cache-Control':'private, no-store'}
/** Explicit owner-invoked source-only observation. Defaults OFF. It cannot
 * authorize trading, open a wallet, listen on Telegram or run in background.
 */
export async function GET(request:NextRequest){
 const owner=process.env.JHADINA_OWNER_USER_ID
 if(process.env.SHARK_SNIPER_PUBLIC_CANARY_ENABLED!=='true'||!owner){
  return NextResponse.json({error:'sniper_public_canary_disabled'},{status:503,headers})
 }
 const client=await createClient()
 const {data,error}=await client.auth.getClaims()
 if(error||!data?.claims?.sub){
  return NextResponse.json({error:'authentication_required'},{status:401,headers})
 }
 if(data.claims.sub!==owner){
  return NextResponse.json({error:'owner_only'},{status:403,headers})
 }
 const params=request.nextUrl.searchParams
 const mode=params.get('mode')??'profiles'
 if(!['profiles','pair'].includes(mode)||params.size>3){
  return NextResponse.json({error:'invalid_mode'},{status:400,headers})
 }
 const deps={fetcher:fetch,now:()=>new Date().toISOString(),timeoutMs:5000}
 try{
  if(mode==='profiles'){
   return NextResponse.json({
    status:'PUBLIC_PROFILES_ONLY',observations:await readPublicSniperProfilesOnce(deps),
    chainProof:false,canTrade:false,
   },{headers})
  }
  const mint=params.get('mint')??'',originalPairAddress=params.get('pair')??''
  const result=await readPublicSniperPairOnce({mint,originalPairAddress},deps)
  return NextResponse.json(result,{headers})
 }catch{
  // Provider, parsing, missing pair, or input errors cannot become success.
  return NextResponse.json({error:'public_source_unavailable_or_invalid'},{status:502,headers})
 }
}
