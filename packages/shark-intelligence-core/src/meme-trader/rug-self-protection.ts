import type { RugProtectionResult } from './rug-protection'

export type RugCriticalCoverage = Readonly<{
  sellability: boolean
  liquidityControl: boolean
  authorityControl: boolean
  holderIndependence: boolean
  operatorIdentity: boolean
}>

export type RugRuntimeObservation = Readonly<{
  evidenceId: string
  observedAt: string
  availableAt: string
  drawdownFromPeak?: number
  liquidityRemovedPct?: number
  volumeSpikeFactor?: number
  consecutiveDrops?: number
  secondsSincePeak?: number
  operatorDistributionPct?: number
  source: string
}>

export type RugModelCalibration = 'UNVERIFIED' | 'OUT_OF_DOMAIN' | 'PAPER_CALIBRATED' | 'SHADOW_CALIBRATED'

export type RugModelSignal = Readonly<{
  modelId: string
  rugProbability: number
  calibration: RugModelCalibration
  evidenceIds: readonly string[]
}>

export type RugSelfProtectionThresholds = Readonly<{
  emergencyLiquidityRemovalPct: number
  emergencyDrawdownFromPeak: number
  collapseVolumeSpikeFactor: number
  collapseConsecutiveDrops: number
  operatorDistributionPct: number
  highModelProbability: number
}>

/**
 * Research defaults only. They exist to make paper/shadow studies repeatable.
 * They are not production/live-money thresholds and cannot self-promote.
 */
export const DEFAULT_PAPER_RUG_SELF_PROTECTION_THRESHOLDS: RugSelfProtectionThresholds = Object.freeze({
  emergencyLiquidityRemovalPct: 0.25,
  emergencyDrawdownFromPeak: 0.55,
  collapseVolumeSpikeFactor: 1.5,
  collapseConsecutiveDrops: 3,
  operatorDistributionPct: 0.25,
  highModelProbability: 0.75,
})

export type RugSelfProtectionAction =
  | 'ALLOW_PAPER_STUDY'
  | 'CAUTION'
  | 'BLOCK_NEW_ENTRY'
  | 'EXIT_RECOMMENDED'
  | 'QUARANTINE'

export type RugSelfProtectionResult = Readonly<{
  action: RugSelfProtectionAction
  reasons: readonly string[]
  missingCriticalCoverage: readonly (keyof RugCriticalCoverage)[]
  evidenceIds: readonly string[]
  modelEscalations: readonly string[]
  authority: 'RESEARCH_ONLY'
  canAuthorizeTrade: false
  canAuthorizeExit: false
  canLowerDeterministicRisk: false
}>

const iso=(value:string,code:string)=>{
  if(!value||Number.isNaN(Date.parse(value)))throw new Error(code)
}
const unit=(value:number,code:string)=>{
  if(!Number.isFinite(value)||value<0||value>1)throw new Error(code)
}
const positive=(value:number,code:string)=>{
  if(!Number.isFinite(value)||value<0)throw new Error(code)
}

function validateThresholds(t:RugSelfProtectionThresholds):void{
  unit(t.emergencyLiquidityRemovalPct,'shark_rug_self_protection_liquidity_threshold_invalid')
  unit(t.emergencyDrawdownFromPeak,'shark_rug_self_protection_drawdown_threshold_invalid')
  positive(t.collapseVolumeSpikeFactor,'shark_rug_self_protection_volume_threshold_invalid')
  if(!Number.isInteger(t.collapseConsecutiveDrops)||t.collapseConsecutiveDrops<1)throw new Error('shark_rug_self_protection_drop_threshold_invalid')
  unit(t.operatorDistributionPct,'shark_rug_self_protection_operator_distribution_threshold_invalid')
  unit(t.highModelProbability,'shark_rug_self_protection_model_threshold_invalid')
}

function validateRuntime(o:RugRuntimeObservation):void{
  if(!o.evidenceId.trim()||!o.source.trim())throw new Error('shark_rug_self_protection_runtime_identity_required')
  iso(o.observedAt,'shark_rug_self_protection_runtime_observed_at_invalid')
  iso(o.availableAt,'shark_rug_self_protection_runtime_available_at_invalid')
  if(Date.parse(o.availableAt)<Date.parse(o.observedAt))throw new Error('shark_rug_self_protection_runtime_availability_invalid')
  if(o.drawdownFromPeak!==undefined)unit(o.drawdownFromPeak,'shark_rug_self_protection_drawdown_invalid')
  if(o.liquidityRemovedPct!==undefined)unit(o.liquidityRemovedPct,'shark_rug_self_protection_liquidity_removed_invalid')
  if(o.volumeSpikeFactor!==undefined)positive(o.volumeSpikeFactor,'shark_rug_self_protection_volume_spike_invalid')
  if(o.consecutiveDrops!==undefined&&(!Number.isInteger(o.consecutiveDrops)||o.consecutiveDrops<0))throw new Error('shark_rug_self_protection_consecutive_drops_invalid')
  if(o.secondsSincePeak!==undefined&&(!Number.isFinite(o.secondsSincePeak)||o.secondsSincePeak<0))throw new Error('shark_rug_self_protection_seconds_since_peak_invalid')
  if(o.operatorDistributionPct!==undefined)unit(o.operatorDistributionPct,'shark_rug_self_protection_operator_distribution_invalid')
}

function severity(action:RugSelfProtectionAction):number{
  return {
    ALLOW_PAPER_STUDY:0,
    CAUTION:1,
    BLOCK_NEW_ENTRY:2,
    EXIT_RECOMMENDED:3,
    QUARANTINE:4,
  }[action]
}

function maxAction(a:RugSelfProtectionAction,b:RugSelfProtectionAction):RugSelfProtectionAction{
  return severity(a)>=severity(b)?a:b
}

/**
 * Fail-closed SHARK self-protection.
 *
 * - Missing critical evidence quarantines the candidate instead of assuming safety.
 * - Existing deterministic RugProtection BLOCK always wins.
 * - Runtime collapse/liquidity/operator-distribution evidence can recommend exit.
 * - ML/AI signals are asymmetric: calibrated high-risk scores may escalate caution,
 *   but no model is allowed to lower deterministic risk or grant trade authority.
 * - This object is research-only. Money Core remains the only financial authority.
 */
export function evaluateRugSelfProtection(input:{
  rugProtection:RugProtectionResult
  coverage:RugCriticalCoverage
  runtime?:readonly RugRuntimeObservation[]
  modelSignals?:readonly RugModelSignal[]
  thresholds?:RugSelfProtectionThresholds
  informationCutoff:string
}):RugSelfProtectionResult{
  iso(input.informationCutoff,'shark_rug_self_protection_cutoff_invalid')
  const thresholds=input.thresholds??DEFAULT_PAPER_RUG_SELF_PROTECTION_THRESHOLDS
  validateThresholds(thresholds)

  const missing=(Object.entries(input.coverage) as [keyof RugCriticalCoverage,boolean][])
    .filter(([,covered])=>covered!==true)
    .map(([name])=>name)
    .sort()

  const reasons:string[]=[]
  const evidenceIds=new Set<string>(input.rugProtection.evidenceIds)
  const modelEscalations:string[]=[]
  let action:RugSelfProtectionAction='ALLOW_PAPER_STUDY'

  if(missing.length){
    action='QUARANTINE'
    reasons.push(`critical rug evidence missing: ${missing.join(',')}`)
  }

  if(input.rugProtection.disposition==='BLOCK'){
    action='QUARANTINE'
    reasons.push(...input.rugProtection.hardBlockers.map(x=>`deterministic block: ${x}`))
  }else if(input.rugProtection.disposition==='REVIEW'){
    action=maxAction(action,'CAUTION')
    reasons.push(...input.rugProtection.warnings.map(x=>`deterministic warning: ${x}`))
  }

  for(const observation of input.runtime??[]){
    validateRuntime(observation)
    if(Date.parse(observation.availableAt)>Date.parse(input.informationCutoff))continue
    evidenceIds.add(observation.evidenceId)

    if((observation.liquidityRemovedPct??0)>=thresholds.emergencyLiquidityRemovalPct){
      action=maxAction(action,'EXIT_RECOMMENDED')
      reasons.push(`runtime liquidity removal ${observation.liquidityRemovedPct}`)
    }
    if((observation.operatorDistributionPct??0)>=thresholds.operatorDistributionPct){
      action=maxAction(action,'EXIT_RECOMMENDED')
      reasons.push(`operator-linked distribution ${observation.operatorDistributionPct}`)
    }

    const collapse=
      (observation.drawdownFromPeak??0)>=thresholds.emergencyDrawdownFromPeak &&
      (observation.volumeSpikeFactor??0)>=thresholds.collapseVolumeSpikeFactor &&
      (observation.consecutiveDrops??0)>=thresholds.collapseConsecutiveDrops
    if(collapse){
      action=maxAction(action,'EXIT_RECOMMENDED')
      reasons.push('runtime collapse pattern detected')
    }
  }

  for(const model of input.modelSignals??[]){
    if(!model.modelId.trim())throw new Error('shark_rug_self_protection_model_id_required')
    unit(model.rugProbability,'shark_rug_self_protection_model_probability_invalid')
    for(const id of model.evidenceIds)evidenceIds.add(id)

    // Unverified and out-of-domain models are useful research context only.
    if(model.calibration==='UNVERIFIED'||model.calibration==='OUT_OF_DOMAIN')continue

    if(model.rugProbability>=thresholds.highModelProbability){
      const escalation=`${model.modelId}:${model.rugProbability.toFixed(3)}`
      modelEscalations.push(escalation)
      action=maxAction(action,'BLOCK_NEW_ENTRY')
      reasons.push(`calibrated rug model escalation ${escalation}`)
    }
  }

  return Object.freeze({
    action,
    reasons:Object.freeze([...new Set(reasons)]),
    missingCriticalCoverage:Object.freeze(missing),
    evidenceIds:Object.freeze([...evidenceIds].sort()),
    modelEscalations:Object.freeze(modelEscalations.sort()),
    authority:'RESEARCH_ONLY',
    canAuthorizeTrade:false,
    canAuthorizeExit:false,
    canLowerDeterministicRisk:false,
  })
}
