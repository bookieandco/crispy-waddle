import type { ActionRequest } from '@jhadina/action-core'
import type { MoneyActionCoreAuthority } from './action-core-authority-bridge.js'

export type AutonomousTradingMode='DISABLED'|'PAPER'|'SHADOW'|'LIVE_AUTONOMOUS'
export type AutonomousMandateStatus='ACTIVE'|'REVOKED'|'EXPIRED'

export type AutonomousMandateLimits=Readonly<{
  maxOrderNotionalMinor:bigint
  maxDailySubmittedNotionalMinor:bigint
  maxDailyOrders:number
  maxDailyRealizedLossMinor:bigint
  maxGrossExposureMinor:bigint
  maxDrawdownBps:number
  maxLeverageBps:number
  minModelConfidenceBps:number
}>

export type AutonomousMandateActivationAction=Readonly<{
  capability:'money.autonomous.mandate.activate'
  provider:string
  accountId:string
  currency:string
  mode:'LIVE_AUTONOMOUS'
  allowedInstrumentPrefixes:readonly string[]
  allowedStrategyIds:readonly string[]
  maxOrderNotionalMinor:string
  maxDailySubmittedNotionalMinor:string
  maxDailyOrders:number
  maxDailyRealizedLossMinor:string
  maxGrossExposureMinor:string
  maxDrawdownBps:number
  maxLeverageBps:number
  minModelConfidenceBps:number
  allowOpeningShorts:boolean
  startsAt:string
  expiresAt:string
}>

export type AutonomousMandateActivationRequest=ActionRequest<AutonomousMandateActivationAction>

export type AutonomousTradingMandate=Readonly<{
  mandateId:string
  userId:string
  provider:string
  accountId:string
  currency:string
  mode:'LIVE_AUTONOMOUS'
  allowedInstrumentPrefixes:readonly string[]
  allowedStrategyIds:readonly string[]
  allowOpeningShorts:boolean
  limits:AutonomousMandateLimits
  startsAt:string
  expiresAt:string
  approvalReceiptId:string
  actionCoreAuthorityId:string
  policyVersion:string
  policyHash:string
  evidenceIds:readonly string[]
  status:AutonomousMandateStatus
  activatedAt:string
  revokedAt?:string
  authority:'USER_APPROVED_MANDATE'
  canAuthorizeTrade:false
}>

export interface AutonomousTradingMandateStore{
  put(mandate:AutonomousTradingMandate):Promise<void>|void
  get(mandateId:string):Promise<AutonomousTradingMandate|undefined>|AutonomousTradingMandate|undefined
  findActive(input:{userId:string;provider:string;accountId:string;now:string}):Promise<AutonomousTradingMandate|undefined>|AutonomousTradingMandate|undefined
  revoke(mandateId:string,revokedAt:string):Promise<void>|void
}

export type AutonomousTradeIntent=Readonly<{
  intentId:string
  mandateId:string
  strategyId:string
  instrumentId:string
  side:'BUY'|'SELL'
  opensShort:boolean
  notionalMinor:bigint
  currency:string
  limitPriceMinor:bigint
  modelConfidenceBps:number
  opportunityId:string
  allocationDecisionId:string
  executionPlanId:string
  preflightId:string
  evidenceIds:readonly string[]
  decidedAt:string
  authority:'INTELLIGENCE_ONLY'
  canExecute:false
}>

export type AutonomousRiskSnapshot=Readonly<{
  snapshotId:string
  provider:string
  accountId:string
  currency:string
  grossExposureMinor:bigint
  realizedPnlMinor:bigint
  drawdownBps:number
  leverageBps:number
  unresolvedExecutions:number
  observedAt:string
  availableAt:string
  evidenceIds:readonly string[]
  authority:'EVIDENCE_ONLY'
}>

export type AutonomousRiskDecision=Readonly<{
  riskDecisionId:string
  mandateId:string
  intentId:string
  allowed:boolean
  reasonCodes:readonly string[]
  snapshotId:string
  evaluatedAt:string
  authority:'RISK_VETO_ONLY'
  canAuthorizeTrade:false
}>

export type AutonomousTradeAction=Readonly<{
  capability:'money.trade.submit'
  provider:string
  accountId:string
  instrumentId:string
  side:'BUY'|'SELL'
  notionalMinor:string
  currency:string
  executionPlanId:string
  preflightId:string
  mandateId:string
  strategyId:string
}>

export type AutonomousTradeActionRequest=ActionRequest<AutonomousTradeAction>

export type AutonomousTradeAuthorityProof=Readonly<{
  request:AutonomousTradeActionRequest
  authority:MoneyActionCoreAuthority
  mandateId:string
  strategyId:string
  riskDecisionId:string
  allocationDecisionId:string
  mode:'LIVE_AUTONOMOUS'
  autonomous:true
}>

export type AutonomousCertificationCase=Readonly<{name:string;passed:boolean;evidenceIds:readonly string[]}>
export type AutonomousCertificationReport=Readonly<{
  reportId:string
  cases:readonly AutonomousCertificationCase[]
  passed:boolean
  mode:'LIVE_AUTONOMOUS'
  authority:'CERTIFICATION_ONLY'
  autonomousTradingEnabled:true
  hardRiskLimitsMutableByModel:false
}>

const bps=(n:number,code:string)=>{if(!Number.isInteger(n)||n<0||n>10000)throw new Error(code)}
const positive=(n:bigint,code:string)=>{if(n<=0n)throw new Error(code)}
const nonEmpty=(s:string,code:string)=>{if(!s.trim())throw new Error(code)}
const iso=(s:string,code:string)=>{if(Number.isNaN(Date.parse(s)))throw new Error(code)}

export function assertAutonomousMandateLimits(l:AutonomousMandateLimits):void{
  positive(l.maxOrderNotionalMinor,'MONEY_AUTO_ORDER_LIMIT_INVALID')
  positive(l.maxDailySubmittedNotionalMinor,'MONEY_AUTO_DAILY_NOTIONAL_INVALID')
  positive(l.maxDailyRealizedLossMinor,'MONEY_AUTO_DAILY_LOSS_INVALID')
  positive(l.maxGrossExposureMinor,'MONEY_AUTO_GROSS_EXPOSURE_INVALID')
  if(!Number.isInteger(l.maxDailyOrders)||l.maxDailyOrders<1)throw new Error('MONEY_AUTO_DAILY_ORDERS_INVALID')
  bps(l.maxDrawdownBps,'MONEY_AUTO_DRAWDOWN_INVALID')
  if(!Number.isInteger(l.maxLeverageBps)||l.maxLeverageBps<10000||l.maxLeverageBps>100000)throw new Error('MONEY_AUTO_LEVERAGE_INVALID')
  if(l.maxLeverageBps<10000)throw new Error('MONEY_AUTO_LEVERAGE_BELOW_ONE_X')
  bps(l.minModelConfidenceBps,'MONEY_AUTO_CONFIDENCE_INVALID')
  if(l.maxOrderNotionalMinor>l.maxDailySubmittedNotionalMinor)throw new Error('MONEY_AUTO_ORDER_EXCEEDS_DAILY_LIMIT')
  if(l.maxOrderNotionalMinor>l.maxGrossExposureMinor)throw new Error('MONEY_AUTO_ORDER_EXCEEDS_GROSS_LIMIT')
}

export function assertAutonomousMandateActive(m:AutonomousTradingMandate,now:string):void{
  iso(now,'MONEY_AUTO_TIME_INVALID')
  if(m.status!=='ACTIVE'||m.mode!=='LIVE_AUTONOMOUS'||m.authority!=='USER_APPROVED_MANDATE'||m.canAuthorizeTrade!==false)throw new Error('MONEY_AUTO_MANDATE_NOT_ACTIVE')
  if(now<m.startsAt||now>=m.expiresAt)throw new Error('MONEY_AUTO_MANDATE_OUTSIDE_WINDOW')
  assertAutonomousMandateLimits(m.limits)
}

export function assertAutonomousIntent(i:AutonomousTradeIntent):void{
  for(const [v,c] of [[i.intentId,'MONEY_AUTO_INTENT_ID_REQUIRED'],[i.mandateId,'MONEY_AUTO_INTENT_MANDATE_REQUIRED'],[i.strategyId,'MONEY_AUTO_STRATEGY_REQUIRED'],[i.instrumentId,'MONEY_AUTO_INSTRUMENT_REQUIRED'],[i.opportunityId,'MONEY_AUTO_OPPORTUNITY_REQUIRED'],[i.allocationDecisionId,'MONEY_AUTO_ALLOCATION_REQUIRED'],[i.executionPlanId,'MONEY_AUTO_PLAN_REQUIRED'],[i.preflightId,'MONEY_AUTO_PREFLIGHT_REQUIRED']] as const)nonEmpty(v,c)
  positive(i.notionalMinor,'MONEY_AUTO_INTENT_NOTIONAL_INVALID');positive(i.limitPriceMinor,'MONEY_AUTO_LIMIT_PRICE_INVALID')
  bps(i.modelConfidenceBps,'MONEY_AUTO_INTENT_CONFIDENCE_INVALID')
  if(!i.evidenceIds.length)throw new Error('MONEY_AUTO_INTENT_EVIDENCE_REQUIRED')
  iso(i.decidedAt,'MONEY_AUTO_INTENT_TIME_INVALID')
  if(i.authority!=='INTELLIGENCE_ONLY'||i.canExecute!==false)throw new Error('MONEY_AUTO_INTENT_AUTHORITY_FORBIDDEN')
}

export function createAutonomousMandateActivationRequest(input:{
  actionId:string;userId:string;approvalReceiptId:string;requestedAt:string;action:AutonomousMandateActivationAction
}):AutonomousMandateActivationRequest{
  if(!input.approvalReceiptId.trim())throw new Error('MONEY_AUTO_EXPLICIT_APPROVAL_REQUIRED')
  return Object.freeze({id:input.actionId,userId:input.userId,type:'money.autonomous.mandate.activate',action:Object.freeze({...input.action,allowedInstrumentPrefixes:Object.freeze([...input.action.allowedInstrumentPrefixes]),allowedStrategyIds:Object.freeze([...input.action.allowedStrategyIds])}),requestedAt:input.requestedAt,approvalReceiptId:input.approvalReceiptId})
}

export function createAutonomousTradingMandate(input:{
  mandateId:string
  request:AutonomousMandateActivationRequest
  authority:MoneyActionCoreAuthority
  evidenceIds:readonly string[]
  activatedAt:string
}):AutonomousTradingMandate{
  const {request,authority}=input,a=request.action
  if(authority.actionRequestId!==request.id||authority.actionRequestFingerprint.length===0||authority.userId!==request.userId||authority.capability!==request.type)throw new Error('MONEY_AUTO_ACTION_CORE_AUTHORITY_MISMATCH')
  if(authority.decision!=='approval_required'||!authority.approvalReceiptId||authority.approvalReceiptId!==request.approvalReceiptId)throw new Error('MONEY_AUTO_ACTION_CORE_APPROVAL_REQUIRED')
  if(!input.mandateId.trim()||!input.evidenceIds.length)throw new Error('MONEY_AUTO_MANDATE_PROVENANCE_REQUIRED')
  if(!a.allowedInstrumentPrefixes.length||!a.allowedStrategyIds.length)throw new Error('MONEY_AUTO_ALLOWLIST_REQUIRED')
  if(new Set(a.allowedInstrumentPrefixes).size!==a.allowedInstrumentPrefixes.length||new Set(a.allowedStrategyIds).size!==a.allowedStrategyIds.length)throw new Error('MONEY_AUTO_ALLOWLIST_DUPLICATE')
  iso(a.startsAt,'MONEY_AUTO_START_INVALID');iso(a.expiresAt,'MONEY_AUTO_EXPIRY_INVALID');iso(input.activatedAt,'MONEY_AUTO_ACTIVATED_AT_INVALID')
  if(a.expiresAt<=a.startsAt||input.activatedAt<a.startsAt||input.activatedAt>=a.expiresAt||authority.expiresAt<a.expiresAt)throw new Error('MONEY_AUTO_MANDATE_WINDOW_INVALID')
  const limits:AutonomousMandateLimits=Object.freeze({
    maxOrderNotionalMinor:BigInt(a.maxOrderNotionalMinor),
    maxDailySubmittedNotionalMinor:BigInt(a.maxDailySubmittedNotionalMinor),
    maxDailyOrders:a.maxDailyOrders,
    maxDailyRealizedLossMinor:BigInt(a.maxDailyRealizedLossMinor),
    maxGrossExposureMinor:BigInt(a.maxGrossExposureMinor),
    maxDrawdownBps:a.maxDrawdownBps,
    maxLeverageBps:a.maxLeverageBps,
    minModelConfidenceBps:a.minModelConfidenceBps,
  })
  assertAutonomousMandateLimits(limits)
  return Object.freeze({
    mandateId:input.mandateId,userId:request.userId,provider:a.provider,accountId:a.accountId,currency:a.currency,mode:'LIVE_AUTONOMOUS',
    allowedInstrumentPrefixes:Object.freeze([...a.allowedInstrumentPrefixes]),allowedStrategyIds:Object.freeze([...a.allowedStrategyIds]),allowOpeningShorts:a.allowOpeningShorts,limits,
    startsAt:a.startsAt,expiresAt:a.expiresAt,approvalReceiptId:request.approvalReceiptId!,actionCoreAuthorityId:authority.authorityId,policyVersion:authority.policyVersion,policyHash:authority.policyHash,
    evidenceIds:Object.freeze([...new Set(input.evidenceIds)].sort()),status:'ACTIVE',activatedAt:input.activatedAt,authority:'USER_APPROVED_MANDATE',canAuthorizeTrade:false,
  })
}

export class InMemoryAutonomousTradingMandateStore implements AutonomousTradingMandateStore{
  private rows=new Map<string,AutonomousTradingMandate>()
  put(m:AutonomousTradingMandate){if(this.rows.has(m.mandateId))throw new Error('MONEY_AUTO_MANDATE_EXISTS');this.rows.set(m.mandateId,m)}
  get(id:string){return this.rows.get(id)}
  findActive(i:{userId:string;provider:string;accountId:string;now:string}){return [...this.rows.values()].find(m=>m.status==='ACTIVE'&&m.userId===i.userId&&m.provider===i.provider&&m.accountId===i.accountId&&m.startsAt<=i.now&&i.now<m.expiresAt)}
  revoke(id:string,revokedAt:string){const m=this.rows.get(id);if(!m||m.status!=='ACTIVE')throw new Error('MONEY_AUTO_MANDATE_NOT_ACTIVE');this.rows.set(id,Object.freeze({...m,status:'REVOKED',revokedAt}))}
}
