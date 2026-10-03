export type CreatorLaunchTriggerPolicy=Readonly<{
  policyId:string
  creatorWalletIds?:readonly string[]
  exactName?:string
  exactTicker?:string
  allowedLaunchpads?:readonly string[]
  minCreatorBuyQuoteRaw?:string
  maxCreatorBuyQuoteRaw?:string
  maxRecentTokensCreated?:number
}>

export type CreatorLaunchTriggerObservation=Readonly<{
  observationId:string
  creatorWalletId?:string
  tokenName?:string
  tokenTicker?:string
  launchpad?:string
  creatorBuyQuoteRaw?:string
  recentTokensCreated?:number
  observedAt:string
  evidenceIds:readonly string[]
}>

export type CreatorLaunchTriggerResult=Readonly<{
  policyId:string
  observationId:string
  disposition:'MATCH'|'REVIEW'|'REJECT'
  matched:readonly string[]
  missing:readonly string[]
  rejected:readonly string[]
  evidenceIds:readonly string[]
  authority:'DISCOVERY_ONLY'
  canAuthorizeTrade:false
}>

const raw=(value:string|undefined,code:string):bigint|undefined=>{
  if(value===undefined)return undefined
  if(!/^[0-9]+$/.test(value))throw new Error(code)
  return BigInt(value)
}
const norm=(value:string|undefined)=>value?.trim().toLowerCase()

export function evaluateCreatorLaunchTrigger(
  policy:CreatorLaunchTriggerPolicy,
  observation:CreatorLaunchTriggerObservation,
):CreatorLaunchTriggerResult{
  if(!policy.policyId.trim()||!observation.observationId.trim()||!observation.evidenceIds.length)throw new Error('creator_launch_trigger_identity_required')
  if(Number.isNaN(Date.parse(observation.observedAt)))throw new Error('creator_launch_trigger_time_invalid')
  if(policy.maxRecentTokensCreated!==undefined&&(!Number.isInteger(policy.maxRecentTokensCreated)||policy.maxRecentTokensCreated<0))throw new Error('creator_launch_trigger_recent_limit_invalid')
  if(observation.recentTokensCreated!==undefined&&(!Number.isInteger(observation.recentTokensCreated)||observation.recentTokensCreated<0))throw new Error('creator_launch_trigger_recent_count_invalid')

  const min=raw(policy.minCreatorBuyQuoteRaw,'creator_launch_trigger_min_buy_invalid')
  const max=raw(policy.maxCreatorBuyQuoteRaw,'creator_launch_trigger_max_buy_invalid')
  const buy=raw(observation.creatorBuyQuoteRaw,'creator_launch_trigger_buy_invalid')
  if(min!==undefined&&max!==undefined&&min>max)throw new Error('creator_launch_trigger_buy_range_invalid')

  const matched:string[]=[]
  const missing:string[]=[]
  const rejected:string[]=[]

  if(policy.creatorWalletIds?.length){
    if(!observation.creatorWalletId)missing.push('creator-wallet')
    else if(policy.creatorWalletIds.map(norm).includes(norm(observation.creatorWalletId)))matched.push('creator-wallet')
    else rejected.push('creator-wallet-not-allowlisted')
  }
  if(policy.exactName!==undefined){
    if(observation.tokenName===undefined)missing.push('token-name')
    else if(observation.tokenName===policy.exactName)matched.push('exact-name')
    else rejected.push('exact-name-mismatch')
  }
  if(policy.exactTicker!==undefined){
    if(observation.tokenTicker===undefined)missing.push('token-ticker')
    else if(observation.tokenTicker===policy.exactTicker)matched.push('exact-ticker')
    else rejected.push('exact-ticker-mismatch')
  }
  if(policy.allowedLaunchpads?.length){
    if(!observation.launchpad)missing.push('launchpad')
    else if(policy.allowedLaunchpads.map(norm).includes(norm(observation.launchpad)))matched.push('launchpad')
    else rejected.push('launchpad-not-allowed')
  }
  if(min!==undefined||max!==undefined){
    if(buy===undefined)missing.push('creator-buy')
    else{
      if(min!==undefined&&buy<min)rejected.push('creator-buy-below-minimum')
      else if(max!==undefined&&buy>max)rejected.push('creator-buy-above-maximum')
      else matched.push('creator-buy-range')
    }
  }
  if(policy.maxRecentTokensCreated!==undefined){
    if(observation.recentTokensCreated===undefined)missing.push('recent-token-count')
    else if(observation.recentTokensCreated>policy.maxRecentTokensCreated)rejected.push('creator-recent-token-count-high')
    else matched.push('recent-token-count')
  }

  const disposition=rejected.length?'REJECT':missing.length?'REVIEW':'MATCH'
  return Object.freeze({
    policyId:policy.policyId,
    observationId:observation.observationId,
    disposition,
    matched:Object.freeze(matched),
    missing:Object.freeze(missing),
    rejected:Object.freeze(rejected),
    evidenceIds:Object.freeze([...new Set(observation.evidenceIds)].sort()),
    authority:'DISCOVERY_ONLY',
    canAuthorizeTrade:false,
  })
}
