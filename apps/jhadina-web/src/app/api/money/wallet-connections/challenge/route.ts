import {NextRequest,NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {issuePhantomOwnershipChallenge} from '@/lib/money/phantom-ownership-proof'

export const dynamic='force-dynamic'
export const runtime='nodejs'

export async function POST(req:NextRequest){
 try{
  const auth=await createClient()
  const {data,error}=await auth.auth.getClaims()
  const userId=data?.claims?.sub
  if(error||!userId) return NextResponse.json({success:false,error:'MONEY_WALLET_SESSION_REQUIRED'},{status:401})
  const body=await req.json() as Record<string,unknown>
  if(body.provider!=='phantom'||body.network!=='SOLANA')throw new Error('MONEY_WALLET_PROVIDER_INVALID')
  const db=createServiceRoleClient()
  if(!db)throw new Error('MONEY_PRIVATE_STORE_NOT_CONFIGURED')
  const address=String(body.address??'')
  // All message bytes originate on the server. No arbitrary client message.
  const challenge=issuePhantomOwnershipChallenge({address,userId,origin:new URL(req.url).origin})
  const {error:storeError}=await db.from('jhadina_wallet_challenges').insert({
   challenge_id:challenge.challengeId,owner_id:userId,wallet_address:address,
   chain:'solana',provider:'phantom',nonce:challenge.nonce,
   message:challenge.message,expires_at:challenge.expiresAt,
  })
  if(storeError)throw new Error('MONEY_PHANTOM_CHALLENGE_STORE_FAILED')
  return NextResponse.json({
   success:true,data:{
    challengeId:challenge.challengeId,message:challenge.message,
    expiresAt:challenge.expiresAt,canSignTransaction:false,
   },
  },{headers:{'Cache-Control':'no-store'}})
 }catch(error){
  const code=error instanceof Error?error.message:'MONEY_PHANTOM_CHALLENGE_FAILED'
  const status=code.includes('INVALID')?400:code.includes('SESSION')?401:503
  return NextResponse.json({success:false,error:code},{status,headers:{'Cache-Control':'no-store'}})
 }
}
