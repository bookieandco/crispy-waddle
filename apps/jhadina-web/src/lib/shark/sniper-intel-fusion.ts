import type {SniperLiveRiskDecision} from '@jhadina/shark-intelligence-core/meme-trader'
import type {SharkShadowCounterfactualLesson,SniperPaperTradeReceipt,SniperSettlementEvidence} from '@jhadina/money-core'

/** SHARK-INTEL.FUSION.01: deterministic, bounded, read-only research projector.
 * Transcript and Telegram claims remain hypotheses, NEVER verified chain facts.
 * Only independent Shadow outcome receipts can become retrospective lessons.
 * A paper outcome never becomes actual settled profit or an execution permit.
 */
export type SniperIntelSource='CHAIN'|'DEX'|'HELIUS'|'TELEGRAM'|'SOCIAL'|'YOUTUBE_TRANSCRIPT'|'SHARK'|'MONEY'|'SHADOW'
export type SniperIntelClaim='BUNDLE_CLUSTER'|'FAKE_VOLUME'|'TRACKED_BUY'|'TRACKED_SELL'|
 'DEV_HISTORY'|'LIQUIDITY_CONTROL'|'LIQUIDITY_DRAIN'|'SELLABILITY'|
 'MIGRATION'|'RUG_MECHANISM'|'NARRATIVE'|'ROUTE_FEE'|'MEV_LANDING'
export type SniperIndependentOutcomeProof=Readonly<{
 lessonId:string
 decisionId:string
 tokenAddress:string
 observedAt:string
 availableAt:string
 returnBasis:'DECISION_RELATIVE'|'LAUNCH_RELATIVE'|'UNAVAILABLE'
 independentEvidenceIds:readonly string[]
 independentlyVerified:boolean
}>
export type SniperIntelObservation=Readonly<{
 evidenceId:string
 tokenAddress:string
 source:SniperIntelSource
 claim:SniperIntelClaim
 /** Same operator, recycled caller or forwarded message must reuse a cohort. */
 independenceGroup:string
 observedAt:string
 availableAt:string
 verification:'CHAIN_ATTESTED'|'PROVIDER_VERIFIED'|'CLAIM_ONLY'
}>
export type SniperIntelFusion=Readonly<{
 version:'SHARK-INTEL.FUSION.01'
 decisionId:string
 tokenAddress:string
 informationCutoff:string
 admittedEvidenceIds:readonly string[]
 hypothesisEvidenceIds:readonly string[]
 quarantinedEvidenceIds:readonly string[]
 independentVerifiedGroups:number
 claims:readonly Readonly<{claim:SniperIntelClaim;verifiedGroups:number;hypothesisCount:number}>[]
 rugMechanisms:SniperLiveRiskDecision['mechanisms']
 riskDisposition:SniperLiveRiskDecision['disposition']
 /** A count of independent historical decisions, not overlapping time horizons. */
 historicalIndependentDecisions:number
 historicalLessonIds:readonly string[]
 paperTrade?:Readonly<{
  status:SniperPaperTradeReceipt['status']
  realizedNetPnlMinor?:bigint
  classification:'SIMULATED_NOT_SETTLED'
 }>
 followup?:Readonly<{
  outcomeId:string
  grade:'VERIFIED_ONCHAIN'|'PAPER_ONLY'|'UNVERIFIED_OUTCOME'
  realizedNetPnlLamports?:bigint
  availableAt:string
 }>
 deferredReasons:readonly string[]
 authority:'INTELLIGENCE_EVIDENCE_ONLY'
 canExecute:false
 canSign:false
 canCreditPurse:false
 canAuthorizeLive:false
 canMutateModel:false
}>
export const TRANSCRIPT_HYPOTHESES=Object.freeze([
 'BUNDLE_CLUSTER','FAKE_VOLUME','TRACKED_BUY','TRACKED_SELL','DEV_HISTORY',
 'LIQUIDITY_CONTROL','MIGRATION','NARRATIVE','ROUTE_FEE','MEV_LANDING',
] as const satisfies readonly SniperIntelClaim[])
const claims:readonly SniperIntelClaim[]=[
 'BUNDLE_CLUSTER','FAKE_VOLUME','TRACKED_BUY','TRACKED_SELL','DEV_HISTORY',
 'LIQUIDITY_CONTROL','LIQUIDITY_DRAIN','SELLABILITY','MIGRATION',
 'RUG_MECHANISM','NARRATIVE','ROUTE_FEE','MEV_LANDING',
]
const iso=(x:string)=>{const t=Date.parse(x);if(!x||!Number.isFinite(t))throw new Error('SHARK_INTEL_TIMESTAMP_INVALID');return t}
const id=(x:string)=>typeof x==='string'&&x.length>0&&x.length<=256
const uniq=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())

export function fuseSniperIntelligence(input:{
 decisionId:string
 tokenAddress:string
 chainId:'solana-mainnet'
 cutoff:string
 risk:SniperLiveRiskDecision
 observations?:readonly SniperIntelObservation[]
 priorShadowLessons?:readonly SharkShadowCounterfactualLesson[]
 /** Required independent observation proof for each learning lesson; legacy lesson rows alone are not admitted. */
 priorLessonProofs?:readonly SniperIndependentOutcomeProof[]
 paper?:SniperPaperTradeReceipt
 /** Real settlement is supplied only AFTER independent provider/onchain reconciliation. */
 settlement?:SniperSettlementEvidence
 /** Required canonical Money trade linkage; token alone cannot identify a settlement. */
 settlementTradeId?:string
}):SniperIntelFusion{
 const cutoff=iso(input.cutoff)
 if(!id(input.decisionId)||!id(input.tokenAddress)||input.chainId!=='solana-mainnet'||
  input.risk.tokenAddress!==input.tokenAddress||input.risk.authority!=='RISK_RESEARCH_ONLY'||
  input.risk.canExecute!==false)throw new Error('SHARK_INTEL_DECISION_BINDING_INVALID')
 if((input.observations?.length??0)>2000||(input.priorShadowLessons?.length??0)>2000||
    (input.priorLessonProofs?.length??0)>2000){
  throw new Error('SHARK_INTEL_BATCH_TOO_LARGE')
 }
 const admitted:SniperIntelObservation[]=[]
 const hypothetical:SniperIntelObservation[]=[]
 const quarantined:string[]=[]
 const seen=new Set<string>()
 for(const obs of input.observations??[]){
  if(!id(obs.evidenceId)||!id(obs.independenceGroup)||!id(obs.tokenAddress)||
    !claims.includes(obs.claim)||!['CHAIN','DEX','HELIUS','TELEGRAM','SOCIAL','YOUTUBE_TRANSCRIPT','SHARK','MONEY','SHADOW'].includes(obs.source)){
    throw new Error('SHARK_INTEL_OBSERVATION_INVALID')
  }
  const observed=iso(obs.observedAt),available=iso(obs.availableAt)
  if(obs.tokenAddress!==input.tokenAddress||observed>available||available>cutoff||
    seen.has(obs.evidenceId)){
    quarantined.push(obs.evidenceId)
    continue
  }
  seen.add(obs.evidenceId)
  const privileged=obs.source==='CHAIN'||obs.source==='DEX'||obs.source==='HELIUS'||obs.source==='MONEY'
  // Telegram forwards / creator claims / uploaded YouTube transcripts never
  // silently upgrade into onchain evidence or a financial instruction.
  if(privileged&&obs.verification!=='CLAIM_ONLY'){
    admitted.push(obs)
  }else{
    hypothetical.push(obs)
  }
 }
 const verifiedSourceGroups=new Set(admitted.map(x=>x.independenceGroup))
 const summaries=claims.map(claim=>{
  const verifiedGroups=new Set(admitted.filter(x=>x.claim===claim).map(x=>x.independenceGroup))
  const hypothesisCount=hypothetical.filter(x=>x.claim===claim).length
  return Object.freeze({claim,verifiedGroups:verifiedGroups.size,hypothesisCount})
 }).filter(x=>x.verifiedGroups+x.hypothesisCount>0)
 const historical=new Map<string,SharkShadowCounterfactualLesson>()
 const proofByLesson=new Map<string,SniperIndependentOutcomeProof>()
 for(const proof of input.priorLessonProofs??[]){
  if(!id(proof.lessonId)||!id(proof.decisionId)||proof.tokenAddress!==input.tokenAddress||
    proof.returnBasis!=='DECISION_RELATIVE'||proof.independentlyVerified!==true||
    !proof.independentEvidenceIds.length)continue
  const observed=iso(proof.observedAt),available=iso(proof.availableAt)
  if(observed>available||available>cutoff||proofByLesson.has(proof.lessonId))continue
  proofByLesson.set(proof.lessonId,proof)
 }
 for(const lesson of input.priorShadowLessons??[]){
  const proof=proofByLesson.get(lesson.lessonId)
  if(!proof||proof.decisionId!==lesson.decisionId||
    !proof.independentEvidenceIds.some(id=>lesson.evidenceIds.includes(id)))continue
  if(lesson.instrumentId!==input.chainId+':'+input.tokenAddress||
    lesson.authority!=='LEARNING_ONLY'||lesson.canExecute!==false||
    lesson.canAuthorizeLive!==false||!id(lesson.lessonId)||!id(lesson.decisionId)||
    !lesson.evidenceIds.length){continue}
  const time=iso(lesson.evaluatedAt)
  if(time>cutoff||time<Date.parse(proof.availableAt)||seen.has(lesson.lessonId))continue
  // Max one independent learning unit per decision, even for six horizons.
  const prev=historical.get(lesson.decisionId)
  // Equal-time lesson ordering must be reproducible regardless of DB row order.
  // One decision remains one historical unit; choose a stable ID tie-breaker.
  if(!prev||Date.parse(prev.evaluatedAt)<time||
     (Date.parse(prev.evaluatedAt)===time&&prev.lessonId<lesson.lessonId)){
    historical.set(lesson.decisionId,lesson)
  }
 }
 const paper=input.paper
 if(paper&&(paper.tokenAddress!==input.tokenAddress||
  paper.authority!=='PAPER_SIMULATION_ONLY'||paper.canExecute!==false||
  paper.canCreditPurse!==false||!id(paper.runId))){
  throw new Error('SHARK_INTEL_PAPER_BINDING_INVALID')
 }
 let followup:SniperIntelFusion['followup']
 const s=input.settlement
 if(s){
  if(input.settlementTradeId!==input.decisionId||s.tokenAddress!==input.tokenAddress||!id(s.outcomeId)||!s.evidenceIds.length||
    iso(s.settledAt)>iso(s.availableAt)||iso(s.availableAt)>cutoff){
    throw new Error('SHARK_INTEL_SETTLEMENT_PROVENANCE_INVALID')
  }
  const independentlyReal=s.kind==='ONCHAIN'&&s.independentlyVerified
  followup=Object.freeze({
   outcomeId:s.outcomeId,
   grade:independentlyReal?'VERIFIED_ONCHAIN':s.kind==='PAPER'?'PAPER_ONLY':'UNVERIFIED_OUTCOME',
   ...(independentlyReal?{realizedNetPnlLamports:s.realizedNetPnlLamports}:{}),
   availableAt:s.availableAt,
  })
 }
 const deferred:string[]=[]
 if(!admitted.length)deferred.push('INDEPENDENT_PROVIDER_EVIDENCE_MISSING')
 if(!historical.size)deferred.push('DECISION_RELATIVE_VERIFIED_SHADOW_LESSONS_MISSING')
 if(!followup)deferred.push('POST_TRADE_SETTLEMENT_NOT_RECONCILED')
 if(followup&&followup.grade!=='VERIFIED_ONCHAIN')deferred.push('ONCHAIN_PROFIT_NOT_VERIFIED')
 return Object.freeze({
  version:'SHARK-INTEL.FUSION.01',decisionId:input.decisionId,tokenAddress:input.tokenAddress,
  informationCutoff:input.cutoff,
  admittedEvidenceIds:uniq(admitted.map(x=>x.evidenceId)),
  hypothesisEvidenceIds:uniq(hypothetical.map(x=>x.evidenceId)),
  quarantinedEvidenceIds:uniq(quarantined),
  independentVerifiedGroups:verifiedSourceGroups.size,
  claims:Object.freeze(summaries),
  rugMechanisms:Object.freeze([...input.risk.mechanisms]),
  riskDisposition:input.risk.disposition,
  historicalIndependentDecisions:historical.size,
  historicalLessonIds:uniq([...historical.values()].map(x=>x.lessonId)),
  ...(paper?{paperTrade:Object.freeze({
   status:paper.status,
   ...(paper.realizedNetPnlMinor!==undefined?{realizedNetPnlMinor:paper.realizedNetPnlMinor}:{}),
   classification:'SIMULATED_NOT_SETTLED' as const,
  })}:{}),
  ...(followup?{followup}:{}),
  deferredReasons:uniq(deferred),
  authority:'INTELLIGENCE_EVIDENCE_ONLY',
  canExecute:false,canSign:false,canCreditPurse:false,canAuthorizeLive:false,canMutateModel:false,
 })
}
