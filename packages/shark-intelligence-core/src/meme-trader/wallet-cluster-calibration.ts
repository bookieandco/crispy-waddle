export type WalletClusterOutcome='HEALTHY'|'ADVERSE'|'UNKNOWN'

export type WalletClusterCalibrationObservation=Readonly<{
  observationId:string
  tokenId:string
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
  informationCutoff:string
  observationCount:number
  excludedFutureObservationIds:readonly string[]
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

function validateThreshold(t:WalletClusterThresholdSpec):void{
  if(!t.thresholdId.trim())throw new Error('shark_cluster_calibration_threshold_id_required')
  if(!Number.isInteger(t.minWallets)||t.minWallets<1)throw new Error('shark_cluster_calibration_min_wallets_invalid')
  if(!Number.isInteger(t.maxWindowSeconds)||t.maxWindowSeconds<1)throw new Error('shark_cluster_calibration_window_invalid')
  if(!Number.isFinite(t.minAggregateWalletScore)||t.minAggregateWalletScore<0)throw new Error('shark_cluster_calibration_score_invalid')
  if(t.minUsd!==undefined&&(!Number.isFinite(t.minUsd)||t.minUsd<0))throw new Error('shark_cluster_calibration_usd_invalid')
}

export function evaluateWalletClusterThresholdSensitivity(input:{
  observations:readonly WalletClusterCalibrationObservation[]
  thresholds:readonly WalletClusterThresholdSpec[]
  informationCutoff:string
}):WalletClusterCalibrationReport{
  assertIso(input.informationCutoff,'shark_cluster_calibration_cutoff_invalid')
  if(!input.thresholds.length)throw new Error('shark_cluster_calibration_thresholds_required')
  const thresholdIds=new Set<string>()
  input.thresholds.forEach(t=>{validateThreshold(t);if(thresholdIds.has(t.thresholdId))throw new Error('shark_cluster_calibration_duplicate_threshold');thresholdIds.add(t.thresholdId)})
  const observationIds=new Set<string>()
  for(const o of input.observations){
    if(!o.observationId.trim()||!o.tokenId.trim()||!o.evidenceIds.length)throw new Error('shark_cluster_calibration_observation_incomplete')
    if(observationIds.has(o.observationId))throw new Error('shark_cluster_calibration_duplicate_observation')
    observationIds.add(o.observationId)
    assertIso(o.observedAt,'shark_cluster_calibration_observed_at_invalid')
    assertIso(o.availableAt,'shark_cluster_calibration_available_at_invalid')
    if(Date.parse(o.availableAt)<Date.parse(o.observedAt))throw new Error('shark_cluster_calibration_availability_invalid')
    if(!Number.isInteger(o.distinctWallets)||o.distinctWallets<1||!Number.isFinite(o.windowSeconds)||o.windowSeconds<0||!Number.isFinite(o.aggregateWalletScore)||o.aggregateWalletScore<0)throw new Error('shark_cluster_calibration_metrics_invalid')
  }

  const eligible=input.observations.filter(o=>Date.parse(o.availableAt)<=Date.parse(input.informationCutoff))
  const future=input.observations.filter(o=>Date.parse(o.availableAt)>Date.parse(input.informationCutoff)).map(o=>o.observationId).sort()
  const rows=input.thresholds.map(t=>{
    const matched=eligible.filter(o=>
      o.distinctWallets>=t.minWallets&&
      o.windowSeconds<=t.maxWindowSeconds&&
      o.aggregateWalletScore>=t.minAggregateWalletScore&&
      (t.minUsd===undefined||o.totalUsd!==undefined&&o.totalUsd>=t.minUsd)
    )
    const labeled=matched.filter(o=>o.outcome!=='UNKNOWN')
    const healthy=labeled.filter(o=>o.outcome==='HEALTHY').length
    const adverse=labeled.filter(o=>o.outcome==='ADVERSE').length
    return Object.freeze({
      thresholdId:t.thresholdId,
      matchedObservations:matched.length,
      matchedTokens:new Set(matched.map(o=>o.tokenId)).size,
      labeledObservations:labeled.length,
      outcomeCoverage:ratio(labeled.length,matched.length),
      healthyRate:labeled.length?ratio(healthy,labeled.length):null,
      adverseRate:labeled.length?ratio(adverse,labeled.length):null,
      medianWalletCount:median(matched.map(o=>o.distinctWallets)),
      evidenceIds:Object.freeze([...new Set(matched.flatMap(o=>o.evidenceIds))].sort()),
      authority:'RESEARCH_ONLY' as const,
      canSelectProductionThreshold:false as const,
    })
  })
  return Object.freeze({
    informationCutoff:input.informationCutoff,
    observationCount:eligible.length,
    excludedFutureObservationIds:Object.freeze(future),
    rows:Object.freeze(rows),
    authority:'RESEARCH_ONLY',
    canMutateRuntimeThresholds:false,
  })
}
