import { createHash } from 'node:crypto'
import type { JhadinaPurseCharter } from './jhadina-purse-charter.js'
import { assertJhadinaPurseCharter } from './jhadina-purse-charter.js'
import type { PurseAllocationPlan, PurseTargetAllocation } from './purse-capital-allocator.js'
import type { PurseOpportunityEnvelope } from './purse-opportunity-bus.js'

export type PurseCapitalDecision=Readonly<{
 decisionId:string
 planId:string
 charterId:string
 opportunityId:string
 lane:string
 strategyId:string
 instrumentId:string
 decision:'ALLOCATE'|'PASS'
 amountMinor:bigint
 reportingCurrency:string
 thesis:string
 why:string
 expectedNetEdgeBps:number
 expectedDownsideBps:number
 confidenceBps:number
 scoreBps:number
 reasonCodes:readonly string[]
 evidenceIds:readonly string[]
 decidedAt:string
 expiresAt:string
 authority:'PURSE_DECISION_ONLY'
 financialAuthority:'NONE'
 requiresDownstreamRiskAndAuthority:true
 canExecute:false
}>

export type PurseCashDecision=Readonly<{
 decisionId:string
 planId:string
 charterId:string
 decision:'KEEP_CASH'
 amountMinor:bigint
 reportingCurrency:string
 why:string
 reasonCodes:readonly string[]
 decidedAt:string
 authority:'PURSE_DECISION_ONLY'
 financialAuthority:'NONE'
 canExecute:false
}>

export type PurseDecisionSet=Readonly<{
 decisionSetId:string
 planId:string
 charterId:string
 allocations:readonly PurseCapitalDecision[]
 cash:PurseCashDecision
 decidedAt:string
 authority:'PURSE_DECISION_SET_ONLY'
 canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())

function targetByOpportunity(plan:PurseAllocationPlan,id:string):PurseTargetAllocation|undefined{return plan.targets.find(x=>x.opportunityId===id)}

export function buildPurseDecisionSet(input:{
 charter:JhadinaPurseCharter
 plan:PurseAllocationPlan
 opportunities:readonly PurseOpportunityEnvelope[]
 decidedAt:string
}):PurseDecisionSet{
 assertJhadinaPurseCharter(input.charter,input.decidedAt)
 const {charter,plan}=input
 if(plan.charterId!==charter.charterId||plan.authority!=='PURSE_ALLOCATION_ONLY'||plan.canExecute!==false||plan.requiresDownstreamRiskAndAuthority!==true)throw new Error('PURSE_DECISION_PLAN_INVALID')
 if(input.decidedAt<plan.informationCutoff||input.decidedAt>=plan.expiresAt)throw new Error('PURSE_DECISION_TIME_INVALID')
 const byId=new Map(input.opportunities.map(x=>[x.opportunity.opportunityId,x]))
 const allocations:PurseCapitalDecision[]=[]
 for(const target of plan.targets){
  const env=byId.get(target.opportunityId)
  if(!env||!env.admitted)throw new Error('PURSE_DECISION_OPPORTUNITY_MISSING')
  const o=env.opportunity
  if(target.lane!==o.lane||target.strategyId!==o.strategyId||target.instrumentId!==o.instrumentId)throw new Error('PURSE_DECISION_TARGET_BINDING_MISMATCH')
  allocations.push(Object.freeze({
   decisionId:'purse-decision:'+hash({planId:plan.planId,allocationId:target.allocationId,decidedAt:input.decidedAt}),
   planId:plan.planId,charterId:charter.charterId,opportunityId:o.opportunityId,lane:o.lane,strategyId:o.strategyId,instrumentId:o.instrumentId,
   decision:'ALLOCATE',amountMinor:target.targetIncrementMinor,reportingCurrency:plan.reportingCurrency,thesis:o.thesis,
   why:target.why,expectedNetEdgeBps:o.expectedNetEdgeBps,expectedDownsideBps:o.expectedDownsideBps,confidenceBps:o.confidenceBps,scoreBps:target.scoreBps,
   reasonCodes:target.reasonCodes,evidenceIds:unique([...target.evidenceIds,...o.evidenceIds]),decidedAt:input.decidedAt,expiresAt:plan.expiresAt,
   authority:'PURSE_DECISION_ONLY',financialAuthority:'NONE',requiresDownstreamRiskAndAuthority:true,canExecute:false,
  }))
 }
 for(const id of plan.rejectedOpportunityIds){
  const env=byId.get(id)
  if(env&&targetByOpportunity(plan,id))throw new Error('PURSE_DECISION_REJECTED_TARGET_CONFLICT')
 }
 const cash:Object = Object.freeze({})
 const cashDecision:PurseCashDecision=Object.freeze({
  decisionId:'purse-cash-decision:'+hash({planId:plan.planId,amount:plan.unallocatedLiquidityMinor,decidedAt:input.decidedAt}),
  planId:plan.planId,charterId:charter.charterId,decision:'KEEP_CASH',amountMinor:plan.unallocatedLiquidityMinor,reportingCurrency:plan.reportingCurrency,
  why:plan.unallocatedLiquidityMinor>0n?'Capital remains liquid because it is not currently justified by admitted opportunities within charter limits.':'All currently available allocatable liquidity is assigned by the plan.',
  reasonCodes:Object.freeze(plan.unallocatedLiquidityMinor>0n?['OPTIONALITY_PRESERVED','NO_FORCED_DEPLOYMENT']:['ALLOCATABLE_LIQUIDITY_ASSIGNED']),
  decidedAt:input.decidedAt,authority:'PURSE_DECISION_ONLY',financialAuthority:'NONE',canExecute:false,
 })
 return Object.freeze({
  decisionSetId:'purse-decision-set:'+hash({planId:plan.planId,decisions:allocations.map(x=>x.decisionId),cash:cashDecision.decisionId}),
  planId:plan.planId,charterId:charter.charterId,allocations:Object.freeze(allocations),cash:cashDecision,decidedAt:input.decidedAt,
  authority:'PURSE_DECISION_SET_ONLY',canExecute:false,
 })
}
