/**
 * Transcript-derived SHARK discovery screen. A match is a research candidate,
 * NEVER an anti-rug verdict, sellability proof, paper fill, or trade permission.
 *
 * Fees are TERMINAL-REPORTED observations, not a validated on-chain fee oracle.
 * Fee definitions vary by platform. Unknown, stale or wrong-kind fees cannot
 * silently substitute for the source video's requested metric.
 */
export type SharkDiscoveryStage='NEW_PAIR'|'FINAL_STRETCH'|'MIGRATED'|'TRENDING'
export type SharkDiscoveryPresetId=
  |'VIDEO1_NEW_PAIR_SOL_V1'
  |'VIDEO1_FINAL_STRETCH_SOL_V1'
  |'VIDEO1_FINAL_STRETCH_FAST_SOL_V1'
  |'VIDEO1_MIGRATED_SOL_V1'
  |'VIDEO2_TRENDING_SOL_V1'

export type SharkTerminalFee=Readonly<{
  kind:'GLOBAL_FEES_PAID'|'TOTAL_FEES_PAID'
  unit:'SOL'|'ETH'
  amount:number
  venue:string
  observedAt:string
  evidenceId:string
}>

export type SharkDiscoveryObservation=Readonly<{
  chainId:'solana'
  mint:string
  stage:SharkDiscoveryStage
  protocol:string
  observedAt:string
  availableAt:string
  /** Optional knowledge cutoff. Prevents accidental lookahead in replay. */
  evaluatedAsOf?:string
  ageMinutes?:number
  volumeUsd?:number
  marketCapUsd?:number
  holderCount?:number
  /** A terminal-presented social tick is NOT social authenticity proof. */
  socialLinksCount?:number
  fee?:SharkTerminalFee
  /** From existing SHARK defensive assessment; never inferred from fees. */
  defensiveBlockReasons?:readonly string[]
  evidenceIds:readonly string[]
}>

type Metric='ageMinutes'|'volumeUsd'|'marketCapUsd'|'holderCount'|'socialLinksCount'|'feePaidSol'
export type SharkDiscoveryRule=Readonly<{metric:Metric;min?:number;max?:number}>
export type SharkDiscoveryPreset=Readonly<{
  id:SharkDiscoveryPresetId
  stage:SharkDiscoveryStage
  source:'USER_VIDEO_1_2026_10_21'|'USER_VIDEO_2_2026_10_21'
  feeKind:'GLOBAL_FEES_PAID'|'TOTAL_FEES_PAID'
  rules:readonly SharkDiscoveryRule[]
  status:'UNVALIDATED_SOURCE_HYPOTHESIS'
  canAuthorizeTrade:false
}>

const preset=(
  id:SharkDiscoveryPresetId,
  stage:SharkDiscoveryStage,
  source:SharkDiscoveryPreset['source'],
  feeKind:SharkDiscoveryPreset['feeKind'],
  rules:readonly SharkDiscoveryRule[],
):SharkDiscoveryPreset=>Object.freeze({
  id,stage,source,feeKind,rules:Object.freeze(rules.map(rule=>Object.freeze({...rule}))),
  status:'UNVALIDATED_SOURCE_HYPOTHESIS' as const,
  canAuthorizeTrade:false as const,
})

/** Do not treat any thresholds as a verified accuracy claim or universal rule. */
export const SHARK_DISCOVERY_PRESETS:readonly SharkDiscoveryPreset[]=Object.freeze([
  preset('VIDEO1_NEW_PAIR_SOL_V1','NEW_PAIR','USER_VIDEO_1_2026_10_21','GLOBAL_FEES_PAID',[
    {metric:'volumeUsd',min:1000},
    {metric:'feePaidSol',min:0.2},
    {metric:'socialLinksCount',min:1},
  ]),
  preset('VIDEO1_FINAL_STRETCH_SOL_V1','FINAL_STRETCH','USER_VIDEO_1_2026_10_21','GLOBAL_FEES_PAID',[
    {metric:'ageMinutes',max:167},
    {metric:'holderCount',min:100},
    {metric:'marketCapUsd',min:3000},
    {metric:'feePaidSol',min:4},
    {metric:'socialLinksCount',min:1},
  ]),
  preset('VIDEO1_FINAL_STRETCH_FAST_SOL_V1','FINAL_STRETCH','USER_VIDEO_1_2026_10_21','GLOBAL_FEES_PAID',[
    {metric:'ageMinutes',max:20},
    {metric:'holderCount',min:100},
    {metric:'marketCapUsd',min:3000},
    {metric:'feePaidSol',min:4},
    {metric:'socialLinksCount',min:1},
  ]),
  preset('VIDEO1_MIGRATED_SOL_V1','MIGRATED','USER_VIDEO_1_2026_10_21','GLOBAL_FEES_PAID',[
    {metric:'marketCapUsd',min:15000},
    {metric:'feePaidSol',min:5},
    {metric:'socialLinksCount',min:1},
  ]),
  preset('VIDEO2_TRENDING_SOL_V1','TRENDING','USER_VIDEO_2_2026_10_21','TOTAL_FEES_PAID',[
    {metric:'ageMinutes',max:2880},
    {metric:'marketCapUsd',min:100000},
    {metric:'feePaidSol',min:15},
  ]),
])

export type SharkDiscoveryScreen=Readonly<{
  presetId:SharkDiscoveryPresetId
  mint:string
  stage:SharkDiscoveryStage
  disposition:'MATCH'|'REVIEW'|'SKIP'|'BLOCKED'
  passedRules:readonly Metric[]
  failedRules:readonly Metric[]
  missingRules:readonly Metric[]
  defensiveBlockReasons:readonly string[]
  evidenceIds:readonly string[]
  source:'USER_VIDEO_1_2026_10_21'|'USER_VIDEO_2_2026_10_21'
  authority:'DISCOVERY_RESEARCH_ONLY'
  /** Screens do not assert a token is legitimate, a rug, or sellable. */
  canLabelRug:false
  canAuthorizeTrade:false
}>

const assertTime=(v:string,name:string)=>{
  if(!v.trim()||Number.isNaN(Date.parse(v)))throw new Error(name)
}
const assertNonNegative=(v:number|undefined,name:string)=>{
  if(v!==undefined&&(!Number.isFinite(v)||v<0))throw new Error(name)
}
const unique=<T extends string>(values:readonly T[]):readonly T[]=>Object.freeze([...new Set<T>(values)].sort())

/**
 * Pure, deterministic point-in-time screen. A filtered candidate is not a
 * confirmed rug; a match requires separate independent SHARK/Money gates.
 */
export function evaluateSharkDiscoveryScreen(
  observation:SharkDiscoveryObservation,
  presetId:SharkDiscoveryPresetId,
):SharkDiscoveryScreen{
  const profile=SHARK_DISCOVERY_PRESETS.find(entry=>entry.id===presetId)
  if(!profile)throw new Error('shark_discovery_unknown_preset')
  if(observation.chainId!=='solana')throw new Error('shark_discovery_chain_invalid')
  if(observation.stage!==profile.stage)throw new Error('shark_discovery_stage_mismatch')
  if(!observation.mint.trim()||!observation.protocol.trim())throw new Error('shark_discovery_identity_required')
  if(!observation.evidenceIds.length||observation.evidenceIds.some(id=>!id.trim()))throw new Error('shark_discovery_evidence_required')
  assertTime(observation.observedAt,'shark_discovery_observed_at_invalid')
  assertTime(observation.availableAt,'shark_discovery_available_at_invalid')
  const observed=Date.parse(observation.observedAt)
  const available=Date.parse(observation.availableAt)
  if(available<observed)throw new Error('shark_discovery_chronology_invalid')
  if(observation.evaluatedAsOf!==undefined){
    assertTime(observation.evaluatedAsOf,'shark_discovery_cutoff_invalid')
    if(available>Date.parse(observation.evaluatedAsOf))throw new Error('shark_discovery_future_evidence')
  }
  for(const key of ['ageMinutes','volumeUsd','marketCapUsd','holderCount','socialLinksCount'] as const){
    assertNonNegative(observation[key],`shark_discovery_${key}_invalid`)
  }
  if(observation.holderCount!==undefined&&!Number.isInteger(observation.holderCount))throw new Error('shark_discovery_holders_fractional')
  if(observation.socialLinksCount!==undefined&&!Number.isInteger(observation.socialLinksCount))throw new Error('shark_discovery_socials_fractional')
  const fee=observation.fee
  if(fee){
    assertNonNegative(fee.amount,'shark_discovery_fee_invalid')
    if(!fee.venue.trim()||!fee.evidenceId.trim()||!observation.evidenceIds.includes(fee.evidenceId))
      throw new Error('shark_discovery_fee_provenance_required')
    assertTime(fee.observedAt,'shark_discovery_fee_time_invalid')
    if(Date.parse(fee.observedAt)>available)throw new Error('shark_discovery_future_fee')
    if(!['SOL','ETH'].includes(fee.unit)||!['GLOBAL_FEES_PAID','TOTAL_FEES_PAID'].includes(fee.kind))
      throw new Error('shark_discovery_fee_schema_invalid')
  }
  const blocks=unique(observation.defensiveBlockReasons??[])
  if(blocks.some(reason=>!reason.trim()))throw new Error('shark_discovery_block_reason_invalid')

  const passed:Metric[]=[],failed:Metric[]=[],missing:Metric[]=[]
  for(const rule of profile.rules){
    const amount=rule.metric==='feePaidSol'
      ? fee?.unit==='SOL'&&fee.kind===profile.feeKind?fee.amount:undefined
      : observation[rule.metric]
    if(amount===undefined){missing.push(rule.metric);continue}
    if((rule.min!==undefined&&amount<rule.min)||(rule.max!==undefined&&amount>rule.max)){
      failed.push(rule.metric)
    }else{
      passed.push(rule.metric)
    }
  }
  // A known independent defensive veto dominates every source-derived screen.
  const disposition=blocks.length?'BLOCKED':failed.length?'SKIP':missing.length?'REVIEW':'MATCH'
  return Object.freeze({
    presetId,mint:observation.mint,stage:observation.stage,disposition,
    passedRules:unique(passed),failedRules:unique(failed),missingRules:unique(missing),
    defensiveBlockReasons:blocks,evidenceIds:unique(observation.evidenceIds),
    source:profile.source,authority:'DISCOVERY_RESEARCH_ONLY' as const,
    canLabelRug:false as const,canAuthorizeTrade:false as const,
  })
}
