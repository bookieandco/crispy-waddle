import {beforeEach,describe,expect,it,vi} from 'vitest'
import {NextRequest} from 'next/server'
import {issuePhantomOwnershipChallenge} from '@/lib/money/phantom-ownership-proof'

const state=vi.hoisted(()=>({
 userId:'11111111-2222-4333-8444-555555555555',validSignature:true,
 challenges:[] as Record<string,any>[],wallets:[] as Record<string,any>[],
 connections:[] as Record<string,any>[],
}))
vi.mock('@/lib/supabase/server',()=>({
 createClient:async()=>({auth:{getClaims:async()=>({data:{claims:{sub:state.userId}},error:null})}}),
}))
function from(table:string){
 const records=table==='jhadina_wallet_challenges'?state.challenges:
  table==='jhadina_wallets'?state.wallets:state.connections
 const filters:Array<(value:Record<string,any>)=>boolean>=[]
 let mode:'read'|'update'='read'
 let patch:Record<string,any>={}
 const matching=()=>records.filter(row=>filters.every(fn=>fn(row)))
 const chain:any={
  eq(col:string,value:unknown){filters.push(row=>row[col]===value);return chain},
  gt(col:string,value:string){filters.push(row=>Date.parse(row[col])>Date.parse(value));return chain},
  is(col:string,value:null){filters.push(row=>row[col]===value);return chain},
  select(){
   if(mode==='update'){
    const rows=matching()
    for(const row of rows)Object.assign(row,patch)
    return Promise.resolve({data:rows.map(row=>({...row})),error:null})
   }
   return chain
  },
  update(value:Record<string,any>){mode='update';patch=value;return chain},
  insert(value:Record<string,any>){records.push({...value,consumed_at:null});return Promise.resolve({error:null})},
  upsert(value:Record<string,any>){
   records.push({...value});return Promise.resolve({error:null})
  },
  maybeSingle(){return Promise.resolve({data:matching()[0]??null,error:null})},
  order(){return chain},
  limit(count:number){return Promise.resolve({data:matching().slice(0,count),error:null})},
 }
 return chain
}
vi.mock('@/lib/supabase/service-role',()=>({createServiceRoleClient:()=>({from})}))
vi.mock('@/lib/money/phantom-ownership-proof',async importOriginal=>{
 const original=await importOriginal() as Record<string,unknown>
 return {...original,verifyPhantomOwnership:()=>state.validSignature}
})

import {POST,GET} from './route'

const address='11111111111111111111111111111111'
const url='https://jhadina.example/api/money/wallet-connections'
const request=(body:Record<string,unknown>)=>new NextRequest(url,{
 method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),
})
const seed=(ownerId=state.userId)=>{
 const data=issuePhantomOwnershipChallenge({address,userId:state.userId,origin:'https://jhadina.example'})
 state.challenges.push({
  challenge_id:data.challengeId,owner_id:ownerId,wallet_address:address,
  chain:'solana',provider:'phantom',message:data.message,expires_at:data.expiresAt,consumed_at:null,
 })
 return data.challengeId
}
const body=(challengeId:string)=>({
 provider:'phantom',network:'SOLANA',address,challengeId,signatureBase64:'signed-proof',
})
beforeEach(()=>{
 state.validSignature=true
 state.challenges.length=0
 state.wallets.length=0
 state.connections.length=0
})
describe('Phantom persistent wallet authorization .07',()=>{
 it('rejects bare address registration; no wallet rows created',async()=>{
  const res=await POST(request({provider:'phantom',network:'SOLANA',address}))
  expect(res.status).toBe(400)
  expect(state.wallets).toHaveLength(0)
  expect(state.connections).toHaveLength(0)
 })
 it('checks signature before atomically consuming challenge or activating the owner wallet',async()=>{
  const challengeId=seed()
  state.validSignature=false
  const res=await POST(request(body(challengeId)))
  expect(res.status).toBe(400)
  expect(state.challenges[0].consumed_at).toBeNull()
  expect(state.connections).toHaveLength(0)
 })
 it('consumes one verified challenge, stores owner-only non-executing status, denies replay',async()=>{
  const challengeId=seed()
  const response=await POST(request(body(challengeId)))
  const result=await response.json()
  expect(response.status).toBe(200)
  expect(result.data.ownershipVerified).toBe(true)
  expect(result.data.canSign).toBe(false)
  expect(state.wallets[0].trading_enabled).toBe(false)
  expect(state.connections[0].mode).toBe('OWNER_WALLET')
  expect(state.connections[0].status).toBe('ACTIVE')
  expect(state.connections[0].evidence_ids).toContain('phantom:ed25519-challenge:'+challengeId)
  const replay=await POST(request(body(challengeId)))
  expect(replay.status).toBe(400)
  expect(state.connections).toHaveLength(1)
  const view=await GET(),data=await view.json()
  expect(data.data.connections[0].address).toBe(address)
  expect(data.data.connections[0].status).toBe('ACTIVE')
  expect(data.data.canMoveFunds).toBe(false)
 })
 it('downgrades a legacy address-only active row lacking verified ownership',async()=>{
  state.connections.push({
   connection_id:'legacy',user_id:state.userId,provider:'phantom',
   network:'SOLANA',address,status:'ACTIVE',updated_at:new Date().toISOString(),
  })
  const res=await GET(),value=await res.json()
  expect(value.data.connections[0].status).toBe('DISCONNECTED')
 })
 it('rejects wrong-user challenges and expired challenges',async()=>{
  let challengeId=seed('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  expect((await POST(request(body(challengeId)))).status).toBe(400)
  state.challenges.length=0
  challengeId=seed()
  state.challenges[0].expires_at='2026-01-01T00:00:00Z'
  expect((await POST(request(body(challengeId)))).status).toBe(400)
  expect(state.connections).toHaveLength(0)
 })
})
