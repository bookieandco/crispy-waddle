import {createHash} from 'node:crypto'
import {allocatePurseCapital,type PurseAllocatorCapitalEvidence,type PurseExposureEvidence,type PurseAllocationPlan} from './purse-capital-allocator.js'
import type {JhadinaPurseCharter} from './jhadina-purse-charter.js'
import type {CofferTreasurySnapshot} from './coffer-treasury-contracts.js'
import type {PurseOpportunityEnvelope} from './purse-opportunity-bus.js'
import type {PurseStrategyLearningProfile} from './purse-learning-personality.js'
import type {PurseShadowEvidenceReview} from './purse-shadow-evidence-admission.js'
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x,(_k,v)=>typeof v==='bigint'?v.toString():v)).digest('hex')
export type PurseLearningInfluence=Readonly<{
 comparisonId:string
 baselinePlanId:string
 learnedPlanId:string
 trainingCutoff:string
 holdoutCutoff:string
 allocationDeltaMinor:bigint
 decisionChanged:boolean
 conclusion:'DECISION_CHANGED'|'NO_OBSERVED_DECISION_CHANGE'
 evidenceIds:readonly string[]
 authority:'PAPER_LEARNING_COMPARISON_ONLY'
 doesNotProveProfitability:true
 canExecute:false
}>
/** Strict time split: accepted learning observed before any holdout opportunity begins.
 * A changed paper decision is not proof of better real-world outcomes. */
export function comparePursePaperLearning(input:{
 charter:JhadinaPurseCharter
 treasury:CofferTreasurySnapshot
 capital:PurseAllocatorCapitalEvidence
 opportunities:readonly PurseOpportunityEnvelope[]
 currentExposures:readonly PurseExposureEvidence[]
 profiles:readonly PurseStrategyLearningProfile[]
 shadowReview:PurseShadowEvidenceReview
 trainingCutoff:string
 holdoutCutoff:string
 expiresAt:string
}):PurseLearningInfluence{
 const x=input
 if(!x.trainingCutoff||!x.holdoutCutoff||Number.isNaN(Date.parse(x.trainingCutoff))||Number.isNaN(Date.parse(x.holdoutCutoff))||
    x.trainingCutoff>=x.holdoutCutoff||x.expiresAt<=x.holdoutCutoff)throw new Error('PURSE_LEARNING_HOLDOUT_TIME_INVALID')
 if(x.shadowReview.userId!==x.charter.userId||x.shadowReview.cutoff!==x.trainingCutoff||
    x.shadowReview.authority!=='SHADOW_REVIEW_ONLY'||x.shadowReview.canExecute!==false||x.shadowReview.canAuthorizeLive!==false)throw new Error('PURSE_LEARNING_HOLDOUT_ADMISSION_INVALID')
 const verified=new Set(x.shadowReview.eligible.map(l=>'purse-shadow-learning:'+l.lessonId))
 for(const p of x.profiles){
  if(p.authority!=='LEARNING_ONLY'||p.canAuthorizeLive!==false||p.evaluatedAt>x.trainingCutoff||
     p.sourceMemoryIds.length===0||p.sourceMemoryIds.some(id=>!verified.has(id))||
     p.sampleWeight>x.shadowReview.uniqueDecisions)throw new Error('PURSE_LEARNING_HOLDOUT_PROFILE_LEAKAGE')
 }
 if(x.opportunities.some(e=>e.opportunity.availableAt<x.trainingCutoff||
   e.opportunity.availableAt>x.holdoutCutoff||e.ingestedAt>x.holdoutCutoff))throw new Error('PURSE_LEARNING_HOLDOUT_OPPORTUNITY_LEAKAGE')
 const common={charter:x.charter,treasury:x.treasury,capital:x.capital,opportunities:x.opportunities,currentExposures:x.currentExposures,
  informationCutoff:x.holdoutCutoff,expiresAt:x.expiresAt}
 const baseline=allocatePurseCapital(common)
 const learned=allocatePurseCapital({...common,learningProfiles:x.profiles})
 const amounts=(p:PurseAllocationPlan)=>new Map(p.targets.map(t=>[t.opportunityId,t.targetIncrementMinor]))
 const a=amounts(baseline),b=amounts(learned),keys=new Set([...a.keys(),...b.keys()])
 const allocationDeltaMinor=[...keys].reduce((sum,k)=>sum+((b.get(k)??0n)-(a.get(k)??0n)),0n)
 const decisionChanged=[...keys].some(k=>(b.get(k)??0n)!==(a.get(k)??0n))
 const evidenceIds=Object.freeze([...new Set([...baseline.evidenceIds,...learned.evidenceIds,...x.shadowReview.eligible.flatMap(y=>y.evidenceIds)])].sort())
 return Object.freeze({comparisonId:'purse-holdout:'+hash({baselineId:baseline.planId,learnedId:learned.planId,trainingCutoff:x.trainingCutoff,holdoutCutoff:x.holdoutCutoff}),
  baselinePlanId:baseline.planId,learnedPlanId:learned.planId,trainingCutoff:x.trainingCutoff,holdoutCutoff:x.holdoutCutoff,
  allocationDeltaMinor,decisionChanged,conclusion:decisionChanged?'DECISION_CHANGED':'NO_OBSERVED_DECISION_CHANGE',
  evidenceIds,authority:'PAPER_LEARNING_COMPARISON_ONLY',doesNotProveProfitability:true,canExecute:false})
}
