import {createHash} from 'node:crypto';
import type {DecisionAssessment,DecisionCase} from './decision-workflow-contracts.js';
import {assertMoneyStrategyCandidate,type MoneyStrategyCandidate,
  type MoneyHoldoutGrade} from './money-finish-strategy-factory.js';

export const MONEY_MARKET_IQ_MIMS_SCHEMA='MONEY-FINISH-12' as const;
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function ms(x:string,code:string):number{const v=Date.parse(x);if(!x||!Number.isFinite(v))throw new Error(code);return v;}
export type MoneyResearchEvidence=Readonly<{
  evidenceId:string;claimId:string;sourceId:string;
  observedAt:string;availableAt:string;
  direction:'SUPPORTS'|'CHALLENGES';
  strength:'DIRECT'|'INDIRECT'|'ANECDOTAL';
  status:'VERIFIED'|'DISPUTED'|'UNVERIFIED';
  rights:'RESEARCH_ALLOWED'|'UNKNOWN'|'RESTRICTED';
  provenanceHash:string;
}>;
export type MoneyMarketIqClaim=Readonly<{
  claimId:string;statement:string;assumptions:readonly string[];
  causalSteps:readonly Readonly<{from:string;to:string;evidenceId:string}>[];
  alternativeExplanations:readonly string[];
  baseRate:Readonly<{probability:number;sourceEvidenceId:string}>|null;
  claimEvidenceIds:readonly string[];
  contradictions:readonly Readonly<{contradictionId:string;description:string;evidenceIds:readonly string[]}>[];
  incentives:readonly string[];
}>;
export type MoneyMimsVote=Readonly<{
  claimId:string;
  coherence:'COHERENT'|'CONTRADICTORY'|'INSUFFICIENT';
  empiricalSupport:'SUPPORTED'|'CONTESTED'|'UNVERIFIED';
  truthStatus:'NOT_ESTABLISHED';
  coherenceReasons:readonly string[];
  epistemicReasons:readonly string[];
  independentVerifiedSources:number;
  alternativeExplanations:readonly string[];
  baseRate:MoneyMarketIqClaim['baseRate'];
  authority:'RESEARCH_ONLY';canExecute:false;canAuthorizeLive:false;
}>;
export type MoneyResearchSourceArtifact=Readonly<{
  artifactId:string;kind:'SIGNAL_LEAGUE'|'OPTIONS_RISK'|'FX_CHALLENGER'|'HOLDOUT_GRADE'|'MACRO_REGIME';
  instrumentId:string;informationCutoff:string;evidenceHash:string;
  evidenceIds:readonly string[];authority:'RESEARCH_ONLY';
  canExecute:false;canAuthorizeLive:false;
}>;
export type MoneyMimsResearchReview=Readonly<{
  schemaVersion:typeof MONEY_MARKET_IQ_MIMS_SCHEMA;
  reviewId:string;candidateId:string;candidateHash:string;informationCutoff:string;
  sourceArtifactId:string;sourceEvidenceIds:readonly string[];
  vote:MoneyMimsVote;
  reasons:readonly string[];
  decisionCase:DecisionCase;
  decisionAssessment:DecisionAssessment;
  disposition:'RESEARCH_ONLY'|'BLOCKED';
  inputHash:string;
  authority:'RESEARCH_ONLY';canExecute:false;canAuthorizeLive:false;
}>;
function cycle(steps:MoneyMarketIqClaim['causalSteps']):boolean {
  const graph=new Map<string,string[]>();
  for(const e of steps)graph.set(e.from,[...(graph.get(e.from)??[]),e.to]);
  const visiting=new Set<string>(),finished=new Set<string>();
  const visit=(node:string):boolean=>{
    if(visiting.has(node))return true;
    if(finished.has(node))return false;
    visiting.add(node);
    for(const next of graph.get(node)??[])if(visit(next))return true;
    visiting.delete(node);finished.add(node);return false;
  };
  for(const n of graph.keys())if(visit(n))return true;
  return false;
}
export function voteMakeItMakeSense(input:Readonly<{
  claim:MoneyMarketIqClaim;evidence:readonly MoneyResearchEvidence[];
  informationCutoff:string;
}>):MoneyMimsVote {
  const {claim,evidence}=input,cutoff=ms(input.informationCutoff,'MONEY_MIMS_CUTOFF_INVALID');
  if(!claim.claimId.trim()||!claim.statement.trim()||
     claim.assumptions.some(a=>!a.trim())||claim.alternativeExplanations.some(a=>!a.trim())||
     new Set(claim.claimEvidenceIds).size!==claim.claimEvidenceIds.length)
    throw new Error('MONEY_MIMS_CLAIM_INVALID');
  if(claim.baseRate&&(claim.baseRate.probability<0||claim.baseRate.probability>1||
     !Number.isFinite(claim.baseRate.probability)||!claim.baseRate.sourceEvidenceId.trim()))
    throw new Error('MONEY_MIMS_BASE_RATE_INVALID');
  const evidenceById=new Map<string,MoneyResearchEvidence>();
  for(const e of evidence){
    if(!e.evidenceId.trim()||!e.sourceId.trim()||!e.provenanceHash.trim()||
       e.claimId!==claim.claimId||evidenceById.has(e.evidenceId)||
       ms(e.observedAt,'MONEY_MIMS_OBSERVED_INVALID')>
       ms(e.availableAt,'MONEY_MIMS_AVAILABLE_INVALID')||
       ms(e.availableAt,'MONEY_MIMS_AVAILABLE_INVALID')>cutoff)
      throw new Error('MONEY_MIMS_FUTURE_CONFLICT_OR_SOURCE_INVALID');
    evidenceById.set(e.evidenceId,e);
  }
  if(claim.claimEvidenceIds.some(id=>!evidenceById.has(id))||
     claim.causalSteps.some(s=>!s.from.trim()||!s.to.trim()||!evidenceById.has(s.evidenceId))||
     claim.contradictions.some(x=>!x.contradictionId.trim()||!x.description.trim()||
       !x.evidenceIds.length||x.evidenceIds.some(id=>!evidenceById.has(id)))||
     (claim.baseRate&&!evidenceById.has(claim.baseRate.sourceEvidenceId)))
    throw new Error('MONEY_MIMS_CLAIM_EVIDENCE_UNRESOLVED');
  const coherenceReasons:string[]=[];
  const epistemicReasons:string[]=[];
  const hasCycle=cycle(claim.causalSteps);
  if(hasCycle)coherenceReasons.push('CIRCULAR_CAUSAL_EXPLANATION');
  if(claim.contradictions.length)coherenceReasons.push('UNRESOLVED_CONTRADICTIONS');
  if(!claim.assumptions.length)coherenceReasons.push('ASSUMPTIONS_UNSPECIFIED');
  if(!claim.causalSteps.length)coherenceReasons.push('CAUSAL_MECHANISM_UNSPECIFIED');
  if(!claim.alternativeExplanations.length)epistemicReasons.push('ALTERNATIVES_NOT_CONSIDERED');
  if(!claim.baseRate)epistemicReasons.push('BASE_RATE_NOT_VERIFIED');
  const verified=claim.claimEvidenceIds.map(id=>evidenceById.get(id)!).filter(e=>
    e.status==='VERIFIED'&&e.rights==='RESEARCH_ALLOWED');
  const independentVerifiedSources=new Set(verified.map(e=>e.sourceId)).size;
  const supporting=verified.filter(e=>e.direction==='SUPPORTS'&&e.strength!=='ANECDOTAL');
  const challenging=verified.filter(e=>e.direction==='CHALLENGES'&&e.strength!=='ANECDOTAL');
  const unverified=claim.claimEvidenceIds.some(id=>{
    const e=evidenceById.get(id)!;
    return e.status!=='VERIFIED'||e.rights!=='RESEARCH_ALLOWED';
  });
  if(!supporting.length)epistemicReasons.push('NO_INDEPENDENT_SUPPORTING_EVIDENCE');
  if(independentVerifiedSources<2)epistemicReasons.push('SOURCE_DIVERSITY_INSUFFICIENT');
  if(challenging.length)epistemicReasons.push('CONTRARY_EVIDENCE_PRESENT');
  if(unverified)epistemicReasons.push('UNVERIFIED_OR_UNLICENSED_EVIDENCE');
  const coherence=hasCycle||claim.contradictions.length?'CONTRADICTORY':
    !claim.assumptions.length||!claim.causalSteps.length?'INSUFFICIENT':'COHERENT';
  // Logical consistency never implies empirical truth, and a plausible theory
  // never certifies a trading edge or execution authority.
  const empiricalSupport=challenging.length?'CONTESTED':
    supporting.length&&independentVerifiedSources>=2&&!unverified?'SUPPORTED':'UNVERIFIED';
  return Object.freeze({
    claimId:claim.claimId,coherence,empiricalSupport,truthStatus:'NOT_ESTABLISHED',
    coherenceReasons:Object.freeze(coherenceReasons),
    epistemicReasons:Object.freeze(epistemicReasons),
    independentVerifiedSources,
    alternativeExplanations:Object.freeze([...claim.alternativeExplanations]),
    baseRate:claim.baseRate,
    authority:'RESEARCH_ONLY',canExecute:false,canAuthorizeLive:false
  });
}
export function reviewMoneyStrategyWithMims(input:Readonly<{
  candidate:MoneyStrategyCandidate;artifact:MoneyResearchSourceArtifact;
  claim:MoneyMarketIqClaim;evidence:readonly MoneyResearchEvidence[];
  informationCutoff:string;createdAt:string;reviewedBy:string;
  hardRiskGate:'PASS'|'FAIL'|'UNVERIFIED';
  dataRights:'VERIFIED'|'UNVERIFIED';
  holdoutGrade?:MoneyHoldoutGrade;
}>):MoneyMimsResearchReview {
  assertMoneyStrategyCandidate(input.candidate);
  const cutoff=ms(input.informationCutoff,'MONEY_MIMS_CUTOFF_INVALID');
  if(!input.reviewedBy.trim()||!input.artifact.artifactId.trim()||
     !input.artifact.evidenceHash.trim()||!input.artifact.evidenceIds.length||
     input.artifact.evidenceIds.some(x=>!x.trim())||
     input.artifact.authority!=='RESEARCH_ONLY'||
     input.artifact.canExecute!==false||input.artifact.canAuthorizeLive!==false||
     input.artifact.instrumentId!==input.candidate.instrumentId||
     ms(input.artifact.informationCutoff,'MONEY_MIMS_ARTIFACT_CUTOFF_INVALID')>cutoff||
     ms(input.candidate.createdAt,'MONEY_MIMS_CANDIDATE_CREATED_INVALID')>cutoff||
     ms(input.createdAt,'MONEY_MIMS_REVIEW_CREATED_INVALID')<cutoff)
    throw new Error('MONEY_MIMS_SOURCE_OR_CHRONOLOGY_INVALID');
  const vote=voteMakeItMakeSense({claim:input.claim,evidence:input.evidence,
    informationCutoff:input.informationCutoff});
  const reasons:string[]=[];
  if(input.hardRiskGate!=='PASS')reasons.push('HARD_RISK_GATE_NOT_PASS');
  if(input.dataRights!=='VERIFIED')reasons.push('DATA_ENTITLEMENT_UNVERIFIED');
  if(input.claim.claimEvidenceIds.length===0||vote.empiricalSupport!=='SUPPORTED')
    reasons.push('EVIDENCE_NOT_SUFFICIENT');
  if(vote.coherence!=='COHERENT')reasons.push('MIMS_COHERENCE_NOT_ESTABLISHED');
  if(input.artifact.kind==='HOLDOUT_GRADE'&&(
       !input.holdoutGrade||input.holdoutGrade.proofStatus!=='HISTORICAL_HOLDOUT_RESEARCH_ONLY'||
       input.holdoutGrade.gradeHash!==input.artifact.evidenceHash||
       input.holdoutGrade.candidateId!==input.candidate.candidateId))
    reasons.push('HOLDOUT_GRADE_UNBOUND');
  const disposition=reasons.length?'BLOCKED':'RESEARCH_ONLY';
  const hash=sha({candidate:input.candidate.candidateHash,artifact:input.artifact,
    claim:input.claim,evidence:input.evidence.map(e=>e.provenanceHash).sort(),vote,
    risk:input.hardRiskGate,rights:input.dataRights,cutoff:input.informationCutoff});
  const decisionCase:DecisionCase=Object.freeze({
    caseId:'money-research:'+hash,accountId:'NO_ACCOUNT_RESEARCH',subjectId:input.candidate.instrumentId,
    requestedBy:input.reviewedBy,informationCutoff:input.informationCutoff,
    createdAt:input.createdAt,status:'RESEARCH_ONLY',provenanceHash:hash
  });
  const decisionAssessment:DecisionAssessment=Object.freeze({
    caseId:decisionCase.caseId,
    evidenceStatus:vote.empiricalSupport,freshnessStatus:'AS_OF_CUTOFF',
    riskStatus:input.hardRiskGate,stressStatus:'NOT_COMMISSIONED',
    simulationStatus:'RESEARCH_NOT_VALIDATED',
    liquidityStatus:'UNVERIFIED_FOR_EXECUTION',calibrationStatus:'NOT_CERTIFIED',
    authorityStatus:'NONE',disposition
  });
  return Object.freeze({
    schemaVersion:MONEY_MARKET_IQ_MIMS_SCHEMA,
    reviewId:'money-mims:'+hash,candidateId:input.candidate.candidateId,
    candidateHash:input.candidate.candidateHash,informationCutoff:input.informationCutoff,
    sourceArtifactId:input.artifact.artifactId,
    sourceEvidenceIds:Object.freeze([...input.artifact.evidenceIds]),
    vote,reasons:Object.freeze(reasons),decisionCase,decisionAssessment,
    disposition,inputHash:hash,authority:'RESEARCH_ONLY',canExecute:false,canAuthorizeLive:false
  });
}
