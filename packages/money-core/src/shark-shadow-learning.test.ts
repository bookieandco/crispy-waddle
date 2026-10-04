import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSharkShadowCounterfactual,
  buildSharkShadowDecisionTwin,
  buildSharkShadowMemoryCard,
  buildSharkShadowReplayManifest,
  calibrateSharkShadowPerformance,
  certifySharkShadowLearningFinal,
  observeSharkShadowOutcome,
  retrieveSimilarSharkShadowMemory,
  simulateSharkShadowExecution,
  type SharkShadowCounterfactualLesson,
} from './shark-shadow-learning.js'

const market={
  chainId:'solana',tokenAddress:'TokenA',liquidityUsd:100000,volume24hUsd:300000,buys24h:700,sells24h:300,anomalyScore:.1,
  observedAt:'2026-10-03T16:59:00Z',availableAt:'2026-10-03T16:59:30Z',evidenceIds:['market:1'],
} as const
const base={
  runtimeRunId:'run:1',envelopeId:'env:1',charterId:'charter:1',userId:'u1',cofferId:'c1',opportunityId:'o1',
  tradeType:'new-pair-speculation',chainId:'solana',tokenAddress:'TokenA',instrumentId:'meme:solana:TokenA',
  sourceConfidence:.72,sourceRisk:.2,sourceGroups:['x','reddit','wallet'],informationCutoff:'2026-10-03T17:00:00Z',
  decidedAt:'2026-10-03T17:00:10Z',market,evidenceIds:['decision:1'],
} as const

test('twins accepted and rejected decisions without execution authority',()=>{
    const trade=buildSharkShadowDecisionTwin({...base,disposition:'ALLOCATED',proposedNotionalMinor:10000n})
  assert.equal(trade.action,'PAPER_TRADE')
  assert.equal(trade.side,'BUY')
  assert.equal(trade.canExecute,false)
    const noTrade=buildSharkShadowDecisionTwin({...base,runtimeRunId:'run:2',disposition:'PURSE_REJECTED'})
  assert.equal(noTrade.action,'NO_TRADE')
  assert.equal(noTrade.proposedNotionalMinor,0n)
  })

test('simulates costs and proves zero signing/broadcast authority',()=>{
    const d=buildSharkShadowDecisionTwin({...base,disposition:'ALLOCATED',proposedNotionalMinor:25000n})
    const s=simulateSharkShadowExecution({decision:d,simulatedAt:'2026-10-03T17:00:20Z'})
  assert.ok(s.totalEstimatedCostBps>0)
  assert.ok(s.estimatedFilledMinor>0n)
  assert.equal(s.canSign,false)
  assert.equal(s.canBroadcast,false)
  assert.equal(s.canExecute,false)
  })

test('learns both avoided losses and missed gains from NO_TRADE decisions',()=>{
    const d=buildSharkShadowDecisionTwin({...base,runtimeRunId:'run:no',disposition:'PURSE_REJECTED'})
    const s=simulateSharkShadowExecution({decision:d,simulatedAt:'2026-10-03T17:00:20Z'})
    const bad=observeSharkShadowOutcome({decision:d,horizon:'1H',observedAt:'2026-10-03T18:05:00Z',baselineLaunchReturnPct:10,observedLaunchReturnPct:-10,evidenceIds:['outcome:bad']})
    const avoided=buildSharkShadowCounterfactual({decision:d,execution:s,observation:bad})
  assert.ok(avoided.avoidedLossBps>0)
    const good=observeSharkShadowOutcome({decision:d,horizon:'4H',observedAt:'2026-10-03T21:05:00Z',baselineLaunchReturnPct:10,observedLaunchReturnPct:80,evidenceIds:['outcome:good']})
    const missed=buildSharkShadowCounterfactual({decision:d,execution:s,observation:good})
  assert.ok(missed.missedGainBps>0)
  })

test('builds performance MIMS, calibration and retrievable pattern memory',()=>{
    const lessons:SharkShadowCounterfactualLesson[]=[]
    for(let i=0;i<24;i++){
      const d=buildSharkShadowDecisionTwin({...base,runtimeRunId:'run:'+i,envelopeId:'env:'+i,disposition:'ALLOCATED',proposedNotionalMinor:10000n})
      const s=simulateSharkShadowExecution({decision:d,simulatedAt:'2026-10-03T17:00:20Z'})
      const o=observeSharkShadowOutcome({decision:d,horizon:'1H',observedAt:'2026-10-03T18:05:00Z',baselineLaunchReturnPct:0,observedLaunchReturnPct:20+i,evidenceIds:['outcome:'+i]})
      lessons.push(buildSharkShadowCounterfactual({decision:d,execution:s,observation:o}))
    }
    const c=calibrateSharkShadowPerformance({userId:'u1',strategyId:'SHARK_RUNTIME_NEW_PAIR',lessons,calibratedAt:'2026-10-04T00:00:00Z'})
  assert.equal(c.sampleSize,24)
  assert.equal(c.performanceMims.status,'PASS')
  assert.equal(c.canMutateMandate,false)
    const card=buildSharkShadowMemoryCard({userId:'u1',strategyId:c.strategyId,marketRegime:lessons[0]!.marketRegime,lessons,calibration:c,createdAt:'2026-10-04T00:00:00Z'})
  assert.equal(retrieveSimilarSharkShadowMemory({strategyId:c.strategyId,marketRegime:lessons[0]!.marketRegime,cards:[card]}).length,1)
  })

test('replay stays research-only and final certification never grants live authority',()=>{
    const r=buildSharkShadowReplayManifest({userId:'u1',from:'2026-09-01T00:00:00Z',to:'2026-09-30T23:59:59Z',generatedAt:'2026-10-03T18:00:00Z',decisionIds:['d1'],observationIds:['o1'],lessonIds:['l1'],futureEvidenceRejected:2})
  assert.equal(r.canExecute,false)
  assert.equal(r.canAuthorizeLive,false)
    const final=certifySharkShadowLearningFinal({ledger:true,decisionTwin:true,executionSimulation:true,outcomeObserver:true,counterfactual:true,performanceMims:true,memory:true,continuousRuntime:true,replay:true,authorityBoundary:true})
  assert.equal(final.passed,true)
  assert.equal(final.liveExecutionAuthorized,false)
  })