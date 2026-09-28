import { describe,it } from 'node:test'
import assert from 'node:assert/strict'
import { UniversalSolanaDexRouter } from './solana-dex-router.js'
import { MeteoraDirectDexAdapter,RaydiumDirectDexAdapter,type DirectDexOrderBuilder } from './direct-solana-dex-adapters.js'
import type { DexManagedOrder,DexProviderExecutionReceipt,DexSignedTransaction,DexSwapIntent,ManagedSolanaDexVenueAdapter,SolanaDexVenueProvider } from './solana-dex-runtime-contracts.js'

const intent=(overrides:Partial<DexSwapIntent>={}):DexSwapIntent=>({
 executionId:'exec-1',requestId:'req-1',runLineageId:'run-1',userId:'user-1',strategyId:'meme',instrumentId:'solana:TOKEN',leg:'ENTRY',
 provider:'solana-dex-router',routePreference:'AUTO',requestedSlippageBps:50,walletConnectionId:'wallet-1',signerLeaseId:'lease-1',inputMint:'SOL',outputMint:'TOKEN',
 inputAmountAtomic:1000n,minimumOutputAtomic:900n,notionalMinor:100n,currency:'USD',idempotencyKey:'idem-1',informationCutoff:'2026-09-27T19:00:00.000Z',
 evidenceIds:['e1'],preExecution:{} as DexSwapIntent['preExecution'],authority:'MONEY_EXECUTION_INTENT',...overrides,
})
const order=(provider:SolanaDexVenueProvider):DexManagedOrder=>({
 provider,requestId:provider+':q',inputMint:'SOL',outputMint:'TOKEN',inputAmountAtomic:1000n,quotedOutputAtomic:1000n,unsignedTransactionBase64:'unsigned',
 takerAddress:'wallet-address',quoteObservedAt:'2026-09-27T19:00:00.000Z',priceImpactBps:10,evidenceIds:[provider+':q'],authority:'PROVIDER_QUOTE_ONLY',canBroadcast:false,
})
const receipt=(provider:SolanaDexVenueProvider):DexProviderExecutionReceipt=>({
 receiptId:provider+':r',provider,requestId:provider+':q',executionId:'exec-1',state:'ACKNOWLEDGED',signature:'sig',observedAt:'2026-09-27T19:00:01.000Z',evidenceIds:['r'],authority:'PROVIDER_EXECUTION_EVIDENCE',
})
const signed:DexSignedTransaction={signerProvider:'coffer',walletConnectionId:'wallet-1',signerLeaseId:'lease-1',signerAddress:'wallet-address',primarySignature:'sig',signedTransactionBase64:'signed',signedTransactionHash:'hash',evidenceIds:['s'],authority:'SIGNER_OUTPUT_ONLY',containsPrivateKey:false,containsRawToken:false}

function fake(provider:SolanaDexVenueProvider,create:()=>Promise<DexManagedOrder>):ManagedSolanaDexVenueAdapter{
 return {provider,createOrder:create,executeSigned:async()=>receipt(provider)}
}

describe('DEX-ROUTER.FINAL',()=>{
 it('uses Jupiter first and falls back to Raydium when Jupiter cannot build the route',async()=>{
  const calls:string[]=[]
  const router=new UniversalSolanaDexRouter({adapters:[
   fake('jupiter-ultra',async()=>{calls.push('jupiter-ultra');throw new Error('no route')}),
   fake('raydium-direct',async()=>{calls.push('raydium-direct');return order('raydium-direct')}),
   fake('meteora-direct',async()=>{calls.push('meteora-direct');return order('meteora-direct')}),
  ]})
  const selected=await router.createOrder({intent:intent(),takerAddress:'wallet-address'})
  assert.equal(selected.provider,'raydium-direct')
  assert.deepEqual(calls,['jupiter-ultra','raydium-direct'])
  const executed=await router.executeSigned({intent:intent(),order:selected,signed,now:'2026-09-27T19:00:01.000Z'})
  assert.equal(executed.provider,'raydium-direct')
 })
 it('honors an explicit Meteora preference before fallback routes',async()=>{
  const calls:string[]=[]
  const router=new UniversalSolanaDexRouter({adapters:[
   fake('jupiter-ultra',async()=>{calls.push('jupiter-ultra');return order('jupiter-ultra')}),
   fake('raydium-direct',async()=>{calls.push('raydium-direct');return order('raydium-direct')}),
   fake('meteora-direct',async()=>{calls.push('meteora-direct');return order('meteora-direct')}),
  ]})
  const selected=await router.createOrder({intent:intent({routePreference:'meteora-direct'}),takerAddress:'wallet-address'})
  assert.equal(selected.provider,'meteora-direct')
  assert.deepEqual(calls,['meteora-direct'])
 })
 it('direct Raydium and Meteora adapters build protocol transactions then broadcast the signed bytes through Solana RPC',async()=>{
  const built:string[]=[]
  const builder:DirectDexOrderBuilder={build:async({provider})=>{built.push(provider);return {requestId:provider+':q',quotedOutputAtomic:1000n,unsignedTransactionBase64:'unsigned',quoteObservedAt:'2026-09-27T19:00:00.000Z',priceImpactBps:12,evidenceIds:[provider+':build']}}}
  const requests:string[]=[]
  const fetchFn=async(_input:string|URL,init?:RequestInit)=>{requests.push(String(init?.body));return new Response(JSON.stringify({jsonrpc:'2.0',id:'exec-1',result:'sig'}),{status:200,headers:{'content-type':'application/json'}})}
  for(const adapter of [
   new RaydiumDirectDexAdapter({builder,resolveRpcEndpoint:()=> 'https://rpc.example',fetchFn}),
   new MeteoraDirectDexAdapter({builder,resolveRpcEndpoint:()=> 'https://rpc.example',fetchFn}),
  ]){
   const o=await adapter.createOrder({intent:intent({provider:adapter.provider,routePreference:adapter.provider}),takerAddress:'wallet-address'})
   const r=await adapter.executeSigned({intent:intent({provider:adapter.provider,routePreference:adapter.provider}),order:o,signed,now:'2026-09-27T19:00:01.000Z'})
   assert.equal(r.provider,adapter.provider)
   assert.equal(r.signature,'sig')
  }
  assert.deepEqual(built,['raydium-direct','meteora-direct'])
  assert.equal(requests.length,2)
  assert.ok(requests.every(body=>body.includes('"method":"sendTransaction"')))
 })
})
