import {randomUUID} from 'node:crypto'
import {NextRequest,NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {decodeSolanaPublicKey,verifyPhantomOwnership} from '@/lib/money/phantom-ownership-proof'

export const dynamic='force-dynamic'
export const runtime='nodejs'

async function verifiedUserId(){
 const client=await createClient()
 const {data,error}=await client.auth.getClaims()
 const id=data?.claims?.sub
 if(error||!id)throw new Error('MONEY_WALLET_SESSION_REQUIRED')
 return id
}
function admin(){
 const db=createServiceRoleClient()
 if(!db)throw new Error('MONEY_PRIVATE_STORE_NOT_CONFIGURED')
 return db
}
function addressOf(value:unknown):string{
 if(typeof value!=='string')throw new Error('MONEY_PHANTOM_ADDRESS_INVALID')
 decodeSolanaPublicKey(value)
 return value
}
function uuid(value:unknown):string{
 if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)){
  throw new Error('MONEY_PHANTOM_CHALLENGE_INVALID')
 }
 return value
}
function replyError(error:unknown){
 const code=error instanceof Error?error.message:'MONEY_WALLET_UNKNOWN_ERROR'
 const status=code.includes('SESSION')?401:code.includes('INVALID')||code.includes('EXPIRED')||
  code.includes('REPLAY')||code.includes('NOT_FOUND')||code.includes('PROOF')?400:503
 // Database-specific internals are not returned to wallet clients.
 return NextResponse.json({success:false,error:code},{status,headers:{'Cache-Control':'no-store'}})
}

/** A session/account address is never activated on the strength of a public
 * address alone. Requires a verified Ed25519 signature over a saved, server-
 * issued, user-bound, 5-minute, one-time message.
 */
export async function POST(req:NextRequest){
 try{
  const userId=await verifiedUserId()
  const body=await req.json() as Record<string,unknown>
  if(body.provider!=='phantom'||body.network!=='SOLANA')throw new Error('MONEY_WALLET_PROVIDER_INVALID')
  const address=addressOf(body.address),challengeId=uuid(body.challengeId)
  const signatureBase64=String(body.signatureBase64??'')
  const db=admin(),now=new Date().toISOString()
  const {data:challenge,error:loadError}=await db.from('jhadina_wallet_challenges')
   .select('challenge_id,owner_id,wallet_address,chain,provider,message,expires_at,consumed_at')
   .eq('challenge_id',challengeId).eq('owner_id',userId).maybeSingle()
  if(loadError)throw new Error('MONEY_PHANTOM_CHALLENGE_LOOKUP_FAILED')
  if(!challenge||challenge.owner_id!==userId||challenge.wallet_address!==address||
   challenge.chain!=='solana'||challenge.provider!=='phantom')throw new Error('MONEY_PHANTOM_CHALLENGE_INVALID')
  if(challenge.consumed_at)throw new Error('MONEY_PHANTOM_CHALLENGE_REPLAY')
  if(Date.parse(challenge.expires_at)<=Date.now())throw new Error('MONEY_PHANTOM_CHALLENGE_EXPIRED')
  if(!verifyPhantomOwnership({address,message:String(challenge.message),signatureBase64})){
   throw new Error('MONEY_PHANTOM_PROOF_INVALID')
  }
  // Conditional update is single-use even if concurrent requests race.
  const {data:claimed,error:claimError}=await db.from('jhadina_wallet_challenges')
   .update({consumed_at:now}).eq('challenge_id',challengeId).eq('owner_id',userId)
   .is('consumed_at',null).gt('expires_at',now).select('challenge_id')
  if(claimError)throw new Error('MONEY_PHANTOM_CHALLENGE_CLAIM_FAILED')
  if(!claimed?.length)throw new Error('MONEY_PHANTOM_CHALLENGE_REPLAY')

  const {error:walletError}=await db.from('jhadina_wallets').upsert({
   owner_id:userId,chain:'solana',address,provider:'phantom',
   ownership_verified:true,ownership_verified_at:now,
   observation_enabled:true,trading_enabled:false,updated_at:now,
  },{onConflict:'owner_id,chain,address'})
  if(walletError)throw new Error('MONEY_PHANTOM_WALLET_STORE_FAILED')

  const {data:existing,error:lookupError}=await db.from('money_wallet_connections')
   .select('connection_id').eq('user_id',userId).eq('provider','phantom')
   .eq('network','SOLANA').eq('address',address).maybeSingle()
  if(lookupError)throw new Error('MONEY_WALLET_LOOKUP_FAILED')
  const connectionId=existing?.connection_id??randomUUID()
  const {error:storeError}=await db.from('money_wallet_connections').upsert({
   connection_id:connectionId,user_id:userId,provider:'phantom',network:'SOLANA',
   address,mode:'OWNER_WALLET',status:'ACTIVE',
   evidence_ids:['phantom:ed25519-challenge:'+challengeId],
   connected_at:now,updated_at:now,
  },{onConflict:'user_id,provider,network,address'})
  if(storeError)throw new Error('MONEY_WALLET_STORE_FAILED')
  return NextResponse.json({success:true,data:{
   connectionId,address,provider:'phantom',network:'SOLANA',mode:'OWNER_WALLET',
   ownershipVerified:true,canSign:false,canMoveFunds:false,
  }},{headers:{'Cache-Control':'no-store'}})
 }catch(error){return replyError(error)}
}

export async function GET(){
 try{
  const userId=await verifiedUserId(),db=admin()
  const {data,error}=await db.from('money_wallet_connections')
   .select('connection_id,address,status,updated_at')
   .eq('user_id',userId).eq('provider','phantom').eq('network','SOLANA')
   .order('updated_at',{ascending:false}).limit(20)
  if(error)throw new Error('MONEY_WALLET_CONNECTION_READ_FAILED')
  // A legacy address-only ACTIVE row cannot impersonate a cryptographically
  // verified wallet; cross-check the canonical ownership record on every read.
  const {data:verified,error:ownerError}=await db.from('jhadina_wallets')
   .select('address').eq('owner_id',userId).eq('provider','phantom')
   .eq('chain','solana').eq('ownership_verified',true).eq('observation_enabled',true)
  if(ownerError)throw new Error('MONEY_WALLET_VERIFICATION_READ_FAILED')
  const authorized=new Set((verified??[]).map(row=>row.address))
  return NextResponse.json({success:true,data:{connections:(data??[]).map(x=>({
   connectionId:x.connection_id,address:x.address,
   status:x.status==='ACTIVE'&&!authorized.has(x.address)?'DISCONNECTED':x.status,
   updatedAt:x.updated_at,
  })),canSign:false,canMoveFunds:false}},{headers:{'Cache-Control':'no-store'}})
 }catch(error){return replyError(error)}
}

export async function DELETE(req:NextRequest){
 try{
  const userId=await verifiedUserId()
  const body=await req.json() as Record<string,unknown>
  const address=addressOf(body.address),db=admin(),now=new Date().toISOString()
  const {data,error}=await db.from('money_wallet_connections')
   .update({status:'DISCONNECTED',updated_at:now})
   .eq('user_id',userId).eq('provider','phantom').eq('network','SOLANA')
   .eq('address',address).select('connection_id')
  if(error)throw new Error('MONEY_WALLET_DISCONNECT_FAILED')
  if(!data?.length)throw new Error('MONEY_WALLET_CONNECTION_NOT_FOUND')
  const {error:walletError}=await db.from('jhadina_wallets')
   .update({observation_enabled:false,updated_at:now})
   .eq('owner_id',userId).eq('chain','solana').eq('address',address)
  if(walletError)throw new Error('MONEY_WALLET_DISCONNECT_FAILED')
  return NextResponse.json({success:true,data:{address,status:'DISCONNECTED'}},{headers:{'Cache-Control':'no-store'}})
 }catch(error){return replyError(error)}
}
