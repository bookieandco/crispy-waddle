import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {observeOwnerSolanaWallet,toShadowWalletResearch} from '@/lib/money/wallet-readonly-observer'

export const dynamic='force-dynamic'
export const runtime='nodejs'

const headers={'Cache-Control':'private, no-store, max-age=0'}
function errorReply(code:string,status:number){
 return NextResponse.json({success:false,error:code},{status,headers})
}

/** Only the authenticated owner's verified, active OWNER_WALLET is observed.
 * There is intentionally no address query parameter, user-supplied RPC URL,
 * arbitrary method, signer, swap, or mutable action in this route.
 */
export async function GET(){
 try{
  const auth=await createClient()
  const {data:claims,error:authError}=await auth.auth.getClaims()
  const userId=claims?.claims?.sub
  if(authError||!userId)return errorReply('WALLET_OBSERVER_SESSION_REQUIRED',401)
  const db=createServiceRoleClient()
  if(!db)return errorReply('WALLET_OBSERVER_PRIVATE_STORE_UNAVAILABLE',503)

  const {data:connection,error:connectionError}=await db.from('money_wallet_connections')
   .select('address,mode,status')
   .eq('user_id',userId).eq('provider','phantom').eq('network','SOLANA')
   .eq('mode','OWNER_WALLET').eq('status','ACTIVE')
   .order('updated_at',{ascending:false}).limit(1).maybeSingle()
  if(connectionError)throw new Error('WALLET_OBSERVER_CONNECTION_LOOKUP_FAILED')
  if(!connection)return errorReply('WALLET_OBSERVER_VERIFIED_CONNECTION_REQUIRED',409)
  const {data:verified,error:verifiedError}=await db.from('jhadina_wallets')
   .select('address,ownership_verified,observation_enabled')
   .eq('owner_id',userId).eq('chain','solana').eq('provider','phantom')
   .eq('address',connection.address).eq('ownership_verified',true)
   .eq('observation_enabled',true).limit(1).maybeSingle()
  if(verifiedError)throw new Error('WALLET_OBSERVER_VERIFICATION_LOOKUP_FAILED')
  if(!verified||verified.address!==connection.address){
   return errorReply('WALLET_OBSERVER_OWNER_VERIFICATION_REQUIRED',403)
  }

  const snapshot=await observeOwnerSolanaWallet({
   address:verified.address,
   rpcUrl:process.env.SOLANA_RPC_URL,
  })
  // Research-only projection is returned, not auto-admitted into live SHARK
  // or durable Shadow Learning. No provider funds or P&L are inferred.
  return NextResponse.json({success:true,data:{
   observation:snapshot,shadowResearch:toShadowWalletResearch(snapshot),
  }},{headers})
 }catch{
  // Do not expose RPC provider configuration or database internals.
  return errorReply('WALLET_OBSERVER_READ_UNAVAILABLE',503)
 }
}
