import type { CofferTreasurySnapshot } from './coffer-treasury-contracts.js'
import type { JhadinaPurseCharter } from './jhadina-purse-charter.js'
import { allocatePurseCapital, type PurseAllocationPlan, type PurseAllocatorCapitalEvidence, type PurseExposureEvidence } from './purse-capital-allocator.js'
import { buildPurseDecisionSet, type PurseDecisionSet } from './purse-decision-engine.js'
import type { PurseOpportunityEnvelope } from './purse-opportunity-bus.js'
import type { PurseLearningContext, PursePersonalitySnapshot } from './purse-learning-memory.js'
import type { PurseLearningRuntime } from './purse-learning-runtime.js'

export type PurseLearnedDecisionCycle=Readonly<{
 learning:PurseLearningContext
 allocation:PurseAllocationPlan
 decisions:PurseDecisionSet
 authority:'PURSE_DECISION_COORDINATION_ONLY'
 financialAuthority:'NONE'
 canExecute:false
}>

export async function runLearnedPurseDecisionCycle(input:{
 charter:JhadinaPurseCharter
 treasury:CofferTreasurySnapshot
 capital:PurseAllocatorCapitalEvidence
 opportunities:readonly PurseOpportunityEnvelope[]
 currentExposures:readonly PurseExposureEvidence[]
 personality:PursePersonalitySnapshot
 personalityEvidenceIds:readonly string[]
 learningRuntime:PurseLearningRuntime
 informationCutoff:string
 expiresAt:string
 decidedAt:string
}):Promise<PurseLearnedDecisionCycle>{
 const strategies=Object.freeze([
  ...new Map(input.opportunities.map(env=>[
   env.opportunity.lane+':'+env.opportunity.strategyId,
   Object.freeze({lane:env.opportunity.lane,strategyId:env.opportunity.strategyId}),
  ])).values(),
 ])
 const learning=await input.learningRuntime.buildDecisionContext({
  strategies,personality:input.personality,autonomyMode:input.charter.autonomyMode,observedAt:input.informationCutoff,
  personalityEvidenceIds:input.personalityEvidenceIds,
 })
 const allocation=allocatePurseCapital({
  charter:input.charter,treasury:input.treasury,capital:input.capital,opportunities:input.opportunities,currentExposures:input.currentExposures,
  learning,informationCutoff:input.informationCutoff,expiresAt:input.expiresAt,
 })
 const decisions=buildPurseDecisionSet({charter:input.charter,plan:allocation,opportunities:input.opportunities,decidedAt:input.decidedAt})
 return Object.freeze({
  learning,allocation,decisions,authority:'PURSE_DECISION_COORDINATION_ONLY',financialAuthority:'NONE',canExecute:false,
 })
}
