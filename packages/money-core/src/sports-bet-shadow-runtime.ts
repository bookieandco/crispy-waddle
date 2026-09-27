import { createHash } from 'node:crypto'
import type { SportsForwardShadowPrediction,SportsForwardShadowRecord } from './sports-prediction-forward-shadow.js'

export type SportsBetShadowAction='SHADOW_WAGER'|'NO_BET'
export type SportsBetShadowSourceClass='REAL_AS_OF'|'SYNTHETIC_TEST'

export type SportsBetShadowDecision=Readonly<{
  decisionId:string
  predictionId:string
  eventId:string
  marketId:string
  selectionId:string
  action:SportsBetShadowAction
  reasonCodes:readonly string[]
  edgeBps:number
  quoteAgeSeconds:number
  decisionAt:string
  sourceClass:SportsBetShadowSourceClass
  evidenceIds:readonly string[]
  authority:'SHADOW_ONLY'
  bettingAuthority:'NONE'
  financialAuthority:'NONE'
  canExecute:false
}>

export type SportsBetShadowSoakCriteria=Readonly<{
  minimumDecisions:number
  minimumResolvedWagers:number
  minimumForwardMinutes:number
  minimumResolutionRateBps:number
  maximumStaleQuoteCount:number
  maximumDuplicateDecisionCount:number
  maximumFutureLeakCount:number
  maximumSettlementMismatchCount:number
  maximumAuthorityEscalationCount:number
}>

export type SportsBetShadowSoakEvidence=Readonly<{
  soakId:string
  sourceClass:SportsBetShadowSourceClass
  startedAt:string
  endedAt:string
  decisionCount:number
  shadowWagerCount:number
  resolvedWagerCount:number
  staleQuoteCount:number
  duplicateDecisionCount:number
  futureLeakCount:number
  settlementMismatchCount:number
  authorityEscalationCount:number
  unresolvedPredictionIds:readonly string[]
  decisionIds:readonly string[]
  recordIds:readonly string[]
  evidenceIds:readonly string[]
  authority:'CERTIFICATION_EVIDENCE_ONLY'
  canExecute:false
}>

export type SportsBetShadowSoakCertification=Readonly<{
  certificationId:string
  status:'SOFTWARE_ONLY'|'INSUFFICIENT_FORWARD_EVIDENCE'|'REJECTED'|'SHADOW_CERTIFIED'
  passed:boolean
  operationallyCertified:boolean
  economicEdgeCertified:false
  liveBettingEligible:false
  decisionCount:number
  resolvedWagerCount:number
  forwardMinutes:number
  reasonCodes:readonly string[]
  evidenceIds:readonly string[]
  authority:'CERTIFICATION_ONLY'
  canExecute:false
}>

const stable=(v:unknown)=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)
const hash=(v:unknown)=>createHash('sha256').update(stable(v)).digest('hex')
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())
const time=(v:string,c:string)=>{const n=Date.parse(v);if(Number.isNaN(n))throw new Error(c);return n}

export function createSportsBetShadowDecision(input:{
  prediction:SportsForwardShadowPrediction
  decisionAt:string
  minimumEdgeBps:number
  maxQuoteAgeSeconds:number
  sourceClass:SportsBetShadowSourceClass
  evidenceIds:readonly string[]
}):SportsBetShadowDecision{
  const p=input.prediction
  if(p.authority!=='SHADOW_ONLY'||p.bettingAuthority!=='NONE'||p.financialAuthority!=='NONE'||p.canExecute!==false)throw new Error('SPORT_BET_SHADOW_AUTHORITY_INVALID')
  if(!Number.isInteger(input.minimumEdgeBps))throw new Error('SPORT_BET_SHADOW_EDGE_THRESHOLD_INVALID')
  if(!Number.isInteger(input.maxQuoteAgeSeconds)||input.maxQuoteAgeSeconds<1)throw new Error('SPORT_BET_SHADOW_QUOTE_AGE_LIMIT_INVALID')
  if(!input.evidenceIds.length)throw new Error('SPORT_BET_SHADOW_EVIDENCE_REQUIRED')
  const decisionMs=time(input.decisionAt,'SPORT_BET_SHADOW_DECISION_TIME_INVALID')
  const issuedMs=time(p.envelope.issuedAt,'SPORT_BET_SHADOW_ISSUED_TIME_INVALID')
  const quoteMs=time(p.quote.availableAt,'SPORT_BET_SHADOW_QUOTE_TIME_INVALID')
  if(decisionMs<issuedMs)throw new Error('SPORT_BET_SHADOW_DECISION_BEFORE_PREDICTION')
  if(quoteMs>decisionMs)throw new Error('SPORT_BET_SHADOW_FUTURE_QUOTE')
  const quoteAgeSeconds=Math.floor((decisionMs-quoteMs)/1000)
  const reasons:string[]=[]
  if(quoteAgeSeconds>input.maxQuoteAgeSeconds)reasons.push('STALE_QUOTE')
  if(p.edgeAtEntryBps<input.minimumEdgeBps)reasons.push('EDGE_BELOW_THRESHOLD')
  const action:SportsBetShadowAction=reasons.length?'NO_BET':'SHADOW_WAGER'
  return Object.freeze({
    decisionId:'sport-bet-shadow:'+hash({predictionId:p.predictionId,decisionAt:input.decisionAt,minimumEdgeBps:input.minimumEdgeBps,maxQuoteAgeSeconds:input.maxQuoteAgeSeconds}),
    predictionId:p.predictionId,eventId:p.eventId,marketId:p.quote.marketId,selectionId:p.quote.selectionId,
    action,reasonCodes:unique(reasons),edgeBps:p.edgeAtEntryBps,quoteAgeSeconds,decisionAt:input.decisionAt,sourceClass:input.sourceClass,
    evidenceIds:unique([...p.evidenceIds,...input.evidenceIds]),authority:'SHADOW_ONLY',bettingAuthority:'NONE',financialAuthority:'NONE',canExecute:false,
  })
}

export function buildSportsBetShadowSoakEvidence(input:{
  sourceClass:SportsBetShadowSourceClass
  decisions:readonly SportsBetShadowDecision[]
  records:readonly SportsForwardShadowRecord[]
  unresolvedPredictionIds?:readonly string[]
  settlementMismatchCount?:number
  futureLeakCount?:number
  authorityEscalationCount?:number
  startedAt:string
  endedAt:string
  evidenceIds:readonly string[]
}):SportsBetShadowSoakEvidence{
  const started=time(input.startedAt,'SPORT_BET_SHADOW_SOAK_START_INVALID'),ended=time(input.endedAt,'SPORT_BET_SHADOW_SOAK_END_INVALID')
  if(ended<started)throw new Error('SPORT_BET_SHADOW_SOAK_CLOCK_INVALID')
  if(!input.decisions.length||!input.evidenceIds.length)throw new Error('SPORT_BET_SHADOW_SOAK_EVIDENCE_REQUIRED')
  const decisionIds=input.decisions.map(x=>x.decisionId)
  const uniqueDecisionIds=unique(decisionIds)
  const duplicateDecisionCount=decisionIds.length-uniqueDecisionIds.length
  const shadowPredictionIds=new Set(input.decisions.filter(x=>x.action==='SHADOW_WAGER').map(x=>x.predictionId))
  const recordIds=unique(input.records.map(x=>x.recordId))
  let resolvedWagerCount=0
  for(const r of input.records){
    if(!shadowPredictionIds.has(r.prediction.predictionId))throw new Error('SPORT_BET_SHADOW_RECORD_WITHOUT_DECISION')
    if(r.authority!=='LEARNING_ONLY'||r.canAuthorizeLive!==false)throw new Error('SPORT_BET_SHADOW_RECORD_AUTHORITY_INVALID')
    resolvedWagerCount++
  }
  const staleQuoteCount=input.decisions.filter(x=>x.reasonCodes.includes('STALE_QUOTE')).length
  const settlementMismatchCount=input.settlementMismatchCount??0
  const futureLeakCount=input.futureLeakCount??0
  const authorityEscalationCount=input.authorityEscalationCount??0
  for(const [v,c] of [[settlementMismatchCount,'SPORT_BET_SHADOW_SETTLEMENT_MISMATCH_INVALID'],[futureLeakCount,'SPORT_BET_SHADOW_FUTURE_LEAK_INVALID'],[authorityEscalationCount,'SPORT_BET_SHADOW_AUTHORITY_ESCALATION_INVALID']] as const)if(!Number.isInteger(v)||v<0)throw new Error(c)
  return Object.freeze({
    soakId:'sport-bet-shadow-soak:'+hash({sourceClass:input.sourceClass,decisionIds:uniqueDecisionIds,recordIds,startedAt:input.startedAt,endedAt:input.endedAt}),
    sourceClass:input.sourceClass,startedAt:input.startedAt,endedAt:input.endedAt,decisionCount:input.decisions.length,
    shadowWagerCount:shadowPredictionIds.size,resolvedWagerCount,staleQuoteCount,duplicateDecisionCount,futureLeakCount,settlementMismatchCount,authorityEscalationCount,
    unresolvedPredictionIds:unique(input.unresolvedPredictionIds??[]),decisionIds:uniqueDecisionIds,recordIds,evidenceIds:unique([...input.evidenceIds,...input.decisions.flatMap(x=>x.evidenceIds),...input.records.flatMap(x=>x.evidenceIds)]),
    authority:'CERTIFICATION_EVIDENCE_ONLY',canExecute:false,
  })
}

export function certifySportsBetShadowSoak(input:{evidence:SportsBetShadowSoakEvidence;criteria:SportsBetShadowSoakCriteria}):SportsBetShadowSoakCertification{
  const e=input.evidence,c=input.criteria
  if(c.minimumDecisions<1||c.minimumResolvedWagers<1||c.minimumForwardMinutes<1||c.minimumResolutionRateBps<0||c.minimumResolutionRateBps>10000)throw new Error('SPORT_BET_SHADOW_CRITERIA_INVALID')
  for(const v of [c.maximumStaleQuoteCount,c.maximumDuplicateDecisionCount,c.maximumFutureLeakCount,c.maximumSettlementMismatchCount,c.maximumAuthorityEscalationCount])if(!Number.isInteger(v)||v<0)throw new Error('SPORT_BET_SHADOW_CRITERIA_INVALID')
  const forwardMinutes=Math.floor((time(e.endedAt,'SPORT_BET_SHADOW_END_INVALID')-time(e.startedAt,'SPORT_BET_SHADOW_START_INVALID'))/60000)
  const reasons:string[]=[]
  if(e.decisionCount<c.minimumDecisions)reasons.push('DECISION_SAMPLE_TOO_SMALL')
  if(e.resolvedWagerCount<c.minimumResolvedWagers)reasons.push('RESOLVED_SAMPLE_TOO_SMALL')
  if(forwardMinutes<c.minimumForwardMinutes)reasons.push('FORWARD_DURATION_TOO_SHORT')
  const resolutionRate=e.shadowWagerCount?Math.floor(e.resolvedWagerCount*10000/e.shadowWagerCount):0
  if(resolutionRate<c.minimumResolutionRateBps)reasons.push('RESOLUTION_RATE_LOW')
  if(e.staleQuoteCount>c.maximumStaleQuoteCount)reasons.push('STALE_QUOTE_COUNT_EXCEEDED')
  if(e.duplicateDecisionCount>c.maximumDuplicateDecisionCount)reasons.push('DUPLICATE_DECISION_COUNT_EXCEEDED')
  if(e.futureLeakCount>c.maximumFutureLeakCount)reasons.push('FUTURE_LEAK_DETECTED')
  if(e.settlementMismatchCount>c.maximumSettlementMismatchCount)reasons.push('SETTLEMENT_MISMATCH_DETECTED')
  if(e.authorityEscalationCount>c.maximumAuthorityEscalationCount)reasons.push('AUTHORITY_ESCALATION_DETECTED')
  const insufficient=reasons.some(x=>x==='DECISION_SAMPLE_TOO_SMALL'||x==='RESOLVED_SAMPLE_TOO_SMALL'||x==='FORWARD_DURATION_TOO_SHORT'||x==='RESOLUTION_RATE_LOW')
  let status:SportsBetShadowSoakCertification['status']
  if(e.sourceClass==='SYNTHETIC_TEST')status='SOFTWARE_ONLY'
  else if(!reasons.length)status='SHADOW_CERTIFIED'
  else if(insufficient)status='INSUFFICIENT_FORWARD_EVIDENCE'
  else status='REJECTED'
  const operationallyCertified=status==='SHADOW_CERTIFIED'
  return Object.freeze({
    certificationId:'sport-bet-shadow-cert:'+hash({soakId:e.soakId,criteria:c}),status,passed:status==='SOFTWARE_ONLY'||operationallyCertified,operationallyCertified,economicEdgeCertified:false,liveBettingEligible:false,
    decisionCount:e.decisionCount,resolvedWagerCount:e.resolvedWagerCount,forwardMinutes,reasonCodes:unique(reasons),evidenceIds:e.evidenceIds,authority:'CERTIFICATION_ONLY',canExecute:false,
  })
}
