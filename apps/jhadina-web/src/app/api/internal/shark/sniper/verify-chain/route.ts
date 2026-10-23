import {NextRequest,NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {verifySniperMintTransaction} from '@/lib/shark/sniper-chain-receipt'
export const dynamic='force-dynamic'
export const runtime='nodejs'
const headers={'Cache-Control':'private, no-store'}
/** Manual RPC cross-check. This is not a live listener or a trade route.
 * Feature stays OFF until owner-only protected-preview review.
 */
export async function GET(request:NextRequest){
 const owner=process.env.JHADINA_OWNER_USER_ID
 if(process.env.SHARK_SNIPER_RPC_CANARY_ENABLED!=='true'||!owner){
  return NextResponse.json({error:'sniper_chain_verification_disabled'},{status:503,headers})
 }
 const client=await createClient()
 const {data,error}=await client.auth.getClaims()
 if(error||!data?.claims?.sub){
  return NextResponse.json({error:'authentication_required'},{status:401,headers})
 }
 if(data.claims.sub!==owner){
  return NextResponse.json({error:'owner_only'},{status:403,headers})
 }
 const p=request.nextUrl.searchParams
 if(p.size!==3||!p.has('signature')||!p.has('mint')||!p.has('slot')){
  return NextResponse.json({error:'signature_mint_slot_required'},{status:400,headers})
 }
 const slot=Number(p.get('slot'))
 if(!Number.isSafeInteger(slot)||slot<=0){
  return NextResponse.json({error:'slot_invalid'},{status:400,headers})
 }
 try{
  const receipt=await verifySniperMintTransaction({
   signature:p.get('signature')??'',mint:p.get('mint')??'',
   slot,receivedAt:new Date().toISOString(),
  },{fetcher:fetch,now:()=>new Date().toISOString(),
    monotonic:()=>performance.now(),timeoutMs:4000})
  return NextResponse.json({...receipt,observationKind:'MANUAL_RPC_CHECK_NOT_WEBHOOK_DELIVERY'},
   {headers})
 }catch(e){
  const invalid=e instanceof Error&&e.message==='SNIPER_CHAIN_IDENTITY_INVALID'
  return NextResponse.json({error:invalid?'invalid_chain_identity':'rpc_chain_check_unavailable'},
   {status:invalid?400:503,headers})
 }
}
