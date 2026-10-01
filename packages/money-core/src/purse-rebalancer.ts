import { createHash } from 'node:crypto'
import type { MoneyStrategyLane } from './money-commissioning-contracts.js'
import type { JhadinaPurseCharter } from './jhadina-purse-charter.js'
import { assertJhadinaPurseCharter } from './jhadina-purse-charter.js'
import type { PurseDecisionSet } from './purse-decision-engine.js'
import type { PursePortfolioSnapshot, PursePositionSnapshot } from './purse-portfolio.js'
import type { PositionManagementDecision } from './position-management.js'

export type PurseRiskRebalanceDirective=Readonly<{
 directiveId:string
 positionId:string
 lane:MoneyStrategyLane
 strategyId:string
 instrumentId:string
 action:'HOLD'|'TRIM'|'EXIT'
 reductionBps:number
 reasonCodes:readonly string[]
 evidenceIds:readonly string[]
 observedAt:string
 authority:'RISK_REBALANCE_DIRECTIVE'
 canExecute:false
}>

export type PurseRebalanceIntent=Readonly<{
 intentId:string
 charterId:string
 decisionSetId:string
 lane:MoneyStrategyLane
 strategyId:string
 instrumentId:string
 action:'INCREASE'|'REDUCE'|'EXIT'|'HOLD'
 currentValueMinor:bigint
 targetValueMinor:bigint
 notionalMinor:bigint
 reportingCurrency:string
 reasonCodes:readonly string[]
 evidenceIds:readonly string[]
 createdAt:string
 expiresAt:string
 authority:'PURSE_REBALANCE_INTENT_ONLY'
 financialAuthority:'NONE'
 requiresDownstreamRiskAndAuthority:true
 canExecute:false
}>

export type PurseRebalancePlan=Readonly<{
 rebalancePlanId:string
 charterId:string
 decisionSetId:string
 portfolioSnapshotId:string
 reportingCurrency:string
 intents:readonly PurseRebalanceIntent[]
 turnoverMinor:bigint
 turnoverBps:number
 cashTargetMinor:bigint
 createdAt:string
 expiresAt:string
 evidenceIds:readonly string[]
 authority:'PURSE_REBALANCE_PLAN_ONLY'
 canExecute:false
 requiresDownstreamRiskAndAuthority:true
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())
const abs=(x:bigint)=>x<0n?-x:x

export function adaptPositionManagementToPurseDirective(input:{
 decision:PositionManagementDecision
 position:PursePositionSnapshot
 strategyId:string
 observedAt:string
 trimFractionBps?:number
}):PurseRiskRebalanceDirective{
 const {decision:d,position:p}=input
 if(d.positionId!==p.positionId||d.instrumentId!==p.instrumentId)throw new Error('PURSE_REBALANCE_POSITION_DECISION_MISMATCH')
 if(d.authority!=='INTELLIGENCE_ONLY'||d.financialAuthority!=='NONE'||d.canExecute!==false||d.requiresDownstreamRiskAndAuthority!==true)throw new Error('PURSE_REBALANCE_POSITION_DECISION_AUTHORITY_INVALID')
 const action=d.action==='EXIT'?'EXIT':d.action==='TRIM'?'TRIM':'HOLD'
 const reductionBps=action==='EXIT'?10000:action==='TRIM'?(input.trimFractionBps??5000):0
 if(!Number.isInteger(reductionBps)||reductionBps<0||reductionBps>10000)throw new Error('PURSE_REBALANCE_REDUCTION_INVALID')
 return Object.freeze({
  directiveId:'purse-risk-directive:'+hash({decisionId:d.decisionId,positionId:p.positionId,reductionBps,observedAt:input.observedAt}),
  positionId:p.positionId,lane:p.lane,strategyId:input.strategyId,instrumentId:p.instrumentId,action,reductionBps,
  reasonCodes:Object.freeze([...d.reasonCodes]),evidenceIds:unique([...d.evidenceIds,...p.evidenceIds]),observedAt:input.observedAt,
  authority:'RISK_REBALANCE_DIRECTIVE',canExecute:false,
 })
}

export function buildPurseRebalancePlan(input:{
 charter:JhadinaPurseCharter
 decisions:PurseDecisionSet
 portfolio:PursePortfolioSnapshot
 riskDirectives:readonly PurseRiskRebalanceDirective[]
 createdAt:string
 expiresAt:string
}):PurseRebalancePlan{
 assertJhadinaPurseCharter(input.charter,input.createdAt)
 const {charter,decisions,portfolio}=input
 if(decisions.charterId!==charter.charterId||decisions.authority!=='PURSE_DECISION_SET_ONLY'||decisions.canExecute!==false)throw new Error('PURSE_REBALANCE_DECISION_SET_INVALID')
 if(portfolio.cofferId!==charter.cofferId||portfolio.userId!==charter.userId||portfolio.reportingCurrency!==charter.reportingCurrency)throw new Error('PURSE_REBALANCE_PORTFOLIO_BINDING_MISMATCH')
 if(portfolio.authority!=='PORTFOLIO_EVIDENCE'||portfolio.canExecute!==false)throw new Error('PURSE_REBALANCE_PORTFOLIO_AUTHORITY_INVALID')
 if(input.createdAt<portfolio.observedAt||input.expiresAt<=input.createdAt)throw new Error('PURSE_REBALANCE_TIME_INVALID')
 const positionsByInstrument=new Map(portfolio.positions.map(x=>[x.instrumentId,x]))
 const directivesByPosition=new Map<string,PurseRiskRebalanceDirective>()
 for(const d of input.riskDirectives){
  if(d.authority!=='RISK_REBALANCE_DIRECTIVE'||d.canExecute!==false||d.reductionBps<0||d.reductionBps>10000||!d.evidenceIds.length)throw new Error('PURSE_REBALANCE_DIRECTIVE_INVALID')
  if(d.observedAt>input.createdAt)throw new Error('PURSE_REBALANCE_DIRECTIVE_FUTURE')
  if(directivesByPosition.has(d.positionId))throw new Error('PURSE_REBALANCE_DUPLICATE_DIRECTIVE')
  directivesByPosition.set(d.positionId,d)
 }
 const intents:PurseRebalanceIntent[]=[]
 const evidenceIds=[...portfolio.evidenceIds,...charter.evidenceIds]
 const targeted=new Set<string>()

 for(const d of decisions.allocations){
  const current=positionsByInstrument.get(d.instrumentId)
  const directive=current?directivesByPosition.get(current.positionId):undefined
  targeted.add(d.instrumentId)
  if(directive&&(directive.action==='EXIT'||directive.action==='TRIM')){
   continue
  }
  const currentValue=current?.marketValueMinor??0n
  const targetValue=currentValue+d.amountMinor
  intents.push(Object.freeze({
   intentId:'purse-rebalance:'+hash({decisionId:d.decisionId,currentValue,targetValue,createdAt:input.createdAt}),
   charterId:charter.charterId,decisionSetId:decisions.decisionSetId,lane:d.lane as MoneyStrategyLane,strategyId:d.strategyId,instrumentId:d.instrumentId,
   action:d.amountMinor>0n?'INCREASE':'HOLD',currentValueMinor:currentValue,targetValueMinor:targetValue,notionalMinor:d.amountMinor,reportingCurrency:d.reportingCurrency,
   reasonCodes:Object.freeze([...d.reasonCodes,'PURSE_ALLOCATION_DECISION']),evidenceIds:unique([...d.evidenceIds,...(current?.evidenceIds??[])]),
   createdAt:input.createdAt,expiresAt:input.expiresAt,authority:'PURSE_REBALANCE_INTENT_ONLY',financialAuthority:'NONE',
   requiresDownstreamRiskAndAuthority:true,canExecute:false,
  }))
  evidenceIds.push(...d.evidenceIds)
 }

 for(const p of portfolio.positions){
  const directive=directivesByPosition.get(p.positionId)
  if(!directive)continue
  if(directive.lane!==p.lane||directive.instrumentId!==p.instrumentId)throw new Error('PURSE_REBALANCE_DIRECTIVE_BINDING_MISMATCH')
  const reduction=directive.action==='EXIT'?p.marketValueMinor:p.marketValueMinor*BigInt(directive.reductionBps)/10000n
  const target=p.marketValueMinor-reduction
  intents.push(Object.freeze({
   intentId:'purse-rebalance:'+hash({directiveId:directive.directiveId,current:p.marketValueMinor,target,createdAt:input.createdAt}),
   charterId:charter.charterId,decisionSetId:decisions.decisionSetId,lane:p.lane,strategyId:directive.strategyId,instrumentId:p.instrumentId,
   action:directive.action==='EXIT'?'EXIT':directive.action==='TRIM'?'REDUCE':'HOLD',currentValueMinor:p.marketValueMinor,targetValueMinor:target,notionalMinor:reduction,
   reportingCurrency:p.reportingCurrency,reasonCodes:directive.reasonCodes,evidenceIds:unique([...directive.evidenceIds,...p.evidenceIds]),
   createdAt:input.createdAt,expiresAt:input.expiresAt,authority:'PURSE_REBALANCE_INTENT_ONLY',financialAuthority:'NONE',
   requiresDownstreamRiskAndAuthority:true,canExecute:false,
  }))
  evidenceIds.push(...directive.evidenceIds)
 }

 const turnover=intents.reduce((n,x)=>n+(x.action==='HOLD'?0n:x.notionalMinor),0n)
 const base=portfolio.grossPortfolioValueMinor
 const turnoverBps=base<=0n?0:Number(turnover*10000n/base)
 if(turnoverBps>charter.maxRebalanceTurnoverBps)throw new Error('PURSE_REBALANCE_TURNOVER_CAP')
 return Object.freeze({
  rebalancePlanId:'purse-rebalance-plan:'+hash({charterId:charter.charterId,decisionSetId:decisions.decisionSetId,portfolio:portfolio.snapshotId,intents:intents.map(x=>x.intentId),createdAt:input.createdAt}),
  charterId:charter.charterId,decisionSetId:decisions.decisionSetId,portfolioSnapshotId:portfolio.snapshotId,reportingCurrency:portfolio.reportingCurrency,
  intents:Object.freeze(intents),turnoverMinor:turnover,turnoverBps,cashTargetMinor:decisions.cash.amountMinor,createdAt:input.createdAt,expiresAt:input.expiresAt,
  evidenceIds:unique(evidenceIds),authority:'PURSE_REBALANCE_PLAN_ONLY',canExecute:false,requiresDownstreamRiskAndAuthority:true,
 })
}
