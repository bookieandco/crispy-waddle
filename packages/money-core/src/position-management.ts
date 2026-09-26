import { createHash } from 'node:crypto'
import type { MoneyAlphaDomain, CrossDomainAlphaRoute } from './cross-domain-alpha-router.js'

export type PositionSide='LONG'|'SHORT'|'YES'|'NO'
export type PositionAction='ADD'|'HOLD'|'TRIM'|'EXIT'|'HEDGE'|'ROTATE'
export type PositionAutomationMode='MANUAL_ADVISORY'|'PAPER_AUTOMATED'|'SHADOW_AUTOMATED'|'LIVE_AUTONOMOUS_GOVERNED'

export type OpenPositionSnapshot=Readonly<{
  positionId:string
  domain:MoneyAlphaDomain
  instrumentId:string
  side:PositionSide
  quantity:number
  entryPrice:number
  currentExecutableExitPrice:number
  currentExecutableAddPrice:number
  unrealizedPnlMinor:bigint
  peakUnrealizedPnlMinor:bigint
  grossExposureMinor:bigint
  currency:string
  openedAt:string
  observedAt:string
  evidenceIds:readonly string[]
  authority:'EVIDENCE_ONLY'
}>

export type PositionMarketAssessment=Readonly<{
  fairProbability?:number
  marketImpliedProbability?:number
  edgeAfterCostsBps:number
  thesisStrengthBps:number
  invalidationRiskBps:number
  liquidityQualityBps:number
  momentumBps:number
  correlationRiskBps:number
  bestAlternativeEdgeBps?:number
  bestAlternativeInstrumentId?:string
  alphaRoutes:readonly CrossDomainAlphaRoute[]
  evidenceIds:readonly string[]
  assessedAt:string
  authority:'INTELLIGENCE_ONLY'
  canExecute:false
}>

export type PositionManagementPolicy=Readonly<{
  minAddEdgeBps:number
  minHoldEdgeBps:number
  minThesisStrengthBps:number
  minLiquidityBps:number
  maxRiskBps:number
  maxCorrelationRiskBps:number
  maxGivebackFromPeakBps:number
  rotateAdvantageBps:number
  automationMode:PositionAutomationMode
}>

export type PositionManagementDecision=Readonly<{
  decisionId:string
  positionId:string
  domain:MoneyAlphaDomain
  instrumentId:string
  action:PositionAction
  automationDisposition:'ADVISORY_ONLY'|'PAPER_ACTION_CANDIDATE'|'SHADOW_ACTION_CANDIDATE'|'LIVE_INTENT_CANDIDATE'
  winning:boolean
  edgeAfterCostsBps:number
  pros:readonly string[]
  cons:readonly string[]
  reasonCodes:readonly string[]
  alphaRouteIds:readonly string[]
  alternativeInstrumentId?:string
  evaluatedAt:string
  authority:'INTELLIGENCE_ONLY'
  financialAuthority:'NONE'
  requiresDownstreamRiskAndAuthority:true
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const bps=(n:number,c:string)=>{if(!Number.isInteger(n)||n<0||n>10000)throw new Error(c)}
const finitePositive=(n:number,c:string)=>{if(!Number.isFinite(n)||n<=0)throw new Error(c)}
const nonEmpty=(v:string,c:string)=>{if(!v.trim())throw new Error(c)}
const iso=(v:string,c:string)=>{nonEmpty(v,c);if(Number.isNaN(Date.parse(v)))throw new Error(c)}
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())

function assertProbability(v:number|undefined,c:string){if(v!==undefined&&(!Number.isFinite(v)||v<0||v>1))throw new Error(c)}

export function assertOpenPositionSnapshot(p:OpenPositionSnapshot):void{
  nonEmpty(p.positionId,'MONEY_POSITION_ID_REQUIRED')
  nonEmpty(p.instrumentId,'MONEY_POSITION_INSTRUMENT_REQUIRED')
  nonEmpty(p.currency,'MONEY_POSITION_CURRENCY_REQUIRED')
  finitePositive(p.quantity,'MONEY_POSITION_QUANTITY_INVALID')
  finitePositive(p.entryPrice,'MONEY_POSITION_ENTRY_PRICE_INVALID')
  finitePositive(p.currentExecutableExitPrice,'MONEY_POSITION_EXIT_PRICE_INVALID')
  finitePositive(p.currentExecutableAddPrice,'MONEY_POSITION_ADD_PRICE_INVALID')
  if(p.grossExposureMinor<0n)throw new Error('MONEY_POSITION_EXPOSURE_INVALID')
  iso(p.openedAt,'MONEY_POSITION_OPENED_AT_INVALID')
  iso(p.observedAt,'MONEY_POSITION_OBSERVED_AT_INVALID')
  if(p.observedAt<p.openedAt)throw new Error('MONEY_POSITION_OBSERVED_BEFORE_OPEN')
  if(!p.evidenceIds.length)throw new Error('MONEY_POSITION_EVIDENCE_REQUIRED')
  if(p.authority!=='EVIDENCE_ONLY')throw new Error('MONEY_POSITION_AUTHORITY_INVALID')
}

export function assertPositionMarketAssessment(a:PositionMarketAssessment):void{
  assertProbability(a.fairProbability,'MONEY_POSITION_FAIR_PROBABILITY_INVALID')
  assertProbability(a.marketImpliedProbability,'MONEY_POSITION_MARKET_PROBABILITY_INVALID')
  if(!Number.isInteger(a.edgeAfterCostsBps)||a.edgeAfterCostsBps<-10000||a.edgeAfterCostsBps>10000)throw new Error('MONEY_POSITION_EDGE_INVALID')
  for(const [v,c] of [
    [a.thesisStrengthBps,'MONEY_POSITION_THESIS_INVALID'],
    [a.invalidationRiskBps,'MONEY_POSITION_INVALIDATION_INVALID'],
    [a.liquidityQualityBps,'MONEY_POSITION_LIQUIDITY_INVALID'],
    [a.momentumBps,'MONEY_POSITION_MOMENTUM_INVALID'],
    [a.correlationRiskBps,'MONEY_POSITION_CORRELATION_INVALID'],
  ] as const)bps(v,c)
  if(a.bestAlternativeEdgeBps!==undefined&&(!Number.isInteger(a.bestAlternativeEdgeBps)||a.bestAlternativeEdgeBps<-10000||a.bestAlternativeEdgeBps>10000))throw new Error('MONEY_POSITION_ALT_EDGE_INVALID')
  iso(a.assessedAt,'MONEY_POSITION_ASSESSED_AT_INVALID')
  if(!a.evidenceIds.length)throw new Error('MONEY_POSITION_ASSESSMENT_EVIDENCE_REQUIRED')
  if(a.authority!=='INTELLIGENCE_ONLY'||a.canExecute!==false)throw new Error('MONEY_POSITION_ASSESSMENT_AUTHORITY_INVALID')
  for(const route of a.alphaRoutes){
    if(route.authority!=='INTELLIGENCE_ONLY'||route.canExecute!==false||route.targetTruthClaim!==false)throw new Error('MONEY_POSITION_ALPHA_AUTHORITY_INVALID')
  }
}

export function defaultPositionManagementPolicy(mode:PositionAutomationMode='MANUAL_ADVISORY'):PositionManagementPolicy{
  return Object.freeze({
    minAddEdgeBps:350,
    minHoldEdgeBps:75,
    minThesisStrengthBps:6500,
    minLiquidityBps:5000,
    maxRiskBps:7000,
    maxCorrelationRiskBps:6500,
    maxGivebackFromPeakBps:3000,
    rotateAdvantageBps:300,
    automationMode:mode,
  })
}

function automationDisposition(mode:PositionAutomationMode):PositionManagementDecision['automationDisposition']{
  if(mode==='PAPER_AUTOMATED')return 'PAPER_ACTION_CANDIDATE'
  if(mode==='SHADOW_AUTOMATED')return 'SHADOW_ACTION_CANDIDATE'
  if(mode==='LIVE_AUTONOMOUS_GOVERNED')return 'LIVE_INTENT_CANDIDATE'
  return 'ADVISORY_ONLY'
}

export function evaluateOpenPosition(input:{
  position:OpenPositionSnapshot
  assessment:PositionMarketAssessment
  policy?:PositionManagementPolicy
  evaluatedAt:string
}):PositionManagementDecision{
  const p=input.position,a=input.assessment,policy=input.policy??defaultPositionManagementPolicy()
  assertOpenPositionSnapshot(p);assertPositionMarketAssessment(a);iso(input.evaluatedAt,'MONEY_POSITION_EVALUATED_AT_INVALID')
  if(a.assessedAt>input.evaluatedAt||p.observedAt>input.evaluatedAt)throw new Error('MONEY_POSITION_FUTURE_LEAK')
  if(a.alphaRoutes.some(r=>r.targetInstrumentId!==p.instrumentId))throw new Error('MONEY_POSITION_ALPHA_TARGET_MISMATCH')
  for(const [v,c] of [
    [policy.minThesisStrengthBps,'MONEY_POSITION_POLICY_THESIS_INVALID'],
    [policy.minLiquidityBps,'MONEY_POSITION_POLICY_LIQUIDITY_INVALID'],
    [policy.maxRiskBps,'MONEY_POSITION_POLICY_RISK_INVALID'],
    [policy.maxCorrelationRiskBps,'MONEY_POSITION_POLICY_CORRELATION_INVALID'],
    [policy.maxGivebackFromPeakBps,'MONEY_POSITION_POLICY_GIVEBACK_INVALID'],
  ] as const)bps(v,c)
  if(!Number.isInteger(policy.minAddEdgeBps)||!Number.isInteger(policy.minHoldEdgeBps)||!Number.isInteger(policy.rotateAdvantageBps))throw new Error('MONEY_POSITION_POLICY_EDGE_INVALID')

  const winning=p.unrealizedPnlMinor>0n
  const pros:string[]=[]
  const cons:string[]=[]
  const reasons:string[]=[]

  if(winning)pros.push('Position is currently profitable at the executable exit price.')
  else cons.push('Position is not currently profitable.')
  if(a.edgeAfterCostsBps>=policy.minAddEdgeBps)pros.push('Fresh after-cost edge remains above the add threshold.')
  else if(a.edgeAfterCostsBps>=policy.minHoldEdgeBps)pros.push('Fresh after-cost edge remains positive enough to hold.')
  else cons.push('Fresh after-cost edge no longer clears the hold threshold.')
  if(a.thesisStrengthBps>=policy.minThesisStrengthBps)pros.push('Current evidence still supports the thesis.')
  else cons.push('Thesis strength is below the configured continuation threshold.')
  if(a.liquidityQualityBps>=policy.minLiquidityBps)pros.push('Liquidity is adequate for position management.')
  else cons.push('Liquidity quality is weak; exit/add assumptions may not be executable.')
  if(a.correlationRiskBps>policy.maxCorrelationRiskBps)cons.push('Correlated exposure is above the configured concentration limit.')
  if(a.invalidationRiskBps>=policy.maxRiskBps)cons.push('Invalidation/risk evidence is above the configured limit.')
  if(a.alphaRoutes.length)pros.push(`${a.alphaRoutes.length} governed alpha route(s) contribute reusable evidence.`)

  let action:PositionAction='HOLD'
  if(a.invalidationRiskBps>=9000||a.edgeAfterCostsBps<=-500){
    action='EXIT';reasons.push('THESIS_OR_EDGE_INVALIDATED')
  }else if(a.correlationRiskBps>policy.maxCorrelationRiskBps&&a.edgeAfterCostsBps>=policy.minHoldEdgeBps){
    action='HEDGE';reasons.push('CORRELATED_RISK_REQUIRES_OFFSET')
  }else if(
    a.bestAlternativeEdgeBps!==undefined&&a.bestAlternativeInstrumentId&&
    a.bestAlternativeEdgeBps-a.edgeAfterCostsBps>=policy.rotateAdvantageBps&&
    a.edgeAfterCostsBps<policy.minAddEdgeBps
  ){
    action='ROTATE';reasons.push('ALTERNATIVE_HAS_MATERIAL_EDGE_ADVANTAGE')
  }else if(
    a.edgeAfterCostsBps>=policy.minAddEdgeBps&&
    a.thesisStrengthBps>=policy.minThesisStrengthBps&&
    a.liquidityQualityBps>=policy.minLiquidityBps&&
    a.invalidationRiskBps<policy.maxRiskBps&&
    a.correlationRiskBps<=policy.maxCorrelationRiskBps
  ){
    action='ADD';reasons.push(winning?'WINNING_POSITION_STILL_HAS_INCREMENTAL_EDGE':'POSITION_HAS_INCREMENTAL_EDGE')
  }else if(winning&&a.edgeAfterCostsBps<policy.minHoldEdgeBps){
    action='TRIM';reasons.push('LOCK_PROFIT_WHILE_INCREMENTAL_EDGE_IS_WEAK')
  }else if(a.invalidationRiskBps>=policy.maxRiskBps||a.liquidityQualityBps<policy.minLiquidityBps){
    action='TRIM';reasons.push('RISK_OR_LIQUIDITY_DEGRADED')
  }else{
    reasons.push('HOLD_CURRENT_EXPOSURE')
  }

  const peak=p.peakUnrealizedPnlMinor>0n?p.peakUnrealizedPnlMinor:0n
  if(winning&&peak>0n&&p.unrealizedPnlMinor<peak){
    const givebackBps=Number(((peak-p.unrealizedPnlMinor)*10000n)/peak)
    if(givebackBps>=policy.maxGivebackFromPeakBps&&action==='HOLD'){
      action='TRIM';reasons.push('PROFIT_GIVEBACK_LIMIT_REACHED');cons.push('A material share of peak unrealized profit has been given back.')
    }
  }

  return Object.freeze({
    decisionId:'money-position-review:'+hash({positionId:p.positionId,assessment:a,evaluatedAt:input.evaluatedAt,policy}),
    positionId:p.positionId,
    domain:p.domain,
    instrumentId:p.instrumentId,
    action,
    automationDisposition:automationDisposition(policy.automationMode),
    winning,
    edgeAfterCostsBps:a.edgeAfterCostsBps,
    pros:Object.freeze(pros),
    cons:Object.freeze(cons),
    reasonCodes:unique(reasons),
    alphaRouteIds:unique(a.alphaRoutes.map(r=>r.routeId)),
    alternativeInstrumentId:action==='ROTATE'?a.bestAlternativeInstrumentId:undefined,
    evaluatedAt:input.evaluatedAt,
    authority:'INTELLIGENCE_ONLY',
    financialAuthority:'NONE',
    requiresDownstreamRiskAndAuthority:true,
    canExecute:false,
  })
}
