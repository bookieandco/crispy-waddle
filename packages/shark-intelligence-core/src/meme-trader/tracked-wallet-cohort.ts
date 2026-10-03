export type TrackedWalletBehaviorStyle=
  |'NARRATIVE'
  |'SCALPER'
  |'NEW_PAIR'
  |'FARMER_DEV'
  |'BUNDLE_CLUSTER'
  |'SIDE_WALLET'
  |'UNKNOWN'

export type TrackedWalletCohortObservation=Readonly<{
  evidenceId:string
  walletId:string
  tokenAddress:string
  side:'BUY'|'SELL'
  observedAt:string
  availableAt:string
  style?:TrackedWalletBehaviorStyle
  historicalQualityScore?:number
  historicalSampleSize?:number
  controlGroupId?:string
  publicVisibilityScore?:number
  profileFreshnessScore?:number
}>

export type TrackedWalletCohortThresholds=Readonly<{
  minIndependentBuyerGroups?:number
  minIndependenceRatio?:number
  minMeanHistoricalQuality?:number
  maxScalperBuyerShare?:number
  maxAdverseActorBuyerShare?:number
  maxPublicCrowdingScore?:number
  maxSellerPressure?:number
}>

export type TrackedWalletCohortSummary=Readonly<{
  tokenAddress:string
  informationCutoff:string
  rawObservationCount:number
  distinctWalletCount:number
  controlGroupCount:number
  independentBuyerGroups:number
  independentSellerGroups:number
  independenceRatio:number
  narrativeBuyerShare:number
  scalperBuyerShare:number
  adverseActorBuyerShare:number
  sideWalletBuyerShare:number
  sellerPressure:number
  meanHistoricalQuality?:number
  qualityCoverage:number
  publicCrowdingScore?:number
  freshnessCoverage:number
  meanProfileFreshness?:number
  failedRules:readonly string[]
  evaluatedThresholdCount:number
  calibratedSupportScore?:number
  evidenceIds:readonly string[]
  authority:'RESEARCH_EVIDENCE_ONLY'
  canAutoCopy:false
  canAuthorizeTrade:false
  canInferNaturalPersonIdentity:false
}>

const unit=(value:number|undefined,code:string)=>{
  if(value!==undefined&&(!Number.isFinite(value)||value<0||value>1))throw new Error(code)
}
const iso=(value:string,code:string)=>{if(!value||Number.isNaN(Date.parse(value)))throw new Error(code)}
const unique=<T>(values:readonly T[])=>[...new Set(values)]

const groupKey=(o:TrackedWalletCohortObservation)=>o.controlGroupId?.trim()?'group:'+o.controlGroupId.trim():'wallet:'+o.walletId
const style=(o:TrackedWalletCohortObservation)=>o.style??'UNKNOWN'
const share=(count:number,total:number)=>total?count/total:0
const mean=(values:readonly number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:undefined

/**
 * Descriptive tracked-wallet cohort intelligence.
 *
 * Multiple watched wallets are not automatically independent confirmation:
 * common-control groups are deduplicated and public/crowded/scalper/farmer
 * behavior is surfaced separately. Numeric decision thresholds are optional
 * calibration inputs rather than source-derived trading rules.
 */
export function summarizeTrackedWalletCohort(input:Readonly<{
  tokenAddress:string
  observations:readonly TrackedWalletCohortObservation[]
  informationCutoff:string
  thresholds?:TrackedWalletCohortThresholds
}>):TrackedWalletCohortSummary{
  if(!input.tokenAddress.trim())throw new Error('tracked_wallet_cohort_token_required')
  iso(input.informationCutoff,'tracked_wallet_cohort_cutoff_invalid')
  for(const observation of input.observations){
    if(!observation.evidenceId.trim()||!observation.walletId.trim()||!observation.tokenAddress.trim())throw new Error('tracked_wallet_cohort_identity_required')
    if(observation.tokenAddress!==input.tokenAddress)throw new Error('tracked_wallet_cohort_token_mismatch')
    iso(observation.observedAt,'tracked_wallet_cohort_observed_at_invalid')
    iso(observation.availableAt,'tracked_wallet_cohort_available_at_invalid')
    if(Date.parse(observation.availableAt)<Date.parse(observation.observedAt))throw new Error('tracked_wallet_cohort_availability_invalid')
    unit(observation.historicalQualityScore,'tracked_wallet_cohort_quality_invalid')
    unit(observation.publicVisibilityScore,'tracked_wallet_cohort_visibility_invalid')
    unit(observation.profileFreshnessScore,'tracked_wallet_cohort_freshness_invalid')
    if(observation.historicalSampleSize!==undefined&&(!Number.isInteger(observation.historicalSampleSize)||observation.historicalSampleSize<0))throw new Error('tracked_wallet_cohort_sample_invalid')
  }

  const eligible=input.observations.filter(o=>Date.parse(o.availableAt)<=Date.parse(input.informationCutoff))
  const distinctWallets=unique(eligible.map(o=>o.walletId))
  const groups=unique(eligible.map(groupKey))
  const buyers=eligible.filter(o=>o.side==='BUY')
  const sellers=eligible.filter(o=>o.side==='SELL')
  const buyerGroups=unique(buyers.map(groupKey))
  const sellerGroups=unique(sellers.map(groupKey))
  const buyerGroupRepresentative=buyerGroups.map(key=>{
    const rows=buyers.filter(o=>groupKey(o)===key)
    return rows.sort((a,b)=>Date.parse(a.availableAt)-Date.parse(b.availableAt))[0]!
  })

  const narrativeBuyers=buyerGroupRepresentative.filter(o=>style(o)==='NARRATIVE').length
  const scalperBuyers=buyerGroupRepresentative.filter(o=>style(o)==='SCALPER'||style(o)==='NEW_PAIR').length
  const adverseBuyers=buyerGroupRepresentative.filter(o=>style(o)==='FARMER_DEV'||style(o)==='BUNDLE_CLUSTER').length
  const sideWalletBuyers=buyerGroupRepresentative.filter(o=>style(o)==='SIDE_WALLET').length

  const qualityRows=buyerGroupRepresentative.filter(o=>o.historicalQualityScore!==undefined&&o.historicalSampleSize!==0)
  const weightedQuality=qualityRows.map(o=>{
    const sampleWeight=o.historicalSampleSize===undefined?1:Math.min(1,Math.sqrt(o.historicalSampleSize/25))
    const freshness=o.profileFreshnessScore??1
    return {value:o.historicalQualityScore!,weight:sampleWeight*freshness}
  })
  const weightTotal=weightedQuality.reduce((sum,row)=>sum+row.weight,0)
  const meanHistoricalQuality=weightTotal?weightedQuality.reduce((sum,row)=>sum+row.value*row.weight,0)/weightTotal:undefined

  const visible=buyerGroupRepresentative.flatMap(o=>o.publicVisibilityScore===undefined?[]:[o.publicVisibilityScore])
  const freshness=buyerGroupRepresentative.flatMap(o=>o.profileFreshnessScore===undefined?[]:[o.profileFreshnessScore])
  const publicCrowdingScore=mean(visible)
  const meanProfileFreshness=mean(freshness)
  const independenceRatio=share(groups.length,Math.max(1,distinctWallets.length))
  const sellerPressure=share(sellerGroups.length,buyerGroups.length+sellerGroups.length)

  const thresholds=input.thresholds
  if(thresholds){
    if(thresholds.minIndependentBuyerGroups!==undefined&&(!Number.isInteger(thresholds.minIndependentBuyerGroups)||thresholds.minIndependentBuyerGroups<1))throw new Error('tracked_wallet_cohort_threshold_invalid')
    for(const [key,value] of Object.entries(thresholds)){
      if(value===undefined||key==='minIndependentBuyerGroups')continue
      unit(value,'tracked_wallet_cohort_threshold_invalid')
    }
  }

  const failedRules:string[]=[]
  let evaluatedThresholdCount=0
  const evaluate=(configured:boolean,covered:boolean,passed:boolean,rule:string)=>{
    if(!configured||!covered)return
    evaluatedThresholdCount++
    if(!passed)failedRules.push(rule)
  }
  evaluate(thresholds?.minIndependentBuyerGroups!==undefined,true,buyerGroups.length>=(thresholds?.minIndependentBuyerGroups??0),'independent-buyer-groups-below-calibrated-floor')
  evaluate(thresholds?.minIndependenceRatio!==undefined,true,independenceRatio>=(thresholds?.minIndependenceRatio??0),'independence-ratio-below-calibrated-floor')
  evaluate(thresholds?.minMeanHistoricalQuality!==undefined,meanHistoricalQuality!==undefined,meanHistoricalQuality!==undefined&&meanHistoricalQuality>=(thresholds?.minMeanHistoricalQuality??0),'historical-quality-below-calibrated-floor')
  evaluate(thresholds?.maxScalperBuyerShare!==undefined,true,share(scalperBuyers,buyerGroups.length)<=(thresholds?.maxScalperBuyerShare??1),'scalper-share-above-calibrated-ceiling')
  evaluate(thresholds?.maxAdverseActorBuyerShare!==undefined,true,share(adverseBuyers,buyerGroups.length)<=(thresholds?.maxAdverseActorBuyerShare??1),'adverse-actor-share-above-calibrated-ceiling')
  evaluate(thresholds?.maxPublicCrowdingScore!==undefined,publicCrowdingScore!==undefined,publicCrowdingScore!==undefined&&publicCrowdingScore<=(thresholds?.maxPublicCrowdingScore??1),'public-crowding-above-calibrated-ceiling')
  evaluate(thresholds?.maxSellerPressure!==undefined,true,sellerPressure<=(thresholds?.maxSellerPressure??1),'seller-pressure-above-calibrated-ceiling')
  const calibratedSupportScore=evaluatedThresholdCount?(evaluatedThresholdCount-failedRules.length)/evaluatedThresholdCount:undefined

  return Object.freeze({
    tokenAddress:input.tokenAddress,
    informationCutoff:input.informationCutoff,
    rawObservationCount:eligible.length,
    distinctWalletCount:distinctWallets.length,
    controlGroupCount:groups.length,
    independentBuyerGroups:buyerGroups.length,
    independentSellerGroups:sellerGroups.length,
    independenceRatio,
    narrativeBuyerShare:share(narrativeBuyers,buyerGroups.length),
    scalperBuyerShare:share(scalperBuyers,buyerGroups.length),
    adverseActorBuyerShare:share(adverseBuyers,buyerGroups.length),
    sideWalletBuyerShare:share(sideWalletBuyers,buyerGroups.length),
    sellerPressure,
    meanHistoricalQuality,
    qualityCoverage:share(qualityRows.length,buyerGroups.length),
    publicCrowdingScore,
    freshnessCoverage:share(freshness.length,buyerGroups.length),
    meanProfileFreshness,
    failedRules:Object.freeze(failedRules),
    evaluatedThresholdCount,
    calibratedSupportScore,
    evidenceIds:Object.freeze(unique(eligible.map(o=>o.evidenceId)).sort()),
    authority:'RESEARCH_EVIDENCE_ONLY',
    canAutoCopy:false,
    canAuthorizeTrade:false,
    canInferNaturalPersonIdentity:false,
  })
}
