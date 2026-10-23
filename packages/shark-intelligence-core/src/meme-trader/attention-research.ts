/**
 * SHARK-ATTENTION.01-.03 + .05
 * Public, metadata-only catalyst monitoring. Existing SHARK/Money paths own
 * risk, positions, paper simulation and all financial authority.
 * No provider fetch, Telegram ingress, model calls, scheduler or notifier.
 */
export type PublicAttentionSource='PUBLIC_NEWS'|'PUBLIC_SOCIAL'|'PUBLIC_MARKET'|'PUBLIC_ONCHAIN'
export type AttentionSignal='ARTICLE'|'SOCIAL_POST'|'SOCIAL_METRIC'|'CLAIM_RETRACTED'|
  'COMPETING_CONTRACT'|'PRICE_MOVE'|'VOLUME_SPIKE'|'DEV_SELL'|'WHALE_SELL'|'LIQUIDITY_DROP'

export type PublicAttentionEvidence=Readonly<{
  eventId:string
  mint:string
  source:PublicAttentionSource
  signal:AttentionSignal
  publicOnly:true
  sourceUrl:string
  providerReceiptId:string
  claimId:string
  eventAt:string
  observedAt:string
  availableAt:string
  // No raw text, sender identity, group messages, wallet credentials or model prompts.
  sourceItemId?:string
  views?:number
  priceMoveBps?:number
  severityScore?:number
  competingMint?:string
  competitorMarketCapUsd?:number
  competitorVolumeUsd?:number
}>

export type AttentionConfiguration=Readonly<{
  priceMoveAlertBps:number
  competingMarketCapAlertUsd:number
  competingVolumeAlertUsd:number
  maxEvidenceAgeSeconds:number
}>

export type AttentionResearchAlert=Readonly<{
  id:string
  mint:string
  code:'PRICE_SWING'|'CONTRACT_COMPETITION'|'NARRATIVE_RETRACTED'|
    'ONCHAIN_DISTRIBUTION'|'LIQUIDITY_RISK'
  severity:'WATCH'|'HIGH'
  eventId:string
  sourceUrl:string
  observedAt:string
  researchOnly:true
  canExecute:false
}>

export type AttentionCatalyst=Readonly<{
  claimId:string
  reportedItems:number
  distinctPublicHosts:number
  state:'SINGLE_SOURCE_REPORTED'|'MULTI_HOST_REPORTED'|'RETRACTED'
  latestAvailableAt:string
}>

export type AttentionCompetition=Readonly<{
  mint:string
  largestReportedMarketCapUsd:number
  largestReportedVolumeUsd:number
  evidenceIds:readonly string[]
  status:'UNVERIFIED_MARKET_REPORT'
}>

export type AttentionResearchReport=Readonly<{
  schema:'SHARK_PUBLIC_ATTENTION_V1'
  mint:string
  informationCutoff:string
  evidenceIds:readonly string[]
  catalysts:readonly AttentionCatalyst[]
  competingContracts:readonly AttentionCompetition[]
  viewChanges:readonly Readonly<{sourceItemId:string;earlierViews:number;laterViews:number;elapsedSeconds:number}>[]
  riskSignals:Readonly<{narrativeDegradationScore:number;smartWalletExitScore:number;whaleDistributionScore:number}>
  alerts:readonly AttentionResearchAlert[]
  authority:'RESEARCH_ONLY'
  canExecute:false
  canNotify:false
  evidenceVerification:'PUBLIC_SOURCE_CLAIMS_NOT_INDEPENDENTLY_ATTESTED'
}>

const BASE58=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const KEYSET=new Set(['eventId','mint','source','signal','publicOnly','sourceUrl','providerReceiptId','claimId',
  'eventAt','observedAt','availableAt','sourceItemId','views','priceMoveBps','severityScore',
  'competingMint','competitorMarketCapUsd','competitorVolumeUsd'])
const SOURCES:readonly PublicAttentionSource[]=['PUBLIC_NEWS','PUBLIC_SOCIAL','PUBLIC_MARKET','PUBLIC_ONCHAIN']
const SIGNAL_SOURCE:Readonly<Record<AttentionSignal,readonly PublicAttentionSource[]>>={
  ARTICLE:['PUBLIC_NEWS'],
  SOCIAL_POST:['PUBLIC_SOCIAL'],
  SOCIAL_METRIC:['PUBLIC_SOCIAL'],
  CLAIM_RETRACTED:['PUBLIC_NEWS','PUBLIC_SOCIAL'],
  COMPETING_CONTRACT:['PUBLIC_MARKET','PUBLIC_ONCHAIN'],
  PRICE_MOVE:['PUBLIC_MARKET'],
  VOLUME_SPIKE:['PUBLIC_MARKET','PUBLIC_ONCHAIN'],
  DEV_SELL:['PUBLIC_ONCHAIN'],
  WHALE_SELL:['PUBLIC_ONCHAIN'],
  LIQUIDITY_DROP:['PUBLIC_ONCHAIN'],
}
const isNonempty=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=256
const iso=(value:unknown):number=>{
  if(typeof value!=='string'||!value.endsWith('Z')||!Number.isFinite(Date.parse(value)))
    throw new Error('ATTENTION_INVALID_UTC_TIME')
  return Date.parse(value)
}
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)
const nonnegative=(v:unknown):v is number=>finite(v)&&v>=0
function href(raw:string):{safeUrl:string;host:string}{
  try{
    const u=new URL(raw)
    if(u.protocol!=='https:'||u.username||u.password||u.port||u.hostname==='localhost'||
       u.hostname.endsWith('.local')||/^[0-9.]+$/.test(u.hostname))
      throw new Error('ATTENTION_NONPUBLIC_URL')
    return {safeUrl:u.origin+u.pathname,host:u.hostname.toLowerCase().replace(/^www\./,'')}
  }catch{throw new Error('ATTENTION_NONPUBLIC_URL')}
}
function validate(e:PublicAttentionEvidence,cutoff:number,maxAgeMs:number):{host:string;url:string}{
  if(!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).some(k=>!KEYSET.has(k)))
    throw new Error('ATTENTION_UNKNOWN_OR_PRIVATE_FIELDS')
  if(e.publicOnly!==true||!SOURCES.includes(e.source)||!Object.prototype.hasOwnProperty.call(SIGNAL_SOURCE,e.signal)||
     !SIGNAL_SOURCE[e.signal].includes(e.source))
    throw new Error('ATTENTION_FORBIDDEN_SOURCE')
  if(!BASE58.test(e.mint)||!isNonempty(e.eventId)||!isNonempty(e.claimId)||
     !isNonempty(e.providerReceiptId)||e.providerReceiptId.includes(':secret:'))
    throw new Error('ATTENTION_IDENTITY_INVALID')
  const at=iso(e.eventAt),observed=iso(e.observedAt),available=iso(e.availableAt)
  if(at>observed||observed>available||available>cutoff||cutoff-available>maxAgeMs)
    throw new Error('ATTENTION_LATE_STALE_OR_FUTURE_EVIDENCE')
  if(e.sourceItemId!==undefined&&!isNonempty(e.sourceItemId))
    throw new Error('ATTENTION_ITEM_ID_INVALID')
  if(e.views!==undefined&&(!Number.isSafeInteger(e.views)||e.views<0))
    throw new Error('ATTENTION_VIEWS_INVALID')
  if(e.severityScore!==undefined&&(!finite(e.severityScore)||e.severityScore<0||e.severityScore>1))
    throw new Error('ATTENTION_SEVERITY_INVALID')
  if(e.priceMoveBps!==undefined&&(!finite(e.priceMoveBps)||Math.abs(e.priceMoveBps)>1000000))
    throw new Error('ATTENTION_PRICE_MOVE_INVALID')
  if(e.signal==='PRICE_MOVE'&&e.priceMoveBps===undefined)
    throw new Error('ATTENTION_PRICE_MISSING')
  if(e.signal==='SOCIAL_METRIC'&&(e.views===undefined||!e.sourceItemId))
    throw new Error('ATTENTION_METRIC_MISSING')
  if(e.signal==='COMPETING_CONTRACT'&&(!e.competingMint||!BASE58.test(e.competingMint)||
    e.competingMint===e.mint||!nonnegative(e.competitorMarketCapUsd)||!nonnegative(e.competitorVolumeUsd)))
    throw new Error('ATTENTION_COMPETITOR_INVALID')
  if(e.signal!=='COMPETING_CONTRACT'&&(e.competingMint!==undefined||
    e.competitorMarketCapUsd!==undefined||e.competitorVolumeUsd!==undefined))
    throw new Error('ATTENTION_COMPETITOR_UNRELATED')
  return {host:href(e.sourceUrl).host,url:href(e.sourceUrl).safeUrl}
}
function configCheck(c:AttentionConfiguration):void{
  if(!finite(c.priceMoveAlertBps)||c.priceMoveAlertBps<=0||
     !nonnegative(c.competingMarketCapAlertUsd)||!nonnegative(c.competingVolumeAlertUsd)||
     !finite(c.maxEvidenceAgeSeconds)||c.maxEvidenceAgeSeconds<=0||c.maxEvidenceAgeSeconds>86400)
    throw new Error('ATTENTION_CONFIG_INVALID')
}
/** Pure, fail-closed review of caller-supplied, independently sourced public metadata. */
export function assessPublicAttention(input:Readonly<{
  mint:string
  informationCutoff:string
  observations:readonly PublicAttentionEvidence[]
  config:AttentionConfiguration
}>):AttentionResearchReport{
  if(!BASE58.test(input.mint))throw new Error('ATTENTION_MINT_INVALID')
  const cutoff=iso(input.informationCutoff)
  configCheck(input.config)
  if(!Array.isArray(input.observations)||input.observations.length>2000)
    throw new Error('ATTENTION_BATCH_INVALID')
  const events=new Set<string>()
  const claims=new Map<string,{hosts:Set<string>;count:number;retracted:boolean;latest:string}>()
  const competitors=new Map<string,{marketCap:number;volume:number;ids:string[]}>()
  const metrics=new Map<string,PublicAttentionEvidence[]>()
  const alerts:AttentionResearchAlert[]=[]
  const addAlert=(e:PublicAttentionEvidence,code:AttentionResearchAlert['code'],severity:AttentionResearchAlert['severity'],url:string)=>{
    alerts.push(Object.freeze({id:'attention:'+e.mint+':'+code+':'+e.eventId,mint:e.mint,code,severity,
      eventId:e.eventId,sourceUrl:url,observedAt:e.observedAt,researchOnly:true as const,canExecute:false as const}))
  }
  let narrative=0,smartWallet=0,whale=0
  for(const e of input.observations){
    const {host,url}=validate(e,cutoff,input.config.maxEvidenceAgeSeconds*1000)
    if(e.mint!==input.mint||events.has(e.eventId))throw new Error('ATTENTION_CROSS_MINT_OR_DUPLICATE')
    events.add(e.eventId)
    if(e.signal==='ARTICLE'||e.signal==='SOCIAL_POST'||e.signal==='CLAIM_RETRACTED'){
      const c=claims.get(e.claimId)??{hosts:new Set<string>(),count:0,retracted:false,latest:e.availableAt}
      c.count++;c.hosts.add(host);c.retracted ||=e.signal==='CLAIM_RETRACTED'
      if(e.availableAt>c.latest)c.latest=e.availableAt
      claims.set(e.claimId,c)
    }
    if(e.signal==='CLAIM_RETRACTED'){
      narrative=Math.max(narrative,.9)
      addAlert(e,'NARRATIVE_RETRACTED','HIGH',url)
    }
    if(e.signal==='SOCIAL_METRIC'){
      const a=metrics.get(e.sourceItemId!)??[]
      a.push(e);metrics.set(e.sourceItemId!,a)
    }
    if(e.signal==='COMPETING_CONTRACT'){
      const mint=e.competingMint!
      const comp=competitors.get(mint)??{marketCap:0,volume:0,ids:[]}
      comp.marketCap=Math.max(comp.marketCap,e.competitorMarketCapUsd!)
      comp.volume=Math.max(comp.volume,e.competitorVolumeUsd!)
      comp.ids.push(e.eventId)
      competitors.set(mint,comp)
      if(e.competitorMarketCapUsd!>=input.config.competingMarketCapAlertUsd&&
         e.competitorVolumeUsd!>=input.config.competingVolumeAlertUsd)
        addAlert(e,'CONTRACT_COMPETITION','WATCH',url)
    }
    if(e.signal==='PRICE_MOVE'&&Math.abs(e.priceMoveBps!)>=input.config.priceMoveAlertBps)
      addAlert(e,'PRICE_SWING','WATCH',url)
    if(e.signal==='DEV_SELL'||e.signal==='WHALE_SELL'){
      // Conservative negative evidence only. Never boosts a candidate or authorizes a trade.
      const risk=e.severityScore??.7
      whale=Math.max(whale,risk)
      smartWallet=Math.max(smartWallet,risk)
      addAlert(e,'ONCHAIN_DISTRIBUTION',risk>=.9?'HIGH':'WATCH',url)
    }
    if(e.signal==='LIQUIDITY_DROP')
      addAlert(e,'LIQUIDITY_RISK',(e.severityScore??.7)>=.9?'HIGH':'WATCH',url)
  }
  const viewChanges:Array<{sourceItemId:string;earlierViews:number;laterViews:number;elapsedSeconds:number}>=[]
  for(const [sourceItemId,arr] of metrics){
    const sorted=[...arr].sort((a,b)=>iso(a.availableAt)-iso(b.availableAt))
    if(sorted.length>=2){
      const a=sorted[0],b=sorted[sorted.length-1],elapsed=(iso(b.availableAt)-iso(a.availableAt))/1000
      if(elapsed>0&&b.views!>=a.views!)
        viewChanges.push({sourceItemId,earlierViews:a.views!,laterViews:b.views!,elapsedSeconds:elapsed})
    }
  }
  return Object.freeze({
    schema:'SHARK_PUBLIC_ATTENTION_V1' as const,mint:input.mint,informationCutoff:input.informationCutoff,
    evidenceIds:Object.freeze([...events].sort()),
    catalysts:Object.freeze([...claims.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([claimId,c])=>Object.freeze({
      claimId,reportedItems:c.count,distinctPublicHosts:c.hosts.size,
      state:c.retracted?'RETRACTED' as const:c.hosts.size>=2?'MULTI_HOST_REPORTED' as const:'SINGLE_SOURCE_REPORTED' as const,
      latestAvailableAt:c.latest,
    }))),
    competingContracts:Object.freeze([...competitors.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([mint,c])=>Object.freeze({
      mint,largestReportedMarketCapUsd:c.marketCap,largestReportedVolumeUsd:c.volume,
      evidenceIds:Object.freeze([...c.ids].sort()),status:'UNVERIFIED_MARKET_REPORT' as const,
    }))),
    viewChanges:Object.freeze(viewChanges.sort((a,b)=>a.sourceItemId.localeCompare(b.sourceItemId))),
    riskSignals:Object.freeze({narrativeDegradationScore:narrative,smartWalletExitScore:smartWallet,whaleDistributionScore:whale}),
    alerts:Object.freeze(alerts.sort((a,b)=>a.id.localeCompare(b.id))),
    authority:'RESEARCH_ONLY' as const,canExecute:false as const,canNotify:false as const,
    evidenceVerification:'PUBLIC_SOURCE_CLAIMS_NOT_INDEPENDENTLY_ATTESTED' as const,
  })
}
