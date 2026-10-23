import {describe,expect,it,vi} from 'vitest'
import {observeOwnerSolanaWallet,toShadowWalletResearch,walletReadRpcUrl} from './wallet-readonly-observer'

const address='11111111111111111111111111111111'
const signature='2'.repeat(87)
const rpcReply=(id:string,result:unknown)=>new Response(JSON.stringify({jsonrpc:'2.0',id,result}),{
 status:200,headers:{'content-type':'application/json'},
})
const fakeRpc=()=>vi.fn(async (_url:unknown,init?:RequestInit)=>{
 const request=JSON.parse(String(init?.body)) as {method:string;id:string;params:unknown[]}
 if(request.method==='getBalance')return rpcReply(request.id,{context:{slot:123456},value:1200500000})
 if(request.method==='getSignaturesForAddress')return rpcReply(request.id,[{
  signature,slot:123450,blockTime:1792695700,err:null,
 }])
 throw Error('Unexpected method '+request.method)
})

describe('JH-WALLET.INTELLIGENCE.08–.10',()=>{
 it('pins the verified public key; allows only two read methods and bounded history',async()=>{
  const fetchImpl=fakeRpc()
  const result=await observeOwnerSolanaWallet({
   address,fetchImpl:fetchImpl as unknown as typeof fetch,
   now:()=>new Date('2026-10-22T22:00:00.000Z'),
  })
  expect(fetchImpl).toHaveBeenCalledTimes(2)
  const methods=fetchImpl.mock.calls.map(([_,init])=>JSON.parse(String(init?.body)).method)
  expect(methods).toEqual(['getBalance','getSignaturesForAddress'])
  for(const [_,init] of fetchImpl.mock.calls){
   const body=JSON.parse(String(init?.body))
   expect(body.params[0]).toBe(address)
   expect(init?.method).toBe('POST')
   expect(init?.cache).toBe('no-store')
  }
  expect(result.balanceLamports).toBe('1200500000')
  expect(result.recentTransactions).toHaveLength(1)
  expect(result.source).toBe('SOLANA_MAINNET_RPC')
  expect(result.authority).toBe('OBSERVATION_ONLY')
  expect(result.canSign).toBe(false)
  expect(result.canTrade).toBe(false)
  expect(result.canMoveFunds).toBe(false)
  const shadow=toShadowWalletResearch(result)
  expect(shadow.authority).toBe('SHADOW_RESEARCH_ONLY')
  expect(shadow.canExecute).toBe(false)
  expect(shadow.containsSettledPnl).toBe(false)
  expect(shadow.canCreditPurse).toBe(false)
  expect(shadow.canAuthorizeLive).toBe(false)
 })
 it('rejects malformed or private HTTP RPC configuration and invalid Solana addresses',async()=>{
  expect(()=>walletReadRpcUrl('http://localhost:8899')).toThrow('WALLET_OBSERVER_RPC_URL_INVALID')
  expect(()=>walletReadRpcUrl('https://user:secret@rpc.example/')).toThrow('WALLET_OBSERVER_RPC_URL_INVALID')
  expect(walletReadRpcUrl()).toBe('https://api.mainnet.solana.com/')
  await expect(observeOwnerSolanaWallet({address:'address-shaped-fake'})).rejects.toThrow('MONEY_PHANTOM_ADDRESS_INVALID')
 })
 it('rejects history over 10, malformed balance, and RPC errors without faking evidence',async()=>{
  const overLimit=vi.fn(async (_url:unknown,init?:RequestInit)=>{
   const method=JSON.parse(String(init?.body)).method
   return method==='getBalance'?rpcReply(method,{context:{slot:1},value:0}):
    rpcReply(method,Array.from({length:11},()=>({signature,slot:1,blockTime:null,err:null})))
  })
  await expect(observeOwnerSolanaWallet({address,fetchImpl:overLimit as unknown as typeof fetch}))
   .rejects.toThrow('WALLET_OBSERVER_ACTIVITY_INVALID')
  const invalid=vi.fn(async (_url:unknown,init?:RequestInit)=>{
   const method=JSON.parse(String(init?.body)).method
   return method==='getBalance'?rpcReply(method,{context:{slot:1},value:-1}):rpcReply(method,[])
  })
  await expect(observeOwnerSolanaWallet({address,fetchImpl:invalid as unknown as typeof fetch}))
   .rejects.toThrow('WALLET_OBSERVER_BALANCE_INVALID')
  const error=vi.fn(async ()=>new Response(JSON.stringify({
   jsonrpc:'2.0',id:'getBalance',error:{code:429,message:'rate limit'},
  }),{status:200}))
  await expect(observeOwnerSolanaWallet({address,fetchImpl:error as unknown as typeof fetch}))
   .rejects.toThrow('WALLET_OBSERVER_RPC_RESPONSE_INVALID')
 })
})
