export type WalletClusterOutcome='HEALTHY'|'ADVERSE'|'UNKNOWN'

export type WalletClusterCalibrationObservation=Readonly<{
  observationId:string
  tokenId:string
  scoreModelId:string
  distinctWallets:number
  windowSeconds:number
  aggregateWalletScore:number
  totalUsd?:number
  observedAt:string
  availableAt:string
  outcome:WalletClusterOutcome
  evidenceIds:readonly string[]
}>

export type WalletClusterThresholdSpec=Readonly<{
  thresholdId:string
  minWallets:number
  maxWindowSeconds:number
  minAggregateWalletScore:number
  minUsd?:number
}>

export type WalletClusterCalibrationRow=Readonly<{
  thresholdId:string
  matchedObservations:number
  matchedTokens:number
  labeledObservations:number
  outcomeCoverage:number
  healthyRate:number|null
  adverseRate:number|null
  medianWalletCount:number|null
  evidenceIds:readonly string[]
  authority:'RESEARCH_ONLY'
  canSelectProductionThreshold:false
}>

export type WalletClusterCalibrationReport=Readonly<{
  scoreModelId:string
  informationCutoff:string
  observationCount:number
  excludedFutureObservationIds:readonly string[]
  excludedScoreModelObservationIds:readonly string[]
  rows:readonly WalletClusterCalibrationRow[]
  authority:'RESEARCH_ONLY'
  canMutateRuntimeThresholds:false
}>

const assertIso=(value:string,code:string)=>{if(!value||Number.isNaN(Date.parse(value)))throw new Error(code)}
const ratio=(n:number,d:number)=>d?n/d:0
const median=(values:number[]):number|null=>{
  if(!values.length)return null
  const xs=[...values].sort((a,b)=>a-b),mid=Math.floor(xs.length/2)
  return xs.length%2?xs[mid]!:(xs[mid-1]!+xs[mid]!)/2
}

export function assertWalletClusterCalibrationObservation(o:WalletClusterCalibrationObservation):void{
  if(!o.observationId.trim()||!o.tokenId.trim()||!o.scoreModelId.trim()||!o.evidenceIds.length)throw new Error('shark_cluster_calibration_observation_incomplete')
  assertIso(o.observedAt,'shark_cluster_calibration_observed_at_invalid')
  assertIso(o.availableAt,'shark_cluster_calibration_available_at_invalid')
  if(Date.parse(o.availableAt)<Date.parse(o.observedAt))throw new Error('shark_cluster_calibration_availability_invalid')
  if(!Number.isInteger(o.distinctWallets)||o.distinctWallets<1||!Number.isInteger(o.windowSeconds)||o.windowSeconds<0||!Number.isFinite(o.aggregateWalletScore)||o.aggregateWalletScore<0)throw new Error('shark_cluster_calibration_metrics_invalid')
  if(o.totalUsd!==undefined&&(!Number.isFinite(o.totalUsd)||o.totalUsd<0))throw new Error('shark_cluster_calibration_usd_invalid')
  if(!['HEALTHY','ADVERSE','UNKNOWN'].includes(o.outcome))throw new Error('shark_cluster_calibration_outcome_invalid')
}

function validateThreshold(t:WalletClusterThresholdSpec):void{
  if(!t.thresholdId.trim())throw new Error('shark_cluster_calibration_threshold_id_required')
  if(!Number.isInteger(t.minWallets)||t.minWallets<1)throw new Error('shark_cluster_calibration_min_wallets_invalid')
  if(!Number.isInteger(t.maxWindowSeconds)||t.maxWindowSeconds<1)throw new Error('shark_cluster_calibration_window_invalid')
  if(!Number.isFinite(t.minAggregateWalletScore)||t.minAggregateWalletScore<0)throw new Error('shark_cluster_calibration_score_invalid')
  if(t.minUsd!==undefined&&(!Number.isFinite(t.minUsd)||t.minUsd<0))throw new Error('shark_cluster_calibration_usd_invalid')
}

function representativeByToken(rows:readonly WalletClusterCalibrationObservation[]):WalletClusterCalibrationObservation[]{
  const grouped=new Map<string,WalletClusterCalibrationObservation[]>()
  for(const row of rows){
    const xs=grouped.get(row.tokenId)??[]
    xs.push(row)
    grouped.set(row.tokenId,xs)
  }
  const result:WalletClusterCalibrationObservation[]=[]
  for(const [tokenId,xs] of grouped){
    const labels=new Set(xs.filter(x=>x.outcome!=='UNKNOWN').map(x=>x.outcome))
    if(labels.size>1)throw new Error(`shark_cluster_calibration_conflicting_outcomes:${tokenId}`)
    // One token should count once per threshold. Prefer the earliest matching signal;
    // if tied, prefer the one with more wallets, then stable observation ID ordering.
    const sorted=[...xs].sort((a,b)=>
      Date.parse(a.observedAt)-Date.parse(b.observedAt)
      || b.distinctWallets-a.distinctWallets
      || a.observationId.localeCompare(b.observationId)
    )
    result.push(sorted[0]!)
  }
  return result
}

export function evaluateWalletClusterThresholdSensitivity(input:{
  observations:readonly WalletClusterCalibrationObservation[]
  thresholds:readonly WalletClusterThresholdSpec[]
  scoreModelId:string
  informationCutoff:string
}):WalletClusterCalibrationReport{
  assertIso(input.informationCutoff,'shark_cluster_calibration_cutoff_invalid')
  if(!input.scoreModelId.trim())throw new Error('shark_cluster_calibration_score_model_required')
  if(!input.thresholds.length)throw new Error('shark_cluster_calibration_thresholds_required')
  const thresholdIds=new Set<string>()
  input.thresholds.forEach(t=>{validateThreshold(t);if(thresholdIds.has(t.thresholdId))throw new Error('shark_cluster_calibration_duplicate_threshold');thresholdIds.add(t.thresholdId)})
  const observationIds=new Set<string>()
  for(const o of input.observations){
    assertWalletClusterCalibrationObservation(o)
    if(observationIds.has(o.observationId))throw new Error('shark_cluster_calibration_duplicate_observation')
    observationIds.add(o.observationId)
  }

  const cutoff=Date.parse(input.informationCutoff)
  const future=input.observations.filter(o=>Date.parse(o.availableAt)>cutoff).map(o=>o.observationId).sort()
  const wrongModel=input.observations.filter(o=>o.scoreModelId!==input.scoreModelId).map(o=>o.observationId).sort()
  const eligible=input.observations.filter(o=>Date.parse(o.availableAt)<=cutoff&&o.scoreModelId===input.scoreModelId)
  const rows=input.thresholds.map(t=>{
    const matched=eligible.filter(o=>
      o.distinctWallets>=t.minWallets&&
      o.windowSeconds<=t.maxWindowSeconds&&
      o.aggregateWalletScore>=t.minAggregateWalletScore&&
      (t.minUsd===undefined||o.totalUsd!==undefined&&o.totalUsd>=t.minUsd)
    )
    const representatives=representativeByToken(matched)
    const labeled=representatives.filter(o=>o.outcome!=='UNKNOWN')
    const healthy=labeled.filter(o=>o.outcome==='HEALTHY').length
    const adverse=labeled.filter(o=>o.outcome==='ADVERSE').length
    return Object.freeze({
      thresholdId:t.thresholdId,
      matchedObservations:matched.length,
      matchedTokens:representatives.length,
      labeledObservations:labeled.length,
      outcomeCoverage:ratio(labeled.length,representatives.length),
      healthyRate:labeled.length?ratio(healthy,labeled.length):null,
      adverseRate:labeled.length?ratio(adverse,labeled.length):null,
      medianWalletCount:median(representatives.map(o=>o.distinctWallets)),
      evidenceIds:Object.freeze([...new Set(representatives.flatMap(o=>o.evidenceIds))].sort()),
      authority:'RESEARCH_ONLY' as const,
      canSelectProductionThreshold:false as const,
    })
  })
  return Object.freeze({
    scoreModelId:input.scoreModelId,
    informationCutoff:input.informationCutoff,
    observationCount:eligible.length,
    excludedFutureObservationIds:Object.freeze(future),
    excludedScoreModelObservationIds:Object.freeze(wrongModel),
    rows:Object.freeze(rows),
    authority:'RESEARCH_ONLY',
    canMutateRuntimeThresholds:false,
  })
}
