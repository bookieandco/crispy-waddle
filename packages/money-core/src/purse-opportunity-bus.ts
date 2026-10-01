import { createHash } from 'node:crypto'
import type { MoneyStrategyLane } from './money-commissioning-contracts.js'
import type { OpportunityCandidateV2 } from './cross-asset-fusion-contracts.js'
import type { JhadinaPurseCharter } from './jhadina-purse-charter.js'
import { assertJhadinaPurseCharter } from './jhadina-purse-charter.js'

export type PurseOpportunityHorizon='INTRADAY'|'SHORT'|'MEDIUM'|'LONG'
export type PurseOpportunityAction='ENTER'|'ADD'|'BET'|'HEDGE'|'HOLD_CASH'
export type PurseOpportunityStatus='ACTIVE'|'EXPIRED'|'BLOCKED'

export type PurseOpportunity=Readonly<{
 opportunityId:string
 sourceId:string
 sourceKind:'CROSS_ASSET'|'SHARK'|'SPORTS'|'FOREX'|'STOCK'|'PREDICTION'|'METALS'|'OTHER'
 lane:MoneyStrategyLane
 strategyId:string
 instrumentId:string
 action:PurseOpportunityAction
 thesis:string
 horizon:PurseOpportunityHorizon
 expectedNetEdgeBps:number
 expectedDownsideBps:number
 confidenceBps:number
 evidenceQualityBps:number
 liquidityBps:number
 minimumCapitalMinor:bigint
 maximumCapitalMinor:bigint
 correlationGroupIds:readonly string[]
 observedAt:string
 availableAt:string
 expiresAt:string
 evidenceIds:readonly string[]
 provenanceHash:string
 authority:'INTELLIGENCE_ONLY'
 canExecute:false
}>

export type PurseOpportunityEnvelope=Readonly<{
 busEventId:string
 charterId:string
 opportunity:PurseOpportunity
 admitted:boolean
 reasonCodes:readonly string[]
 ingestedAt:string
 authority:'OPPORTUNITY_BUS_ONLY'
 canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const bps=(n:number,code:string)=>{if(!Number.isInteger(n)||n<0||n>10000)throw new Error(code)}
const edge=(n:number,code:string)=>{if(!Number.isInteger(n)||n<-10000||n>10000)throw new Error(code)}
const iso=(v:string,code:string)=>{if(Number.isNaN(Date.parse(v)))throw new Error(code)}
const nonEmpty=(v:string,code:string)=>{if(!v.trim())throw new Error(code)}
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())

export function assertPurseOpportunity(o:PurseOpportunity,now?:string):void{
 for(const [v,c] of [
  [o.opportunityId,'PURSE_OPPORTUNITY_ID_REQUIRED'],
  [o.sourceId,'PURSE_OPPORTUNITY_SOURCE_REQUIRED'],
  [o.strategyId,'PURSE_OPPORTUNITY_STRATEGY_REQUIRED'],
  [o.instrumentId,'PURSE_OPPORTUNITY_INSTRUMENT_REQUIRED'],
  [o.thesis,'PURSE_OPPORTUNITY_THESIS_REQUIRED'],
  [o.provenanceHash,'PURSE_OPPORTUNITY_PROVENANCE_REQUIRED'],
 ] as const)nonEmpty(v,c)
 edge(o.expectedNetEdgeBps,'PURSE_OPPORTUNITY_EDGE_INVALID')
 bps(o.expectedDownsideBps,'PURSE_OPPORTUNITY_DOWNSIDE_INVALID')
 bps(o.confidenceBps,'PURSE_OPPORTUNITY_CONFIDENCE_INVALID')
 bps(o.evidenceQualityBps,'PURSE_OPPORTUNITY_EVIDENCE_QUALITY_INVALID')
 bps(o.liquidityBps,'PURSE_OPPORTUNITY_LIQUIDITY_INVALID')
 if(o.minimumCapitalMinor<0n||o.maximumCapitalMinor<=0n||o.minimumCapitalMinor>o.maximumCapitalMinor)throw new Error('PURSE_OPPORTUNITY_CAPITAL_RANGE_INVALID')
 iso(o.observedAt,'PURSE_OPPORTUNITY_OBSERVED_AT_INVALID')
 iso(o.availableAt,'PURSE_OPPORTUNITY_AVAILABLE_AT_INVALID')
 iso(o.expiresAt,'PURSE_OPPORTUNITY_EXPIRES_AT_INVALID')
 if(o.availableAt<o.observedAt||o.expiresAt<=o.availableAt)throw new Error('PURSE_OPPORTUNITY_TIME_ORDER_INVALID')
 if(!o.evidenceIds.length)throw new Error('PURSE_OPPORTUNITY_EVIDENCE_REQUIRED')
 if(o.authority!=='INTELLIGENCE_ONLY'||o.canExecute!==false)throw new Error('PURSE_OPPORTUNITY_AUTHORITY_INVALID')
 if(now){
  iso(now,'PURSE_OPPORTUNITY_NOW_INVALID')
  if(o.availableAt>now)throw new Error('PURSE_OPPORTUNITY_FUTURE_EVIDENCE')
 }
}

export function ingestPurseOpportunity(input:{charter:JhadinaPurseCharter;opportunity:PurseOpportunity;ingestedAt:string}):PurseOpportunityEnvelope{
 assertJhadinaPurseCharter(input.charter,input.ingestedAt)
 assertPurseOpportunity(input.opportunity,input.ingestedAt)
 const reasons:string[]=[]
 const lanePolicy=input.charter.lanePolicies.find(x=>x.lane===input.opportunity.lane)
 if(!lanePolicy||!lanePolicy.enabled)reasons.push('LANE_DISABLED')
 if(input.opportunity.expiresAt<=input.ingestedAt)reasons.push('OPPORTUNITY_EXPIRED')
 if(input.opportunity.confidenceBps<(lanePolicy?.minConfidenceBps??10000))reasons.push('CONFIDENCE_BELOW_LANE_FLOOR')
 if(input.opportunity.expectedNetEdgeBps<=0)reasons.push('NON_POSITIVE_EXPECTED_EDGE')
 if(input.opportunity.evidenceQualityBps<2500)reasons.push('EVIDENCE_QUALITY_TOO_LOW')
 if(input.opportunity.liquidityBps<1000)reasons.push('LIQUIDITY_TOO_LOW')
 const reasonCodes=unique(reasons)
 return Object.freeze({
  busEventId:'purse-opportunity-event:'+hash({charterId:input.charter.charterId,opportunityId:input.opportunity.opportunityId,ingestedAt:input.ingestedAt}),
  charterId:input.charter.charterId,
  opportunity:input.opportunity,
  admitted:reasonCodes.length===0,
  reasonCodes,
  ingestedAt:input.ingestedAt,
  authority:'OPPORTUNITY_BUS_ONLY',
  canExecute:false,
 })
}

function laneFromAssetClass(assetClass:string):MoneyStrategyLane{
 if(assetClass==='STOCK'||assetClass==='OPTION'||assetClass==='FUTURE')return 'STOCK'
 if(assetClass==='FOREX')return 'FOREX'
 if(assetClass==='MEME')return 'MEME'
 if(assetClass==='CRYPTO')return 'CRYPTO'
 if(assetClass==='PREDICTION')return 'PREDICTION'
 if(['XAU','XAG','XPT','XPD'].includes(assetClass))return 'METALS'
 return 'STOCK'
}

export function adaptCrossAssetOpportunity(input:{
 candidate:OpportunityCandidateV2
 strategyId:string
 thesis:string
 minimumCapitalMinor:bigint
 maximumCapitalMinor:bigint
 evidenceQualityBps:number
 liquidityBps:number
 observedAt:string
 sourceKind?:PurseOpportunity['sourceKind']
 correlationGroupIds?:readonly string[]
}):PurseOpportunity{
 const c=input.candidate
 if(c.authority!=='NONE')throw new Error('PURSE_CROSS_ASSET_AUTHORITY_INVALID')
 if(!c.instrumentIds.length||!c.assetClasses.length)throw new Error('PURSE_CROSS_ASSET_INSTRUMENT_REQUIRED')
 const expectedNetEdgeBps=Math.round(c.expectedUpside*10000)
 const expectedDownsideBps=Math.round(Math.abs(c.expectedDownside)*10000)
 const confidenceBps=Math.round(c.confidence*10000)
 const lane=laneFromAssetClass(c.assetClasses[0]!)
 const provenanceHash=hash({
  candidate:c.opportunityId,strategyId:input.strategyId,lane,minimumCapitalMinor:input.minimumCapitalMinor,
  maximumCapitalMinor:input.maximumCapitalMinor,evidenceQualityBps:input.evidenceQualityBps,liquidityBps:input.liquidityBps,
 })
 const out:PurseOpportunity=Object.freeze({
  opportunityId:'purse-opportunity:'+provenanceHash,
  sourceId:c.opportunityId,
  sourceKind:input.sourceKind??'CROSS_ASSET',
  lane,
  strategyId:input.strategyId,
  instrumentId:c.instrumentIds[0]!,
  action:'ENTER',
  thesis:input.thesis,
  horizon:c.horizon,
  expectedNetEdgeBps,
  expectedDownsideBps,
  confidenceBps,
  evidenceQualityBps:input.evidenceQualityBps,
  liquidityBps:input.liquidityBps,
  minimumCapitalMinor:input.minimumCapitalMinor,
  maximumCapitalMinor:input.maximumCapitalMinor,
  correlationGroupIds:unique(input.correlationGroupIds??c.instrumentIds.map(id=>'instrument:'+id)),
  observedAt:input.observedAt,
  availableAt:c.informationCutoff,
  expiresAt:c.expiresAt,
  evidenceIds:unique(c.evidenceIds),
  provenanceHash,
  authority:'INTELLIGENCE_ONLY',
  canExecute:false,
 })
 assertPurseOpportunity(out)
 return out
}
