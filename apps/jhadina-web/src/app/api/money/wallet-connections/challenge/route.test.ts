import {beforeEach,describe,expect,it,vi} from 'vitest'
import {NextRequest} from 'next/server'

const state=vi.hoisted(()=>({
 userId:'11111111-2222-4333-8444-555555555555' as string|null,
 recorded:[] as Record<string,unknown>[],
}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({
 auth:{getClaims:async()=>({data:{claims:{sub:state.userId}},error:null})},
})}))
vi.mock('@/lib/supabase/service-role',()=>({createServiceRoleClient:()=>({
 from:(table:string)=>({
  insert:async(record:Record<string,unknown>)=>{
   if(table!=='jhadina_wallet_challenges')return {error:{message:'wrong table'}}
   state.recorded.push(record)
   return {error:null}
  },
 }),
})}))
import {POST} from './route'

const address='11111111111111111111111111111111'
const req=(body:Record<string,unknown>)=>new NextRequest('https://jhadina.example/api/money/wallet-connections/challenge',{
 method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),
})
beforeEach(()=>{state.userId='11111111-2222-4333-8444-555555555555';state.recorded.length=0})
describe('Phantom server challenge minting',()=>{
 it('binds a fresh nonce to user, address and HTTPS domain; does not activate a wallet',async()=>{
  const response=await POST(req({provider:'phantom',network:'SOLANA',address}))
  const value=await response.json()
  expect(response.status).toBe(200)
  expect(value.data.canSignTransaction).toBe(false)
  expect(value.data.message).toContain('Domain: https://jhadina.example')
  expect(value.data.message).toContain('Session: '+state.userId)
  expect(value.data.message).toContain('Wallet: '+address)
  expect(value.data.message).toContain('not a transaction')
  expect(state.recorded).toHaveLength(1)
  expect(state.recorded[0].consumed_at).toBeUndefined()
  expect(state.recorded[0].wallet_address).toBe(address)
  expect(state.recorded[0].owner_id).toBe(state.userId)
 })
 it('requires authenticated Jhadina user and supported provider',async()=>{
  state.userId=null
  expect((await POST(req({provider:'phantom',network:'SOLANA',address}))).status).toBe(401)
  state.userId='11111111-2222-4333-8444-555555555555'
  expect((await POST(req({provider:'unknown',network:'SOLANA',address}))).status).toBe(400)
  expect(state.recorded).toHaveLength(0)
 })
})
