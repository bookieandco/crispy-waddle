import type {SharkShadowCounterfactualLesson,SharkShadowHorizon} from './shark-shadow-learning.js'

export type VerifiedPurseShadowGrade=Readonly<{
 lesson:SharkShadowCounterfactualLesson
 decidedAt:string
 availableAt:string
 providerVerification:'VERIFIED'|'UNVERIFIED'|'INVALID'
 verificationIds:readonly string[]
}>
export type PurseShadowEvidenceReview=Readonly<{
 userId:string
 strategyId:string
 cutoff:string
 eligible:readonly SharkShadowCounterfactualLesson[]
 quarantined:readonly {lessonId:string;reason:string}[]
 uniqueDecisions:number
 authority:'SHADOW_REVIEW_ONLY'
 canExecute:false
 canAuthorizeLive:false
}>
const ranks:Record<SharkShadowHorizon,number>={'15M':1,'1H':2,'4H':3,'24H':4,'3D':5,'7D':6}
const valid=(v:string)=>Boolean(v)&&!Number.isNaN(Date.parse(v))

export function reviewPurseShadowEvidence(input:{
 userId:string
 strategyId:string
 cutoff:string
 grades:readonly VerifiedPurseShadowGrade[]
 invalidDecisionIds?:readonly string[]
}):PurseShadowEvidenceReview{
 if(!input.userId||!input.strategyId||!valid(input.cutoff))throw new Error('PURSE_REVIEW_CONTEXT_INVALID')
 const rejected=new Set(input.invalidDecisionIds??[])
 const accepted=new Map<string,SharkShadowCounterfactualLesson>()
 const seen=new Map<string,string>()
 const quarantined:{lessonId:string;reason:string}[]=[]
 for(const x of input.grades){
  const l=x.lesson
  let reason=''
  if(l.userId!==input.userId||l.strategyId!==input.strategyId)reason='OWNER_OR_STRATEGY_MISMATCH'
  else if(l.authority!=='LEARNING_ONLY'||l.financialAuthority!=='NONE'||l.canExecute!==false||l.canAuthorizeLive!==false)reason='AUTHORITY_INVALID'
  else if(!l.lessonId||!l.decisionId||!l.evidenceIds.length||!x.verificationIds.length||x.providerVerification!=='VERIFIED')reason='UNVERIFIED_PROVENANCE'
  else if(!Object.prototype.hasOwnProperty.call(ranks,l.horizon))reason='INVALID_HORIZON'
  else if(!valid(l.evaluatedAt)||!valid(x.decidedAt)||!valid(x.availableAt)||Date.parse(x.availableAt)<Date.parse(l.evaluatedAt)||Date.parse(x.availableAt)>Date.parse(input.cutoff)||Date.parse(l.evaluatedAt)>Date.parse(input.cutoff))reason='FUTURE_OR_MISSING_EVIDENCE'
  else if(Date.parse(l.evaluatedAt)<Date.parse(x.decidedAt)+({ '15M':900000,'1H':3600000,'4H':14400000,'24H':86400000,'3D':259200000,'7D':604800000 } as Record<SharkShadowHorizon,number>)[l.horizon])reason='SHADOW_HORIZON_NOT_MATURE'
  else if(![l.decisionQualityBps,l.executionCostBps,l.confidenceErrorBps].every(Number.isFinite))reason='INVALID_GRADE'
  else if(rejected.has(l.decisionId))reason='PRIOR_QUARANTINE'
  const key=l.decisionId+':'+l.horizon
  if(!reason&&seen.has(key)&&seen.get(key)!==l.lessonId){
    reason='CONFLICTING_HORIZON_GRADE'
    rejected.add(l.decisionId)
    accepted.delete(l.decisionId)
  }
  if(reason){quarantined.push({lessonId:l.lessonId,reason});continue}
  seen.set(key,l.lessonId)
  const prior=accepted.get(l.decisionId)
  if(!prior||ranks[l.horizon]>ranks[prior.horizon]||
    ranks[l.horizon]===ranks[prior.horizon]&&l.evaluatedAt>prior.evaluatedAt)accepted.set(l.decisionId,l)
 }
 const eligible=Object.freeze([...accepted.values()].filter(x=>!rejected.has(x.decisionId)).sort((a,b)=>a.decisionId.localeCompare(b.decisionId)))
 return Object.freeze({userId:input.userId,strategyId:input.strategyId,cutoff:input.cutoff,eligible,quarantined:Object.freeze(quarantined),uniqueDecisions:eligible.length,
  authority:'SHADOW_REVIEW_ONLY',canExecute:false,canAuthorizeLive:false})
}
