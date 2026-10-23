import {beforeEach,describe,expect,it,vi} from 'vitest'
import {generateKeyPairSync,sign} from 'node:crypto'
import {NextRequest} from 'next/server'
import {buildOwnershipChallenge} from '@/lib/wallet/server-proof'
import {createClient} from '@/lib/supabase/server'
import {createRuntimeServiceRoleClient} from '@/lib/supabase/service-role'

vi.mock('@/lib/supabase/server',()=>({createClient:vi.fn()}))
vi.mock('@/lib/supabase/service-role',()=>({createRuntimeServiceRoleClient:vi.fn()}))
vi.mock('@/lib/auth/personal-owner',()=>({isVerifiedPersonalOwner:(user: {id?:string}|null)=>user?.id==='test-owner'}))

const OWNER={id:'test-owner'}
const BASE='https://jhadina.example'
const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
function encode58(raw:Buffer):string{
  let big=BigInt('0x'+raw.toString('hex'))
  let encoded=''
  while(big>0n){encoded=ALPHABET[Number(big%58n)]+encoded;big/=58n}
  for(const b of raw){if(b!==0)break;encoded='1'+encoded}
  return encoded
}
const keypair=generateKeyPairSync('ed25519')
const ADDRESS=encode58(keypair.publicKey.export({format:'der',type:'spki'}).subarray(-32))
const challengeId='a0a0a0a0-0000-4000-8000-a0a0a0a0a0a0'
const expiresAt='2099-01-01T00:00:00Z'
const MESSAGE=buildOwnershipChallenge({
  walletAddress:ADDRESS,nonce:'ab'.repeat(32),expiresAt,origin:BASE,
})
const signature=sign(null,Buffer.from(MESSAGE),keypair.privateKey).toString('base64')
function request(method:'POST'|'DELETE',body:Record<string,unknown>,origin=BASE){
  return new NextRequest(BASE+'/api/wallet/ownership',{
    method,headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify(body),
  })
}
function readChallenge() {
  const query={
    select:vi.fn(()=>query),eq:vi.fn(()=>query),
    maybeSingle:vi.fn(async()=>({data:{
      id:challengeId,wallet_address:ADDRESS,challenge_text:MESSAGE,
      expires_at:expiresAt,consumed_at:null,
    },error:null})),
  }
  return query
}
describe('wallet ownership route: owner + signature + replay/revocation guards',()=>{
  let rpc: ReturnType<typeof vi.fn>
  let query: ReturnType<typeof readChallenge>
  beforeEach(()=>{
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue({
      auth:{getUser:async()=>({data:{user:OWNER},error:null})},
    } as never)
    query=readChallenge()
    rpc=vi.fn(async()=>({data:true,error:null}))
    vi.mocked(createRuntimeServiceRoleClient).mockResolvedValue({
      from:vi.fn(()=>query),rpc,
    } as never)
  })
  it('denies cross-site mutating requests before any authenticated write',async()=>{
    const {POST}=await import('./route')
    const r=await POST(request('POST',{action:'verify',address:ADDRESS},'https://evil.example'))
    expect(r.status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('requires a live owner auth session before wallet changes',async()=>{
    vi.mocked(createClient).mockResolvedValue({
      auth:{getUser:async()=>({data:{user:null},error:null})},
    } as never)
    const {POST}=await import('./route')
    const r=await POST(request('POST',{action:'verify',address:ADDRESS,challengeId,
      signatureBase64:signature}))
    expect(r.status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('cryptographically verifies the stored message then uses one atomic commit RPC',async()=>{
    const {POST}=await import('./route')
    const r=await POST(request('POST',{
      action:'verify',address:ADDRESS,challengeId,signatureBase64:signature,
    }))
    expect(r.status).toBe(200)
    expect((await r.json()).canTrade).toBe(false)
    expect(rpc).toHaveBeenCalledWith('jhadina_wallet_commit_owner_proof',{
      p_owner_id:OWNER.id,p_wallet_address:ADDRESS,p_challenge_id:challengeId,
    })
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('cannot store a wrong signature or a concurrently used/revoked nonce',async()=>{
    const {POST}=await import('./route')
    const wrong=await POST(request('POST',{
      action:'verify',address:ADDRESS,challengeId,
      signatureBase64:Buffer.alloc(64).toString('base64'),
    }))
    expect(wrong.status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
    rpc.mockResolvedValue({data:false,error:null})
    const replay=await POST(request('POST',{
      action:'verify',address:ADDRESS,challengeId,signatureBase64:signature,
    }))
    expect(replay.status).toBe(409)
    expect((await replay.json()).verified).not.toBe(true)
  })
  it('revokes pending challenges in the same transaction as durable wallet removal',async()=>{
    const {DELETE}=await import('./route')
    const result=await DELETE(request('DELETE',{address:ADDRESS}))
    expect(result.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('jhadina_wallet_revoke_owner_proof',{
      p_owner_id:OWNER.id,p_wallet_address:ADDRESS,
    })
    expect((await result.json()).canSign).toBe(false)
  })
  it('fails closed if service RPC is missing or backend is unavailable',async()=>{
    rpc.mockResolvedValue({data:null,error:{message:'undefined function'}})
    const {POST}=await import('./route')
    const result=await POST(request('POST',{
      action:'verify',address:ADDRESS,challengeId,signatureBase64:signature,
    }))
    expect(result.status).toBe(503)
    expect((await result.json()).verified).not.toBe(true)
  })
})
