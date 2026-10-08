import {createHash} from 'node:crypto'
import {allocatePurseCapital,type PurseAllocatorCapitalEvidence,type PurseExposureEvidence} from './purse-capital-allocator.js'
import {buildPurseDecisionSet} from './purse-decision-engine.js'
import {buildPurseRebalancePlan,type PurseRiskRebalanceDirective} from './purse-rebalancer.js'
import type {JhadinaPurseCharter} from './jhadina-purse-charter.js'
import type {PurseOpportunityEnvelope} from './purse-opportunity-bus.js'
import type {PursePortfolioSnapshot} from './purse-portfolio.js'
import type {PurseLiquiditySnapshot} from './purse-liquidity.js'
import type {CofferTreasurySnapshot} from './coffer-treasury-contracts.js'
import type {PurseStrategyLearningProfile,PurseDecisionStyle} from './purse-learning-personality.js'
import type {PurseShadowEvidenceReview} from './purse-shadow-evidence-admission.js'

export type PursePaperLease=Readonly<{
 workerId:string
 fencingToken:number
 acquiredAt:string
 expiresAt:string
 evidenceIds:readonly string[]
 authority:'PAPER_LEASE_EVIDENCE_ONLY'
}>
export type PursePaperIntent=Readonly<{
 intentId:string
 lane:string
 instrumentId:string
 simulatedNotionalMinor:bigint
 intent:'SIMULATE_INCREASE'|'SIMULATE_REDUCE'|'SIMULATE_EXIT'
 authority:'PAPER_SIMULATION_INPUT_ONLY'
 canExecute:false
 canMoveMoney:false
}>
export type PursePaperCycle=Readonly<{
 cycleId:string
 charterId:string
 portfolioSnapshotId:string
 allocationPlanId:string
 decisionSetId:string
 rebalancePlanId:string
 leaseFencingToken:number
 informationCutoff:string
 createdAt:string
 expiresAt:string
 paperIntents:readonly PursePaperIntent[]
 rejectedOpportunityIds:readonly string[]
 learningProfileIds:readonly string[]
 evidenceIds:readonly string[]
 status:'PAPER_PLANNED'
 authority:'PAPER_CYCLE_ONLY'
 canExecute:false
 canSign:false
 canBroadcast:false
 canMoveMoney:false
}>
const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v,(_k,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const valid=(s:string)=>Boolean(s)&&!Number.isNaN(Date.parse(s))
const maxAge=15*60*1000
const checkFresh=(observed:string,cutoff:string,code:string)=>{
 if(!valid(observed)||Date.parse(observed)>Date.parse(cutoff)||Date.parse(cutoff)-Date.parse(observed)>maxAge)throw new Error(code)
}
/** Planning boundary: no provider, bank, wallet or network calls, no simulated performance fabricated. */
export function buildAutonomousPursePaperCycle(x:{
 charter:JhadinaPurseCharter
 treasury:CofferTreasurySnapshot
 capital:PurseAllocatorCapitalEvidence
 portfolio:PursePortfolioSnapshot
 liquidity:PurseLiquiditySnapshot
 opportunities:readonly PurseOpportunityEnvelope[]
 exposures:readonly PurseExposureEvidence[]
 riskDirectives:readonly PurseRiskRebalanceDirective[]
 learningProfiles:readonly PurseStrategyLearningProfile[]
 shadowReview:PurseShadowEvidenceReview
 decisionStyle?:PurseDecisionStyle
 lease:PursePaperLease
 informationCutoff:string
 createdAt:string
 expiresAt:string
}):PursePaperCycle{
 if(x.charter.autonomyMode!=='PAPER_AUTONOMOUS'&&x.charter.autonomyMode!=='SHADOW_AUTONOMOUS')throw new Error('PURSE_PAPER_MODE_ONLY')
 if(!valid(x.informationCutoff)||!valid(x.createdAt)||!valid(x.expiresAt)||x.createdAt<x.informationCutoff||x.expiresAt<=x.createdAt)throw new Error('PURSE_PAPER_TIME_INVALID')
 const lease=x.lease
 if(lease.authority!=='PAPER_LEASE_EVIDENCE_ONLY'||!lease.workerId||!Number.isSafeInteger(lease.fencingToken)||lease.fencingToken<=0||!lease.evidenceIds.length||
   !valid(lease.acquiredAt)||!valid(lease.expiresAt)||lease.acquiredAt>x.createdAt||lease.expiresAt<=x.createdAt||lease.expiresAt<x.expiresAt)throw new Error('PURSE_PAPER_LEASE_INVALID')
 for(const [time,code] of [
  [x.treasury.observedAt,'PURSE_PAPER_STALE_TREASURY'],
  [x.capital.observedAt,'PURSE_PAPER_STALE_CAPITAL'],
  [x.portfolio.observedAt,'PURSE_PAPER_STALE_PORTFOLIO'],
  [x.liquidity.observedAt,'PURSE_PAPER_STALE_LIQUIDITY'],
 ] as const)checkFresh(time,x.informationCutoff,code)
 if(x.portfolio.userId!==x.charter.userId||x.portfolio.cofferId!==x.charter.cofferId||
   x.liquidity.charterId!==x.charter.charterId||x.liquidity.portfolioSnapshotId!==x.portfolio.snapshotId||
   x.capital.userId!==x.charter.userId||x.capital.cofferId!==x.charter.cofferId||
   x.liquidity.reportingCurrency!==x.charter.reportingCurrency)throw new Error('PURSE_PAPER_OWNER_OR_PORTFOLIO_MISMATCH')
 if(x.capital.availableLiquidityMinor>x.liquidity.availableToAllocateMinor)throw new Error('PURSE_PAPER_CAPITAL_EXCEEDS_AVAILABLE')
 if(x.shadowReview.userId!==x.charter.userId||!x.shadowReview.strategyId||x.shadowReview.cutoff!==x.informationCutoff||
   x.shadowReview.authority!=='SHADOW_REVIEW_ONLY'||x.shadowReview.canAuthorizeLive!==false||x.shadowReview.canExecute!==false||
   x.shadowReview.uniqueDecisions!==x.shadowReview.eligible.length||new Set(x.shadowReview.eligible.map(y=>y.decisionId)).size!==x.shadowReview.eligible.length)throw new Error('PURSE_PAPER_LEARNING_EVIDENCE_INVALID')
 if(x.learningProfiles.length){
  // Do not accept previous contaminated profiles that counted six observation horizons as six trades.
  const eligibleMemories=new Set(x.shadowReview.eligible.map(y=>'purse-shadow-learning:'+y.lessonId))
  for(const p of x.learningProfiles){
   if(p.authority!=='LEARNING_ONLY'||p.canAuthorizeLive!==false||p.evaluatedAt>x.informationCutoff||
     !p.sourceMemoryIds.length||p.sourceMemoryIds.some(id=>!eligibleMemories.has(id))||
     p.sampleWeight>x.shadowReview.uniqueDecisions)throw new Error('PURSE_PAPER_PROFILE_NOT_QUARANTINED')
  }
 }
 const plan=allocatePurseCapital({
  charter:x.charter,treasury:x.treasury,capital:x.capital,opportunities:x.opportunities,
  currentExposures:x.exposures,learningProfiles:x.learningProfiles,decisionStyle:x.decisionStyle,
  informationCutoff:x.informationCutoff,expiresAt:x.expiresAt,
 })
 const decisions=buildPurseDecisionSet({charter:x.charter,plan,opportunities:x.opportunities,decidedAt:x.createdAt})
 const rebalance=buildPurseRebalancePlan({charter:x.charter,decisions,portfolio:x.portfolio,riskDirectives:x.riskDirectives,
  createdAt:x.createdAt,expiresAt:x.expiresAt})
 const paperIntents=Object.freeze(rebalance.intents.filter(y=>y.action!=='HOLD'&&y.notionalMinor>0n).map(y=>Object.freeze({
  intentId:y.intentId,lane:y.lane,instrumentId:y.instrumentId,simulatedNotionalMinor:y.notionalMinor,
  intent:(y.action==='INCREASE'?'SIMULATE_INCREASE':y.action==='EXIT'?'SIMULATE_EXIT':'SIMULATE_REDUCE') as PursePaperIntent['intent'],
  authority:'PAPER_SIMULATION_INPUT_ONLY' as const,canExecute:false as const,canMoveMoney:false as const,
 })))
 return Object.freeze({
  cycleId:'purse-paper-cycle:'+sha({charterId:x.charter.charterId,portfolioId:x.portfolio.snapshotId,planId:plan.planId,rebalanceId:rebalance.rebalancePlanId,cutoff:x.informationCutoff,worker:lease.workerId,fence:lease.fencingToken}),
  charterId:x.charter.charterId,portfolioSnapshotId:x.portfolio.snapshotId,allocationPlanId:plan.planId,
  decisionSetId:decisions.decisionSetId,rebalancePlanId:rebalance.rebalancePlanId,leaseFencingToken:lease.fencingToken,
  informationCutoff:x.informationCutoff,createdAt:x.createdAt,expiresAt:x.expiresAt,paperIntents,
  rejectedOpportunityIds:plan.rejectedOpportunityIds,learningProfileIds:plan.learningProfileIds,
  evidenceIds:Object.freeze([...new Set([...plan.evidenceIds,...rebalance.evidenceIds,...lease.evidenceIds])].sort()),
  status:'PAPER_PLANNED',authority:'PAPER_CYCLE_ONLY',canExecute:false,canSign:false,canBroadcast:false,canMoveMoney:false,
 })
}
/** Durable store must atomically enforce the lease fence and receipt identity; no in-memory "success" certification. */
export interface PursePaperCycleStore{
 appendOnce(cycle:PursePaperCycle):Promise<'INSERTED'|'REPLAY'>
}
export async function recordAutonomousPursePaperCycle(input:{cycle:PursePaperCycle;store:PursePaperCycleStore}):Promise<'INSERTED'|'REPLAY'>{
 if(input.cycle.authority!=='PAPER_CYCLE_ONLY'||input.cycle.status!=='PAPER_PLANNED'||input.cycle.canExecute!==false||
   input.cycle.canSign!==false||input.cycle.canBroadcast!==false||input.cycle.canMoveMoney!==false)throw new Error('PURSE_PAPER_EXECUTION_FORBIDDEN')
 return input.store.appendOnce(input.cycle)
}
