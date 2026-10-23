import {beforeEach,describe,expect,it,vi} from 'vitest'
const state=vi.hoisted(()=>({
 user:'11111111-2222-4333-8444-555555555555' as string|null,
 connection:{address:'11111111111111111111111111111111',user_id:'11111111-2222-4333-8444-555555555555',provider:'phantom',network:'SOLANA',mode:'OWNER_WALLET',status:'ACTIVE'} as Record<string,unknown>|null,
 owner:{address:'11111111111111111111111111111111',owner_id:'11111111-2222-4333-8444-555555555555',chain:'solana',provider:'phantom',ownership_verified:true,observation_enabled:true} as Record<string,unknown>|null,
 observations:0,
}))
vi.mock('@/lib/supabase/server',()=>({
 createClient:async()=>({auth:{getClaims:async()=>({data:{claims:{sub:state.user}},error:null})}}),
}))
vi.mock('@/lib/supabase/service-role',()=>({
 createServiceRoleClient:()=>({
  from:(table:string)=>{
   const row=table==='money_wallet_connections'?state.connection:state.owner
   const filters:((item:Record<string,unknown>)=>boolean)[]=[]
   const chain={
    select:()=>chain,
    eq:(key:string,value:unknown)=>{filters.push(r=>r[key]===value);return chain},
    order:()=>chain,limit:()=>chain,
    maybeSingle:async()=>({data:row&&filters.every(f=>f(row))?row:null,error:null}),
   }
   return chain
  },
 }),
}))
vi.mock('@/lib/money/wallet-readonly-observer',()=>({
 observeOwnerSolanaWallet:async(input:{address:string})=>{
  state.observations++
  return {address:input.address,observedAt:'2026-10-22T22:00:00.000Z',
   source:'SOLANA_MAINNET_RPC',balanceLamports:'1000',balanceSlot:20,
   recentTransactions:[],authority:'OBSERVATION_ONLY',
   canSign:false,canTrade:false,canMoveFunds:false,canCreditPurse:false}
 },
 toShadowWalletResearch:()=>({authority:'SHADOW_RESEARCH_ONLY',canExecute:false,canSign:false,canCreditPurse:false}),
}))
import {GET} from './route'
beforeEach(()=>{
 state.user='11111111-2222-4333-8444-555555555555'
 state.connection={address:'11111111111111111111111111111111',
  user_id:state.user,provider:'phantom',network:'SOLANA',mode:'OWNER_WALLET',status:'ACTIVE'}
 state.owner={address:'11111111111111111111111111111111',
  owner_id:state.user,chain:'solana',provider:'phantom',
  ownership_verified:true,observation_enabled:true}
 state.observations=0
})
describe('Authenticated Phantom owner observation',()=>{
 it('returns only owner-verified, read-only evidence with no-store',async()=>{
  const res=await GET(),body=await res.json()
  expect(res.status).toBe(200)
  expect(res.headers.get('cache-control')).toContain('no-store')
  expect(body.data.observation.balanceLamports).toBe('1000')
  expect(body.data.observation.canSign).toBe(false)
  expect(body.data.shadowResearch.canExecute).toBe(false)
  expect(state.observations).toBe(1)
 })
 it('rejects missing session before calling RPC',async()=>{
  state.user=null
  const res=await GET()
  expect(res.status).toBe(401)
  expect(state.observations).toBe(0)
 })
 it('rejects wrong user or absent connection without RPC',async()=>{
  state.connection={...state.connection!,user_id:'someone-else'}
  expect((await GET()).status).toBe(409)
  expect(state.observations).toBe(0)
 })
 it('rejects unverified or observation-disabled wallet without RPC',async()=>{
  state.owner={...state.owner!,ownership_verified:false}
  expect((await GET()).status).toBe(403)
  expect(state.observations).toBe(0)
  state.owner={...state.owner!,ownership_verified:true,observation_enabled:false}
  expect((await GET()).status).toBe(403)
  expect(state.observations).toBe(0)
 })
 it('rejects a signer/custody connection even when wallet address matches',async()=>{
  state.connection={...state.connection!,mode:'COFFER_EXECUTION_WALLET'}
  expect((await GET()).status).toBe(409)
  expect(state.observations).toBe(0)
 })
})
