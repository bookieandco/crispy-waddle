import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyRunpodShadowMemory,
  runpodShadowHorizonTarget,
  runpodShadowSample,
  runpodShadowSignalProvenance,
  scoreRunpodShadowCandidate,
  type RunpodShadowCandidate,
} from './shark-shadow-runpod-runtime.js'

const candidate:RunpodShadowCandidate={
  chainId:'solana',tokenAddress:'mint-1',pairAddress:'pair-1',dexId:'pumpfun',
  priceUsd:.01,liquidityUsd:150000,volume24hUsd:500000,buys24h:800,sells24h:300,priceChange1hPct:12,
  pairCreatedAt:'2026-10-03T12:00:00Z',discoveredAt:'2026-10-03T17:00:00Z',
  evidenceIds:['dexscreener:pair:pair-1'],raw:{pairAddress:'pair-1'},
}

test('RunPod shadow scoring admits liquid active evidence without execution authority',()=>{
  const score=scoreRunpodShadowCandidate(candidate,'2026-10-03T17:00:00Z')
  assert.equal(score.disposition,'ALLOCATED')
  assert.ok(score.confidence>=.55)
  const sample=runpodShadowSample(candidate)
  assert.equal(sample.priceUsd,.01)
  assert.equal(sample.tokenAddress,'mint-1')
})

test('RunPod shadow scoring turns thin evidence into NO_TRADE input',()=>{
  const score=scoreRunpodShadowCandidate({...candidate,liquidityUsd:1000,volume24hUsd:500,buys24h:2,sells24h:8},'2026-10-03T17:00:00Z')
  assert.equal(score.disposition,'PURSE_REJECTED')
  assert.ok(score.reasonCodes.includes('LIQUIDITY_BELOW_SHADOW_FLOOR'))
})

test('RunPod outcome windows remain non-overlapping',()=>{
  assert.deepEqual(runpodShadowHorizonTarget('2026-10-03T17:00:00Z','15M'),{
    dueAt:'2026-10-03T17:15:00.000Z',latestAt:'2026-10-03T17:59:59.999Z',
  })
  assert.deepEqual(runpodShadowHorizonTarget('2026-10-03T17:00:00Z','1H'),{
    dueAt:'2026-10-03T18:00:00.000Z',latestAt:'2026-10-03T20:59:59.999Z',
  })
})


test('RunPod shadow memory changes later paper confidence but cannot clear a base rejection',()=>{
  const base=scoreRunpodShadowCandidate(candidate,'2026-10-03T17:00:00Z')
  const cards=[{
    memoryId:'mem-1',userId:'runpod-shadow',strategyId:'SHARK_RUNTIME_NEW_PAIR',
    patternKey:'SHARK_RUNTIME_NEW_PAIR|HIGH_LIQUIDITY:LOW_ANOMALY:BUY_FLOW:HIGH_TURNOVER',
    marketRegime:'HIGH_LIQUIDITY:LOW_ANOMALY:BUY_FLOW:HIGH_TURNOVER',
    sampleSize:24,winRateBps:7000,meanDecisionQualityBps:900,meanExecutionCostBps:120,
    meanAvoidedLossBps:50,meanMissedGainBps:20,confidenceAdjustmentBps:700,
    sourceReliability:[{sourceGroup:'dexscreener',sampleSize:24,positiveRateBps:7000,meanDecisionQualityBps:900}],
    lessonIds:Array.from({length:24},(_,i)=>'pit-lesson-'+i),
    evidenceIds:['dexscreener:pair:pair-1','runpod-shadow-pit-verified:v2'],
    createdAt:'2026-10-03T16:00:00Z',
    authority:'LEARNING_MEMORY_ONLY' as const,canAuthorizeLive:false as const,
  }]
  const adjusted=applyRunpodShadowMemory({
    confidence:base.confidence,disposition:base.disposition,reasonCodes:base.reasonCodes,
    marketRegime:'HIGH_LIQUIDITY:LOW_ANOMALY:BUY_FLOW:HIGH_TURNOVER',cards,
  })
  assert.equal(adjusted.adjustmentBps,500)
  assert.ok(adjusted.confidence>base.confidence)
  assert.equal(adjusted.disposition,'ALLOCATED')
  assert.deepEqual(adjusted.memoryIds,['mem-1'])

  const rejected=applyRunpodShadowMemory({
    confidence:.40,disposition:'PURSE_REJECTED',reasonCodes:['LIQUIDITY_BELOW_SHADOW_FLOOR'],
    marketRegime:'HIGH_LIQUIDITY:LOW_ANOMALY:BUY_FLOW:HIGH_TURNOVER',cards,
  })
  assert.equal(rejected.disposition,'PURSE_REJECTED')
})

test('unverified and tiny-cohort memory cannot influence later paper decisions',()=>{
  const base={confidence:.6,disposition:'ALLOCATED' as const,reasonCodes:['RESEARCH_ONLY'],
    marketRegime:'HIGH_LIQUIDITY:LOW_ANOMALY:BUY_FLOW:HIGH_TURNOVER'}
  const valid={
    memoryId:'pit-verified',userId:'u',strategyId:'SHARK_RUNTIME_NEW_PAIR',
    patternKey:'SHARK_RUNTIME_NEW_PAIR|'+base.marketRegime,marketRegime:base.marketRegime,
    sampleSize:24,winRateBps:8000,meanDecisionQualityBps:500,
    meanExecutionCostBps:50,meanAvoidedLossBps:0,meanMissedGainBps:0,
    confidenceAdjustmentBps:600,
    sourceReliability:[{sourceGroup:'dexscreener',sampleSize:24,positiveRateBps:8000,meanDecisionQualityBps:500}],
    lessonIds:Array.from({length:24},(_,i)=>'l'+i),
    evidenceIds:['runpod-shadow-pit-verified:v2'],createdAt:'2026-10-01T00:00:00Z',
    authority:'LEARNING_MEMORY_ONLY' as const,canAuthorizeLive:false as const,
  }
  const fake={...valid,memoryId:'unverified',evidenceIds:['runpod-shadow-reprice:v1']}
  const replay={...valid,memoryId:'imported-replay',evidenceIds:['runpod-shadow-replay-outcome:v1']}
  const small={...valid,memoryId:'tiny',sampleSize:3,lessonIds:['l1']}
  assert.deepEqual(applyRunpodShadowMemory({...base,cards:[fake,replay,small]}).memoryIds,[])
  assert.deepEqual(applyRunpodShadowMemory({...base,cards:[valid,fake,replay,small]}).memoryIds,['pit-verified'])
})

test('DEX pair snapshots do not falsely assert SHARK wallet or Meteora coverage',()=>{
  const result=runpodShadowSignalProvenance(candidate)
  assert.equal(result.sufficientForPaperResearch,true)
  assert.equal(result.independentlyCorroborated,false)
  assert.deepEqual(result.verifiedSourceGroups,['dexscreener'])
  assert.ok(result.unverifiedSharkSignals.includes('wallet-funding-cluster'))
  assert.ok(result.unverifiedSharkSignals.includes('meteora-adversarial-liquidity'))
  assert.equal(runpodShadowSignalProvenance({...candidate,evidenceIds:[]}).sufficientForPaperResearch,false)
})

test('overlapping snapshots cannot multiply sample weight or crowd out independent lessons',()=>{
  const regime='HIGH_LIQUIDITY:LOW_ANOMALY:BUY_FLOW:HIGH_TURNOVER'
  const card=(memoryId:string,prefix:string,adjustment:number,createdAt='2026-10-01T00:00:00Z')=>({
    memoryId,userId:'u',strategyId:'SHARK_RUNTIME_NEW_PAIR',patternKey:'SHARK_RUNTIME_NEW_PAIR|'+regime,marketRegime:regime,
    sampleSize:24,winRateBps:8000,meanDecisionQualityBps:500,meanExecutionCostBps:50,meanAvoidedLossBps:0,meanMissedGainBps:0,
    confidenceAdjustmentBps:adjustment,sourceReliability:[{sourceGroup:'dexscreener',sampleSize:24,positiveRateBps:8000,meanDecisionQualityBps:500}],
    lessonIds:Array.from({length:24},(_,i)=>prefix+i),evidenceIds:['runpod-shadow-pit-verified:v2'],createdAt,
    authority:'LEARNING_MEMORY_ONLY' as const,canAuthorizeLive:false as const,
  })
  const newest=card('newest','shared',400,'2026-10-02T00:00:00Z')
  const duplicates=Array.from({length:7},(_,i)=>card('old-'+i,'shared',400))
  const independent=card('independent','other',-400)
  const base={confidence:.6,disposition:'ALLOCATED' as const,reasonCodes:[],marketRegime:regime}
  const result=applyRunpodShadowMemory({...base,cards:[...duplicates,independent,newest]})
  assert.deepEqual(result.memoryIds,['newest','independent'])
  assert.equal(result.adjustmentBps,0)
  assert.ok(result.reasonCodes.includes('SHADOW_MEMORY_SAMPLE_48'))
  assert.deepEqual(applyRunpodShadowMemory({...base,cards:[newest,independent,...duplicates].reverse()}),result)
  const partial={...card('partial','third',500),lessonIds:['shared0',...Array.from({length:23},(_,i)=>'third'+i)]}
  assert.deepEqual(applyRunpodShadowMemory({...base,cards:[newest,partial]}).memoryIds,['newest'])
  for(const invalid of [
    {...newest,lessonIds:Array(24).fill('same')},
    {...newest,sampleSize:240},
    {...newest,sampleSize:NaN},
    {...newest,lessonIds:['',...newest.lessonIds.slice(1)]},
  ])assert.deepEqual(applyRunpodShadowMemory({...base,cards:[invalid]}).memoryIds,[])
})
