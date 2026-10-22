import type {SharkDiscoveryScreen,SharkDiscoveryPresetId} from './stage-aware-discovery-screen'

export type ProspectiveLabel=Readonly<{
  rug:'CONFIRMED_RUG'|'CONFIRMED_NON_RUG'|'UNKNOWN'
  /** Verified realizable runner vs a mere candle/high watermark. */
  runner:'VERIFIED_SELLABLE_RUNNER'|'VERIFIED_NOT_RUNNER'|'UNKNOWN'
  observedAt:string
  availableAt:string
  evidenceIds:readonly string[]
  independentlyVerified:boolean
}>
export type ProspectiveCase=Readonly<{
  caseId:string
  mint:string
  originalPairId:string
  cohort:'DEVELOPMENT'|'HOLDOUT'
  decisionAt:string
  informationCutoff:string
  screen:SharkDiscoveryScreen
  outcome?:ProspectiveLabel
}>
export type ProspectiveFilterReport=Readonly<{
  presetId:SharkDiscoveryPresetId
  cohort:'HOLDOUT'
  total:number
  matched:number
  skipped:number
  blocked:number
  review:number
  confirmedRug:number
  confirmedNonRug:number
  unknownRug:number
  correctlyRejectedRug:number
  missedRug:number
  falselyRejectedNonRug:number
  correctlyRetainedNonRug:number
  rugRejectionRecall?:number
  rugRejectionPrecision?:number
  rugFalseRejectionRate?:number
  missedVerifiedRunners:number
  verifiedRunnerCount:number
  runnerUnknown:number
  /** A claimed 99% detection/precision cannot be inferred from these empty slots. */
  evidenceStatus:'NO_VERIFIED_HOLDOUT'|'PARTIAL_HOLDOUT_LABELS'|'VERIFIED_HOLDOUT_LABELS'
  authority:'OUT_OF_SAMPLE_RESEARCH_ONLY'
  canAuthorizeTrade:false
}>
const time=(v:string,code:string)=>{
  const n=Date.parse(v)
  if(!v.trim()||!Number.isFinite(n))throw new Error(code)
  return n
}
const ratio=(n:number,d:number)=>d?n/d:undefined

/**
 * Prospective only: predictions must be sealed before outcomes become known.
 * Samples with unavailable independent labels remain unknown; not wins/losses.
 * Distinct original pair/mint prevents switching pairs to cherry-pick winners.
 */
export function scoreProspectiveFilterHoldout(input:{
  cases:readonly ProspectiveCase[]
  presetId:SharkDiscoveryPresetId
  splitFrozenAt:string
  evaluatedAt:string
}):ProspectiveFilterReport{
  const split=time(input.splitFrozenAt,'shark_filter_split_invalid')
  const evaluated=time(input.evaluatedAt,'shark_filter_evaluation_invalid')
  if(split>evaluated)throw new Error('shark_filter_split_future')
  const ids=new Set<string>(),identities=new Set<string>()
  let matched=0,skipped=0,blocked=0,review=0
  let confirmedRug=0,confirmedNonRug=0,unknownRug=0
  let correctlyRejectedRug=0,missedRug=0,falselyRejectedNonRug=0,correctlyRetainedNonRug=0
  let missedVerifiedRunners=0,verifiedRunnerCount=0,runnerUnknown=0
  for(const entry of input.cases){
    if(entry.screen.presetId!==input.presetId)throw new Error('shark_filter_preset_mismatch')
    if(entry.cohort!=='HOLDOUT')throw new Error('shark_filter_development_leak')
    if(!entry.caseId.trim()||!entry.mint.trim()||!entry.originalPairId.trim())
      throw new Error('shark_filter_case_identity_missing')
    if(ids.has(entry.caseId))throw new Error('shark_filter_duplicate_case')
    ids.add(entry.caseId)
    const identity=entry.mint+':'+entry.originalPairId
    if(identities.has(identity))throw new Error('shark_filter_duplicate_asset_pair')
    identities.add(identity)
    if(entry.screen.mint!==entry.mint||entry.screen.canAuthorizeTrade!==false)
      throw new Error('shark_filter_case_binding_invalid')
    const decision=time(entry.decisionAt,'shark_filter_decision_invalid')
    const cutoff=time(entry.informationCutoff,'shark_filter_cutoff_invalid')
    if(decision<split||cutoff>decision||decision>evaluated)throw new Error('shark_filter_decision_chronology_invalid')
    const selection=entry.screen.disposition
    if(selection==='MATCH')matched++
    else if(selection==='SKIP')skipped++
    else if(selection==='BLOCKED')blocked++
    else review++
    const label=entry.outcome
    let labelUsable=false
    if(label){
      const observed=time(label.observedAt,'shark_filter_label_observed_invalid')
      const available=time(label.availableAt,'shark_filter_label_available_invalid')
      if(observed<decision||available<observed)throw new Error('shark_filter_outcome_lookahead_or_order_invalid')
      if(!label.evidenceIds.length||label.evidenceIds.some(id=>!id.trim()))
        throw new Error('shark_filter_outcome_evidence_missing')
      labelUsable=label.independentlyVerified&&available<=evaluated
    }
    const rug=labelUsable?label!.rug:'UNKNOWN'
    const runner=labelUsable?label!.runner:'UNKNOWN'
    const rejected=selection==='SKIP'||selection==='BLOCKED'
    if(rug==='CONFIRMED_RUG'){
      confirmedRug++
      if(rejected)correctlyRejectedRug++
      if(selection==='MATCH')missedRug++
    }else if(rug==='CONFIRMED_NON_RUG'){
      confirmedNonRug++
      if(rejected)falselyRejectedNonRug++
      if(selection==='MATCH')correctlyRetainedNonRug++
    }else unknownRug++
    if(runner==='VERIFIED_SELLABLE_RUNNER'){
      verifiedRunnerCount++
      if(rejected)missedVerifiedRunners++
    }else if(runner==='UNKNOWN')runnerUnknown++
  }
  const labeled=confirmedRug+confirmedNonRug
  const evidenceStatus=labeled===0?'NO_VERIFIED_HOLDOUT':
    unknownRug>0?'PARTIAL_HOLDOUT_LABELS':'VERIFIED_HOLDOUT_LABELS'
  return Object.freeze({
    presetId:input.presetId,cohort:'HOLDOUT' as const,total:input.cases.length,
    matched,skipped,blocked,review,confirmedRug,confirmedNonRug,unknownRug,
    correctlyRejectedRug,missedRug,falselyRejectedNonRug,correctlyRetainedNonRug,
    rugRejectionRecall:ratio(correctlyRejectedRug,confirmedRug),
    rugRejectionPrecision:ratio(correctlyRejectedRug,correctlyRejectedRug+falselyRejectedNonRug),
    rugFalseRejectionRate:ratio(falselyRejectedNonRug,confirmedNonRug),
    missedVerifiedRunners,verifiedRunnerCount,runnerUnknown,
    evidenceStatus,authority:'OUT_OF_SAMPLE_RESEARCH_ONLY' as const,canAuthorizeTrade:false as const,
  })
}
