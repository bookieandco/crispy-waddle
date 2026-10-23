import {randomBytes, randomUUID} from 'node:crypto'
import {NextRequest, NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createRuntimeServiceRoleClient} from '@/lib/supabase/service-role'
import {isVerifiedPersonalOwner} from '@/lib/auth/personal-owner'
import {buildOwnershipChallenge, decodeSolanaPublicKey, validOwnershipSignature} from '@/lib/wallet/server-proof'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const fail = (error: string, status: number) =>
  NextResponse.json({ok:false,error,canSign:false,canTrade:false},{status,headers:{'Cache-Control':'no-store'}})
const success = (body:Record<string,unknown>) =>
  NextResponse.json({ok:true,...body,canSign:false,canTrade:false},{headers:{'Cache-Control':'no-store'}})

async function ownerClients() {
  const supabase = await createClient()
  const {data:{user},error} = await supabase.auth.getUser()
  if (error || !user || !isVerifiedPersonalOwner(user)) return null
  const admin = await createRuntimeServiceRoleClient()
  if (!admin) return {user,admin:null}
  return {user,admin}
}

function requestOriginMatches(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const site = request.headers.get('sec-fetch-site')
  return Boolean(origin && origin === request.nextUrl.origin
    && (site===null || site==='same-origin'))
}

async function requestBody(request:NextRequest):Promise<Record<string,unknown>|null>{
  if(!request.headers.get('content-type')?.startsWith('application/json'))return null
  if(Number(request.headers.get('content-length')??0)>2048)return null
  try {
    const raw=await request.text()
    if(raw.length>2048)return null
    const value:unknown=JSON.parse(raw)
    return value!==null&&typeof value==='object'&&!Array.isArray(value)
      ?value as Record<string,unknown>:null
  }catch{return null}
}

export async function GET(request:NextRequest){
  try{
    const clients=await ownerClients()
    if(!clients)return fail('owner_auth_required',401)
    if(!clients.admin)return fail('wallet_proof_storage_unavailable',503)
    const address=request.nextUrl.searchParams.get('address')
    if(!decodeSolanaPublicKey(address))return fail('invalid_wallet_address',400)
    const {data,error}=await clients.admin.from('money_wallet_verified_ownership')
      .select('verified_at').eq('owner_id',clients.user.id)
      .eq('wallet_address',address).maybeSingle()
    if(error)return fail('wallet_proof_storage_unavailable',503)
    return success({address,verified:!!data,verifiedAt:data?.verified_at??null})
  }catch{return fail('wallet_proof_unavailable',503)}
}

export async function POST(request:NextRequest){
  if(!requestOriginMatches(request))return fail('same_origin_required',403)
  const body=await requestBody(request)
  if(!body)return fail('invalid_request',400)
  try{
    const clients=await ownerClients()
    if(!clients)return fail('owner_auth_required',401)
    if(!clients.admin)return fail('wallet_proof_storage_unavailable',503)
    const {user,admin}=clients
    const address=body.address
    if(!decodeSolanaPublicKey(address))return fail('invalid_wallet_address',400)
    if(body.action==='challenge'){
      const issuedAt=new Date()
      const since=new Date(issuedAt.getTime()-60_000).toISOString()
      const {count,error:quotaError}=await admin.from('money_wallet_owner_challenges')
        .select('id',{count:'exact',head:true}).eq('owner_id',user.id).gte('issued_at',since)
      if(quotaError)return fail('wallet_proof_storage_unavailable',503)
      if((count??0)>=3)return fail('wallet_proof_rate_limited',429)
      const expiresAt=new Date(issuedAt.getTime()+5*60_000).toISOString()
      const message=buildOwnershipChallenge({walletAddress:address as string,
        nonce:randomBytes(32).toString('hex'),expiresAt,origin:request.nextUrl.origin})
      const challengeId=randomUUID()
      const {error:insertError}=await admin.from('money_wallet_owner_challenges')
        .insert({id:challengeId,owner_id:user.id,wallet_address:address,
          challenge_text:message,issued_at:issuedAt.toISOString(),expires_at:expiresAt})
      if(insertError)return fail('wallet_proof_storage_unavailable',503)
      return success({challengeId,message,expiresAt,authority:'SIGN_MESSAGE_ONLY'})
    }
    if(body.action!=='verify')return fail('invalid_action',400)
    const challengeId=body.challengeId
    if(typeof challengeId!=='string' || !/^[a-f0-9-]{36}$/i.test(challengeId))
      return fail('invalid_challenge',400)
    const {data:challenge,error:lookupError}=await admin.from('money_wallet_owner_challenges')
      .select('id,wallet_address,challenge_text,expires_at,consumed_at')
      .eq('id',challengeId).eq('owner_id',user.id).maybeSingle()
    if(lookupError)return fail('wallet_proof_storage_unavailable',503)
    if(!challenge || challenge.wallet_address!==address || challenge.consumed_at ||
       !(new Date(challenge.expires_at).getTime()>Date.now()))
      return fail('challenge_expired_or_invalid',409)
    if(!validOwnershipSignature(challenge.challenge_text,address,body.signatureBase64))
      return fail('wallet_proof_signature_invalid',403)
    // Atomic consume; a parallel verification/replay can succeed at most once.
    const {data:claimed,error:claimError}=await admin.from('money_wallet_owner_challenges')
      .update({consumed_at:new Date().toISOString()})
      .eq('id',challenge.id).eq('owner_id',user.id)
      .is('consumed_at',null).gt('expires_at',new Date().toISOString())
      .select('id').maybeSingle()
    if(claimError)return fail('wallet_proof_storage_unavailable',503)
    if(!claimed)return fail('challenge_already_consumed',409)
    const {error:storeError}=await admin.from('money_wallet_verified_ownership').upsert({
      owner_id:user.id,wallet_address:address,challenge_id:challenge.id,
      verified_at:new Date().toISOString(),provider:'phantom',
      can_sign:false,trading_enabled:false,
    },{onConflict:'owner_id,wallet_address'})
    if(storeError)return fail('wallet_proof_persistence_failed_retry_new_challenge',503)
    return success({address,verified:true,authority:'OWNER_WALLET_OBSERVATION_ONLY'})
  }catch{return fail('wallet_proof_unavailable',503)}
}

export async function DELETE(request:NextRequest){
  if(!requestOriginMatches(request))return fail('same_origin_required',403)
  const body=await requestBody(request)
  if(!body||!decodeSolanaPublicKey(body.address))return fail('invalid_wallet_address',400)
  try{
    const clients=await ownerClients()
    if(!clients)return fail('owner_auth_required',401)
    if(!clients.admin)return fail('wallet_proof_storage_unavailable',503)
    const {error}=await clients.admin.from('money_wallet_verified_ownership')
      .delete().eq('owner_id',clients.user.id).eq('wallet_address',body.address)
    if(error)return fail('wallet_proof_storage_unavailable',503)
    return success({revoked:true})
  }catch{return fail('wallet_proof_unavailable',503)}
}
