import { describe,it } from 'node:test'
import assert from 'node:assert/strict'
import { RaydiumTradeApiOrderBuilder } from './raydium-trade-api-builder.js'
import { MeteoraDlmmOrderBuilderClient } from './meteora-dlmm-builder-client.js'
import type { DexSwapIntent } from './solana-dex-runtime-contracts.js'

const intent=(provider:'raydium-direct'|'meteora-direct'):DexSwapIntent=>({
 executionId:'exec:1',tradeId:'trade:1',requestId:'req:1',runLineageId:'lineage:1',userId:'u1',strategyId:'meme',instrumentId:'solana:TOKEN',leg:'ENTRY',
 provider,routePreference:provider,requestedSlippageBps:50,walletConnectionId:'coffer:1',signerLeaseId:'lease:1',
 inputMint:'So11111111111111111111111111111111111111112',outputMint:'TOKEN11111111111111111111111111111111111',inputAmountAtomic:1000n,minimumOutputAtomic:900n,
 notionalMinor:100n,currency:'USD',idempotencyKey:'idem:1',informationCutoff:'2026-09-28T01:00:00Z',
 preExecution:{version:'SHARK-PREEXEC-v1',assessmentId:'a',assessmentHash:'h',edgeHashes:{'EDGE-001':'1','EDGE-002':'2','EDGE-003':'3','EDGE-004':'4','EDGE-005':'5','EDGE-006':'6','EDGE-007':'7'},edgeDecisionBundleHash:'b',informationCutoff:'2026-09-28T01:00:00Z',evidenceIds:['e'],bindingHash:'bind',authority:'PREEXEC_BINDING_ONLY',canAuthorizeTrade:false},
 approval:{sharkAssessmentId:'a',thesisId:'t',edgeDecisionBundleHash:'b',integrityGuardHash:'7',moneyRiskDecisionId:'risk',intentFingerprint:'fp',approvedAt:'2026-09-28T01:00:01Z',authority:'MONEY_RISK_APPROVAL_BINDING',bindingHash:'approval'},
 evidenceIds:['intent:e'],authority:'MONEY_EXECUTION_INTENT',
})

describe('direct DEX builders',()=>{
 it('binds the official Raydium transaction API request to Money amount, mints, minimum output and slippage',async()=>{
  const calls:{url:string;body?:string}[]=[]
  const builder=new RaydiumTradeApiOrderBuilder({
   computeUnitPriceMicroLamports:'12345',
   now:()=> '2026-09-28T01:00:02Z',
   fetchFn:async(input,init)=>{
    const url=String(input);calls.push({url,body:init?.body?String(init.body):undefined})
    if(url.includes('/compute/'))return new Response(JSON.stringify({id:'ray:q1',success:true,data:{inputMint:intent('raydium-direct').inputMint,outputMint:intent('raydium-direct').outputMint,inputAmount:'1000',outputAmount:'1000',otherAmountThreshold:'900',priceImpactPct:0.1}}),{status:200})
    return new Response(JSON.stringify({success:true,data:[{transaction:'dW5zaWduZWQ='}]}),{status:200})
   },
  })
  const result=await builder.build({provider:'raydium-direct',intent:intent('raydium-direct'),takerAddress:'Wallet111'})
  assert.equal(result.requestId,'ray:q1')
  assert.equal(result.quotedOutputAtomic,1000n)
  assert.equal(result.priceImpactBps,10)
  assert.match(calls[0]!.url,/amount=1000/)
  assert.match(calls[0]!.url,/slippageBps=50/)
  assert.match(calls[1]!.body??'',/"wallet":"Wallet111"/)
  assert.doesNotMatch(calls[1]!.body??'',/privateKey|mnemonic|seedPhrase/)
 })
 it('rejects a Raydium quote whose provider minimum is below the Money-approved minimum',async()=>{
  const builder=new RaydiumTradeApiOrderBuilder({
   computeUnitPriceMicroLamports:'1',
   fetchFn:async()=>new Response(JSON.stringify({id:'ray:q1',success:true,data:{inputMint:intent('raydium-direct').inputMint,outputMint:intent('raydium-direct').outputMint,inputAmount:'1000',outputAmount:'1000',otherAmountThreshold:'899',priceImpactPct:0.1}}),{status:200}),
  })
  await assert.rejects(()=>builder.build({provider:'raydium-direct',intent:intent('raydium-direct'),takerAddress:'Wallet111'}),/MINIMUM_OUTPUT_UNSATISFIED/)
 })
 it('uses an authenticated HTTPS Meteora builder and returns only unsigned transaction evidence',async()=>{
  let body=''
  const builder=new MeteoraDlmmOrderBuilderClient({
   baseUrl:'https://meteora-builder.example',
   resolveAuthorizationHeader:()=> 'Bearer opaque',
   resolvePoolAddress:()=> 'Pool111',
   fetchFn:async(_url,init)=>{
    body=String(init?.body??'')
    assert.equal((init?.headers as Record<string,string>).authorization,'Bearer opaque')
    return new Response(JSON.stringify({success:true,data:{requestId:'met:q1',quotedOutputAtomic:'1000',unsignedTransactionBase64:'dW5zaWduZWQ=',quoteObservedAt:'2026-09-28T01:00:02Z',priceImpactBps:9,evidenceIds:['meteora:q1']}}),{status:200})
   },
  })
  const result=await builder.build({provider:'meteora-direct',intent:intent('meteora-direct'),takerAddress:'Wallet111'})
  assert.equal(result.quotedOutputAtomic,1000n)
  assert.match(body,/"poolAddress":"Pool111"/)
  assert.match(body,/"slippageBps":50/)
  assert.doesNotMatch(body,/privateKey|mnemonic|seedPhrase|signedTransaction/)
 })
})
