import {createHash} from 'node:crypto'
import {
  buildSharkShadowCounterfactual,
  observeSharkShadowOutcome,
} from './shark-shadow-learning.js'
import {
  isRunpodShadowPointInTimeSample,
  runpodShadowHorizonTarget,
} from './shark-shadow-runpod-runtime.js'
import type {RunpodShadowStore} from './shark-shadow-runpod-store.js'

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const unique=(xs:readonly string[])=>[...new Set(xs.filter(Boolean))]

export type ShadowCorrectionReviewReceipt=Readonly<{
  schema:'jhadina.shadow.legacy-correction-review.v1'
  reviewId:string
  reviewedAt:string
  candidates:number
  pendingCorrectionsInserted:number
  alreadyReviewedOrReplayed:number
  unavailableIndependentSamples:number
  absentExecutionOrBaseline:number
  unverifiedCorrectionsPromoted:0
  originalObservationRowsChanged:0
  memoryCardsIssued:0
  swlcRecordsAcknowledged:0
  authority:'PAPER_RESEARCH_RECHECK_ONLY'
  canExecute:false
  canAuthorizeLive:false
}>

export async function runRunpodShadowLegacyCorrectionReview(input:Readonly<{
  store:RunpodShadowStore
  now?:string
  limit?:number
}>):Promise<ShadowCorrectionReviewReceipt>{
  const now=input.now??new Date().toISOString()
  if(!Number.isFinite(Date.parse(now)))throw Error('SHADOW_CORRECTION_NOW_INVALID')
  await input.store.auditLegacyGrades()
  const cases=await input.store.listLegacyRecheckCandidates({limit:input.limit??100})
  let pendingCorrectionsInserted=0,alreadyReviewedOrReplayed=0
  let unavailableIndependentSamples=0,absentExecutionOrBaseline=0

  for(const item of cases){
    const d=item.decision
    const baseline=await input.store.findMarketSampleById(item.baselineSampleId)
    const execution=await input.store.loadExecution(d.decisionId)
    if(!baseline?.pairAddress||!baseline.priceUsd||baseline.priceUsd<=0
      ||!item.baselinePriceUsd||item.baselinePriceUsd<=0||!execution){
      absentExecutionOrBaseline++
      continue
    }
    const target=runpodShadowHorizonTarget(d.decidedAt,item.horizon)
    const through=target.latestAt<now?target.latestAt:now
    if(target.dueAt>now){unavailableIndependentSamples++;continue}
    const sample=await input.store.findMarketSampleAtOrAfter({
      chainId:d.chainId,tokenAddress:d.tokenAddress,pairAddress:baseline.pairAddress,
      from:target.dueAt,through,verifiedHistoricalOnly:true,
    })
    if(!sample||!isRunpodShadowPointInTimeSample({
      decidedAt:d.decidedAt,horizon:item.horizon,sample,chainId:d.chainId,
      tokenAddress:d.tokenAddress,expectedPairAddress:baseline.pairAddress,asOf:now,
    }) || !sample.evidenceIds.some(id=>
      id==='runpod-shadow-replay-import:v1'||id==='runpod-forward-pit-ledger:v1')){
      unavailableIndependentSamples++
      continue
    }
    const returnPct=(sample.priceUsd!/item.baselinePriceUsd-1)*100
    const observation=observeSharkShadowOutcome({
      decision:d,horizon:item.horizon,observedAt:sample.observedAt,
      baselineLaunchReturnPct:0,observedLaunchReturnPct:returnPct,
      baselineLiquidityUsd:d.market.liquidityUsd,
      observedLiquidityUsd:sample.liquidityUsd,
      launchOutcome:sample.liquidityUsd<=0?'FAILED':'UNKNOWN',
      liquidityRemoved:sample.liquidityUsd<=0,tradingHalted:false,
      evidenceIds:unique([...sample.evidenceIds,sample.sampleId,
        'runpod-shadow-independent-pit-correction-pending:v1',
        'original-observation:'+item.originalObservationId]),
    })
    const lesson=buildSharkShadowCounterfactual({decision:d,execution,observation})
    const status=await input.store.appendPendingGradeCorrection({
      decision:d,horizon:item.horizon,
      originalObservationId:item.originalObservationId,
      targetSampleId:sample.sampleId,observation,lesson,
    })
    if(status==='INSERTED')pendingCorrectionsInserted++
    else alreadyReviewedOrReplayed++
  }
  return Object.freeze({
    schema:'jhadina.shadow.legacy-correction-review.v1' as const,
    reviewId:'shadow-recheck:'+hash({now,candidates:cases.map(c=>[c.decision.decisionId,c.horizon])}),
    reviewedAt:now,candidates:cases.length,pendingCorrectionsInserted,alreadyReviewedOrReplayed,
    unavailableIndependentSamples,absentExecutionOrBaseline,
    unverifiedCorrectionsPromoted:0 as const,originalObservationRowsChanged:0 as const,
    memoryCardsIssued:0 as const,swlcRecordsAcknowledged:0 as const,
    authority:'PAPER_RESEARCH_RECHECK_ONLY' as const,
    canExecute:false as const,canAuthorizeLive:false as const,
  })
}
