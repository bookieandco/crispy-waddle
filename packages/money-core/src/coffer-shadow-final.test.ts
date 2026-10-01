import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateDexRouteQuote,type DexRouteGatePolicy,type DexRouteQuote } from './dex-route-gate.js'
import { GovernedDexRouteRouter,MeteoraDirectQuoteAdapter,RaydiumDirectQuoteAdapter,type DexQuoteOnlyAdapter,type DexQuoteRequest } from './dex-route-router.js'
import { InMemoryCofferShadowStore,certifyCofferShadowFinal,runCofferShadow } from './coffer-shadow-final.js'
import type { Edge007IntegrityReceipt,EdgeDecisionBundleReceipt } from './dex-four-stage-certification.js'
import { PostgresCofferShadowStore } from './postgres-coffer-shadow-store.js'
import type { SqlClient } from './postgres-idempotency-store.js'

const now='2026-09-30T23:00:00.000Z'
const policy: DexRouteGatePolicy=Object.freeze({
 maxQuoteAgeMs:5000,maxSlippageBps:100,maxPriceImpactBps:250,maxFeeBps:100,minLiquidityMinor:10000n,maxConsecutiveRealizedLosses:3,
 allowedProviders:Object.freeze(['jupiter-swap-v2','raydium-direct','meteora-direct'] as const),
 requirePriceImpactEvidence:true,requireLiquidityEvidence:true,authority:'MONEY_DEX_GATE_POLICY' as const,
})
const quote=(o:Partial<DexRouteQuote>={}):DexRouteQuote=>Object.freeze({
 quoteId:'q1',provider:'raydium-direct',inputMint:'USDC',outputMint:'TOKEN',inputAmountAtomic:1000000n,quotedOutputAtomic:500000n,
 minimumOutputAtomic:495000n,quotedAt:now,priceImpactBps:50,feeBps:30,liquidityMinor:1000000n,evidenceIds:Object.freeze(['quote:e']),
 authority:'ROUTE_QUOTE_EVIDENCE_ONLY' as const,canExecute:false as const,...o,
})
const edge:EdgeDecisionBundleReceipt=Object.freeze({
 frameworkVersion:'EDGE-001-006-v1',
 receipts:Object.freeze((['EDGE-001','EDGE-002','EDGE-003','EDGE-004','EDGE-005','EDGE-006'] as const).map(gateId=>Object.freeze({
  gateId,version:'EDGE-001-006-v1' as const,disposition:'PASS' as const,reasonCodes:Object.freeze([]),evidenceIds:Object.freeze([gateId+':e']),
  evaluatedAt:now,authority:'RESEARCH_AND_RISK_GATE_ONLY' as const,canAuthorizeTrade:false as const,
 }))),
 disposition:'PASS',reasonCodes:Object.freeze([]),evidenceIds:Object.freeze(['edge:e']),authority:'RESEARCH_AND_RISK_GATE_ONLY',canAuthorizeTrade:false,
})
const integrity:Edge007IntegrityReceipt=Object.freeze({
 guardVersion:'EDGE-007-v1',guardId:'edge7',disposition:'PASS',reasonCodes:Object.freeze([]),evidenceIds:Object.freeze(['edge7:e']),
 authority:'INTEGRITY_VETO_ONLY',canAuthorizeTrade:false,canAuthorizePromotion:false,
})

test('MONEY-DEX-GATE blocks stale, high-impact and consecutive-loss quotes independently',()=>{
 assert.equal(evaluateDexRouteQuote({quote:quote(),policy,now,consecutiveRealizedLosses:0}).disposition,'PASS')
 const stale=evaluateDexRouteQuote({quote:quote({quotedAt:'2026-09-30T22:59:50.000Z'}),policy,now,consecutiveRealizedLosses:0})
 assert.ok(stale.reasonCodes.includes('MONEY_DEX_GATE_STALE_QUOTE'))
 const impact=evaluateDexRouteQuote({quote:quote({priceImpactBps:251}),policy,now,consecutiveRealizedLosses:0})
 assert.ok(impact.reasonCodes.includes('MONEY_DEX_GATE_PRICE_IMPACT_CEILING'))
 const loss=evaluateDexRouteQuote({quote:quote(),policy,now,consecutiveRealizedLosses:3})
 assert.ok(loss.reasonCodes.includes('MONEY_DEX_GATE_CONSECUTIVE_LOSS_HALT'))
})

test('DEX-ROUTER falls back from a failed primary and selects the best admitted direct venue',async()=>{
 const failed: DexQuoteOnlyAdapter={provider:'jupiter-swap-v2',quote:async()=>{throw new Error('DEX_ROUTER_TEST_PRIMARY_DOWN')}}
 const raydium=new RaydiumDirectQuoteAdapter(async()=>({quotedOutputAtomic:500000n,priceImpactBps:40,feeBps:30,liquidityMinor:1000000n,evidenceIds:['ray:e']}))
 const meteora=new MeteoraDirectQuoteAdapter(async()=>({quotedOutputAtomic:510000n,priceImpactBps:60,feeBps:35,liquidityMinor:900000n,evidenceIds:['met:e']}))
 const router=new GovernedDexRouteRouter({adapters:[failed,raydium,meteora],policy})
 const decision=await router.route({request:{inputMint:'USDC',outputMint:'TOKEN',inputAmountAtomic:1000000n,slippageBps:50,now},consecutiveRealizedLosses:0})
 assert.equal(decision.selected?.provider,'meteora-direct')
 assert.equal(decision.canSign,false)
 assert.equal(decision.canBroadcast,false)
 assert.equal(decision.attempts.length,3)
 assert.equal(decision.attempts[0]?.errorCode,'DEX_ROUTER_TEST_PRIMARY_DOWN')
})

test('COFFER-SHADOW.FINAL proves a real-market route decision without signing or broadcast authority',async()=>{
 const raydium=new RaydiumDirectQuoteAdapter(async()=>({quotedOutputAtomic:500000n,priceImpactBps:40,feeBps:30,liquidityMinor:1000000n,evidenceIds:['ray:live:quote']}))
 const router=new GovernedDexRouteRouter({adapters:[raydium],policy})
 const store=new InMemoryCofferShadowStore()
 const request:DexQuoteRequest={inputMint:'USDC',outputMint:'TOKEN',inputAmountAtomic:1000000n,slippageBps:50,now}
 const run=await runCofferShadow({
  router,store,userId:'u1',runLineageId:'lineage:shadow:1',strategyId:'shark:meme:v1',instrumentId:'solana:TOKEN',request,
  edgeDecisionBundle:edge,integrityGuard:integrity,consecutiveRealizedLosses:0,origin:'RECORDED_REAL_MARKET',
 })
 const final=certifyCofferShadowFinal(run)
 assert.equal(run.signedTransactionCount,0)
 assert.equal(run.broadcastCount,0)
 assert.equal(run.stageEvidence.signedTransactionCount,0)
 assert.equal(run.stageEvidence.broadcastCount,0)
 assert.equal(final.passed,true)
 assert.equal(final.unrestrictedLiveAuthorized,false)
 assert.equal((await store.get(run.shadowRunId))?.shadowRunId,run.shadowRunId)
})


test('COFFER-SHADOW durable store round-trips bigint route evidence without gaining authority',async()=>{
 let stored:any
 const client:SqlClient={
  async query<T=Record<string,unknown>>(sql:string,values:readonly unknown[]=[]){
   if(sql.includes('INSERT INTO')){
    stored={
     shadow_run_id:values[0],user_id:values[1],run_lineage_id:values[2],strategy_id:values[3],instrument_id:values[4],
     observed_at:values[5],selected_provider:values[6],
     route_decision:JSON.parse(String(values[7])),stage_evidence:JSON.parse(String(values[8])),certification:JSON.parse(String(values[9])),
     signed_transaction_count:0,broadcast_count:0,financial_authority:'NONE',authority:'COFFER_SHADOW_EVIDENCE_ONLY',
    }
    return {rows:[{shadow_run_id:values[0]}] as T[],rowCount:1}
   }
   if(sql.includes('SELECT * FROM'))return {rows:stored?[stored as T]:[],rowCount:stored?1:0}
   throw new Error('UNEXPECTED_SQL')
  },
 }
 const raydium=new RaydiumDirectQuoteAdapter(async()=>({quotedOutputAtomic:500000n,priceImpactBps:40,feeBps:30,liquidityMinor:1000000n,evidenceIds:['ray:durable:quote']}))
 const router=new GovernedDexRouteRouter({adapters:[raydium],policy})
 const store=new PostgresCofferShadowStore(client)
 const run=await runCofferShadow({
  router,store,userId:'u1',runLineageId:'lineage:shadow:durable',strategyId:'shark:meme:v1',instrumentId:'solana:TOKEN',
  request:{inputMint:'USDC',outputMint:'TOKEN',inputAmountAtomic:1000000n,slippageBps:50,now},
  edgeDecisionBundle:edge,integrityGuard:integrity,consecutiveRealizedLosses:0,origin:'RECORDED_REAL_MARKET',
 })
 const restored=await store.get(run.shadowRunId)
 assert.equal(restored?.routeDecision.selected?.inputAmountAtomic,1000000n)
 assert.equal(restored?.routeDecision.selected?.quotedOutputAtomic,500000n)
 assert.equal(restored?.financialAuthority,'NONE')
 assert.equal(restored?.signedTransactionCount,0)
 assert.equal(restored?.broadcastCount,0)
})
