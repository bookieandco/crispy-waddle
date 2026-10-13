import test from 'node:test'
import assert from 'node:assert/strict'
import {buildSharkShadowDecisionTwin,simulateSharkShadowExecution} from './shark-shadow-learning.js'
import {runpodShadowSample,type RunpodShadowCandidate} from './shark-shadow-runpod-runtime.js'
import {runRunpodShadowLegacyCorrectionReview} from './shark-shadow-legacy-corrections.js'
import type {RunpodShadowMarketSample,RunpodShadowStore} from './shark-shadow-runpod-store.js'

const decidedAt='2026-10-01T00:00:00.000Z'
const quote=(at:string,price:number,evidenceIds:readonly string[]):RunpodShadowCandidate=>({
  chainId:'solana',tokenAddress:'m-1',pairAddress:'p-1',dexId:'pumpfun',
  priceUsd:price,liquidityUsd:100000,volume24hUsd:250000,buys24h:200,sells24h:100,
  priceChange1hPct:2,discoveredAt:at,evidenceIds,raw:{},
})
const decision=buildSharkShadowDecisionTwin({
  runtimeRunId:'correction-run',envelopeId:'correction-env',charterId:'paper',
  userId:'paper',cofferId:'paper',opportunityId:'paper-correction',
  tradeType:'new-pair-speculation',chainId:'solana',tokenAddress:'m-1',
  instrumentId:'meme:solana:m-1',disposition:'ALLOCATED',
  proposedNotionalMinor:10000n,side:'BUY',sourceConfidence:.7,sourceRisk:.2,
  sourceGroups:['dexscreener'],informationCutoff:decidedAt,decidedAt,
  market:{chainId:'solana',tokenAddress:'m-1',liquidityUsd:100000,volume24hUsd:250000,
    buys24h:200,sells24h:100,anomalyScore:.1,observedAt:decidedAt,availableAt:decidedAt,
    evidenceIds:['dexscreener:pair:p-1']},
  evidenceIds:['dexscreener:pair:p-1'],
})
const baseline=runpodShadowSample(quote(decidedAt,.01,['dexscreener:pair:p-1']))
const execution=simulateSharkShadowExecution({decision,simulatedAt:decidedAt})
const caseRecord={decision,horizon:'1H' as const,originalObservationId:'old-obs',
  originalReviewStatus:'UNVERIFIED' as const,
  baselineSampleId:baseline.sampleId,baselinePriceUsd:.01}

function fixture(sample:RunpodShadowMarketSample|undefined,options:{
  original?:typeof caseRecord
  execution?:typeof execution
  baseline?:RunpodShadowMarketSample
}={}){
  const writes:any[]=[]
  const requests:any[]=[]
  const store={
    async auditLegacyGrades(){return 1},
    async listLegacyRecheckCandidates(){return [options.original??caseRecord]},
    async findMarketSampleById(){return options.baseline??baseline},
    async loadExecution(){return options.execution??execution},
    async findMarketSampleAtOrAfter(request:any){requests.push(request);return sample},
    async appendPendingGradeCorrection(record:any){writes.push(record);return 'INSERTED'},
  }
  return {store:store as unknown as RunpodShadowStore,writes,requests}
}

test('recheck inserts independent historical correction as PENDING only and preserves originals',async()=>{
  const sampled=runpodShadowSample(quote('2026-10-01T01:05:00.000Z',.02,
    ['dexscreener:pair:p-1','runpod-shadow-replay-import:v1']))
  const {store,writes,requests}=fixture(sampled)
  const receipt=await runRunpodShadowLegacyCorrectionReview({store,now:'2026-10-02T00:00:00.000Z'})
  assert.equal(receipt.pendingCorrectionsInserted,1)
  assert.equal(receipt.originalObservationRowsChanged,0)
  assert.equal(receipt.unverifiedCorrectionsPromoted,0)
  assert.equal(receipt.memoryCardsIssued,0)
  assert.equal(receipt.swlcRecordsAcknowledged,0)
  assert.equal(receipt.canExecute,false)
  assert.equal(requests[0]!.verifiedHistoricalOnly,true)
  assert.equal(requests[0]!.pairAddress,'p-1')
  assert.equal(writes[0]!.originalObservationId,'old-obs')
  assert.equal(writes[0]!.observation.observedAt,'2026-10-01T01:05:00.000Z')
  assert.equal(writes[0]!.lesson.canAuthorizeLive,false)
})

test('ordinary DexScreener spot samples cannot rehabilitate legacy grades',async()=>{
  const sampled=runpodShadowSample(quote('2026-10-01T01:05:00.000Z',.02,['dexscreener:pair:p-1']))
  const {store,writes}=fixture(sampled)
  const receipt=await runRunpodShadowLegacyCorrectionReview({store,now:'2026-10-02T00:00:00.000Z'})
  assert.equal(receipt.unavailableIndependentSamples,1)
  assert.equal(writes.length,0)
})

test('late, wrong token or wrong pair samples fail without corrections',async()=>{
  const evidence=['runpod-shadow-replay-import:v1','dexscreener:pair:p-1']
  for(const sample of [
    runpodShadowSample(quote('2026-10-01T06:00:00.000Z',.03,evidence)),
    {...runpodShadowSample(quote('2026-10-01T01:05:00.000Z',.03,evidence)),pairAddress:'wrong'},
    {...runpodShadowSample(quote('2026-10-01T01:05:00.000Z',.03,evidence)),tokenAddress:'wrong'},
  ]){
    const {store,writes}=fixture(sample)
    const receipt=await runRunpodShadowLegacyCorrectionReview({store,now:'2026-10-02T00:00:00.000Z'})
    assert.equal(receipt.unavailableIndependentSamples,1)
    assert.equal(writes.length,0)
  }
})

test('missing baseline or execution cannot yield a correction',async()=>{
  const evidence=['runpod-shadow-replay-import:v1','dexscreener:pair:p-1']
  const sampled=runpodShadowSample(quote('2026-10-01T01:05:00.000Z',.03,evidence))
  const {store,writes}=fixture(sampled,{original:{...caseRecord,baselinePriceUsd:0}})
  const receipt=await runRunpodShadowLegacyCorrectionReview({store,now:'2026-10-02T00:00:00.000Z'})
  assert.equal(receipt.absentExecutionOrBaseline,1)
  assert.equal(writes.length,0)
})
