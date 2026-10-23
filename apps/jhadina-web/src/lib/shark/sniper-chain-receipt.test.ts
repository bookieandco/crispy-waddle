import {describe,it,expect,vi} from 'vitest'
import {verifySniperMintTransaction} from './sniper-chain-receipt'
const signature='4'.repeat(87),mint='2'.repeat(32)
const receivedAt='2026-10-23T14:00:00.500Z'
const transaction=(overrides:Record<string,unknown>={})=>({
 slot:99,meta:{err:null},transaction:{message:{instructions:[{
  program:'spl-token',parsed:{type:'initializeMint2',info:{mint}},
 }]}} ,...overrides,
})
const clock=()=>1000
const deps=(result:unknown)=>({
 now:()=> '2026-10-23T14:00:01Z',monotonic:clock,
 fetcher:vi.fn(async (_url:string,_init:unknown)=>({
  ok:true,status:200,text:async()=>JSON.stringify({jsonrpc:'2.0',id:1,result}),
 })),
})
describe('COMMISSION.17 read-only RPC chain attestation',()=>{
 it('cross-checks exact signature, slot, mint instruction and transaction success',async()=>{
  const d=deps(transaction())
  const result=await verifySniperMintTransaction({signature,mint,slot:99,receivedAt},d)
  expect(result.status).toBe('CONFIRMED_MINT_INSTRUCTION')
  expect(result.confirmation).toBe('CONFIRMED')
  expect(result.sourceTimestampResolution).toBe('SECONDS_OR_UNAVAILABLE')
  expect(result.canSign).toBe(false)
  expect(result.canTrade).toBe(false)
  const [url,init]=d.fetcher.mock.calls[0]!
  expect(url).toBe('https://api.mainnet-beta.solana.com')
  const config=init as unknown as {method:string;redirect:string;body:string}
  expect(config.method).toBe('POST')
  expect(config.redirect).toBe('error')
  const rpc=JSON.parse(config.body)
  expect(rpc.method).toBe('getTransaction')
  expect(rpc.params[0]).toBe(signature)
  expect(rpc.params[1].commitment).toBe('confirmed')
 })
 it('rejects mismatched slot, mint or failed transaction without inventing proof',async()=>{
  for(const data of [transaction({slot:100}),transaction({meta:{err:'InstructionError'}}),
   transaction({transaction:{message:{instructions:[{program:'spl-token',parsed:{
    type:'initializeMint2',info:{mint:'3'.repeat(32)}}}]}}}),
   transaction({meta:undefined})]){
   const r=await verifySniperMintTransaction({signature,mint,slot:99,receivedAt},deps(data))
   expect(r.independentlyCheckedMintInstruction).toBe(false)
   expect(r.canTrade).toBe(false)
  }
 })
 it('RPC null is unavailable, not proof that launch never occurred',async()=>{
  const r=await verifySniperMintTransaction({signature,mint,slot:99,receivedAt},deps(null))
  expect(r.status).toBe('UNAVAILABLE')
  expect(r.confirmation).toBe('UNVERIFIED')
 })
 it('refuses arbitrary signature, clock skew and provider outage',async()=>{
  const d=deps(transaction())
  await expect(verifySniperMintTransaction({signature:'../evil',mint,slot:99,receivedAt},d))
   .rejects.toThrow('IDENTITY_INVALID')
  await expect(verifySniperMintTransaction({signature,mint,slot:99,
   receivedAt:'2026-10-23T15:00:00Z'},d)).rejects.toThrow('CHRONOLOGY_INVALID')
  await expect(verifySniperMintTransaction({signature,mint,slot:99,receivedAt},{
   ...d,fetcher:async()=>({ok:false,status:429,text:async()=>''}),
  })).rejects.toThrow('RPC_UNAVAILABLE')
 })
})
