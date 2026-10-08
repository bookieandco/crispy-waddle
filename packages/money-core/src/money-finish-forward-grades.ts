import {createHash} from 'node:crypto';
import {assertMoneyStrategyCandidate,type MoneyStrategyCandidate} from './money-finish-strategy-factory.js';

export const MONEY_FORWARD_GRADE_SCHEMA='MONEY-FINISH-14' as const;
export type MoneyForwardHorizon='15m'|'1h'|'4h'|'24h'|'3d'|'7d';
export const MONEY_FORWARD_HORIZONS=Object.freeze(['15m','1h','4h','24h','3d','7d'] as const);
const periods:Record<MoneyForwardHorizon,number>={'15m':900000,'1h':3600000,'4h':14400000,
  '24h':86400000,'3d':259200000,'7d':604800000};
const digest=(data:unknown)=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
function time(v:string,code:string){const n=Date.parse(v);if(!v||!Number.isFinite(n))throw new Error(code);return n;}
export type MoneyForwardQuote=Readonly<{
  quoteId:string;instrumentId:string;sourceId:string;bid:number;ask:number;
  observedAt:string;availableAt:string;receivedAt:string;
  evidenceId:string;provenanceHash:string;
  status:'VERIFIED_READ_ONLY';
}>;
export type MoneyForwardPrediction=Readonly<{
  predictionId:string;candidateId:string;candidateHash:string;instrumentId:string;
  direction:'LONG_BIAS'|'SHORT_BIAS'|'NO_TRADE';
  decisionAt:string;createdAt:string;informationCutoff:string;
  entry:MoneyForwardQuote;informationEvidenceIds:readonly string[];
  sourceRightsEvidenceId:string;
  authority:'RESEARCH_ONLY';canExecute:false;canAuthorizeLive:false;
}>;
export type MoneyForwardGrade=Readonly<{
  schemaVersion:typeof MONEY_FORWARD_GRADE_SCHEMA;gradeId:string;
  predictionId:string;candidateId:string;candidateHash:string;instrumentId:string;
  horizon:MoneyForwardHorizon;dueAt:string;gradedAt:string;
  entryQuoteId:string;exitQuoteId:string;
  grossReturnBps:number;costBps:number;netReturnBps:number;
  markLagMs:number;entrySpreadBps:number;exitSpreadBps:number;
  evidenceIds:readonly string[];
  gradeHash:string;proof:'FORWARD_PAPER_EVIDENCE_ONLY';
  authority:'LEARNING_ONLY';canExecute:false;canAuthorizeLive:false;
}>;
export function validateForwardQuote(q:MoneyForwardQuote,asOf:string,maximumSpreadBps:number):void{
  if(!q.quoteId.trim()||!q.instrumentId.trim()||!q.sourceId.trim()||
     !q.evidenceId.trim()||!q.provenanceHash.trim()||q.status!=='VERIFIED_READ_ONLY'||
     ![q.bid,q.ask].every(x=>Number.isFinite(x)&&x>0)||q.ask<q.bid)
    throw new Error('MONEY_FORWARD_QUOTE_INVALID');
  const observed=time(q.observedAt,'MONEY_FORWARD_QUOTE_TIME_INVALID');
  const available=time(q.availableAt,'MONEY_FORWARD_QUOTE_AVAILABLE_INVALID');
  const received=time(q.receivedAt,'MONEY_FORWARD_QUOTE_RECEIVED_INVALID');
  if(observed>available||available>received||received>time(asOf,'MONEY_FORWARD_QUOTE_ASOF_INVALID'))
    throw new Error('MONEY_FORWARD_FUTURE_OR_UNAVAILABLE_QUOTE');
  const spread=(q.ask-q.bid)/((q.ask+q.bid)/2)*10000;
  if(!Number.isFinite(maximumSpreadBps)||maximumSpreadBps<=0||spread>maximumSpreadBps)
    throw new Error('MONEY_FORWARD_QUOTE_SPREAD_EXCEEDED');
}
export function makeMoneyForwardPrediction(input:Readonly<{
  candidate:MoneyStrategyCandidate;predictionId:string;direction:MoneyForwardPrediction['direction'];
  decisionAt:string;createdAt:string;informationCutoff:string;entry:MoneyForwardQuote;
  informationEvidenceIds:readonly string[];sourceRightsEvidenceId:string;maximumEntrySpreadBps:number;
}>):MoneyForwardPrediction {
  assertMoneyStrategyCandidate(input.candidate);
  const cutoff=time(input.informationCutoff,'MONEY_FORWARD_CUTOFF_INVALID');
  const decision=time(input.decisionAt,'MONEY_FORWARD_DECISION_INVALID');
  const created=time(input.createdAt,'MONEY_FORWARD_CREATED_INVALID');
  if(!input.predictionId.trim()||!input.sourceRightsEvidenceId.trim()||
     !input.informationEvidenceIds.length||input.informationEvidenceIds.some(x=>!x.trim())||
     new Set(input.informationEvidenceIds).size!==input.informationEvidenceIds.length||
     cutoff>decision||decision>created||input.entry.instrumentId!==input.candidate.instrumentId||
     !['LONG_BIAS','SHORT_BIAS','NO_TRADE'].includes(input.direction))
    throw new Error('MONEY_FORWARD_PREDICTION_INPUT_INVALID');
  validateForwardQuote(input.entry,input.informationCutoff,input.maximumEntrySpreadBps);
  const entryReceived=time(input.entry.receivedAt,'MONEY_FORWARD_ENTRY_RECEIVED_INVALID');
  if(entryReceived>cutoff)throw new Error('MONEY_FORWARD_ENTRY_NOT_KNOWN_AT_DECISION');
  return Object.freeze({predictionId:input.predictionId,candidateId:input.candidate.candidateId,
    candidateHash:input.candidate.candidateHash,instrumentId:input.candidate.instrumentId,
    direction:input.direction,decisionAt:input.decisionAt,createdAt:input.createdAt,
    informationCutoff:input.informationCutoff,entry:Object.freeze({...input.entry}),
    informationEvidenceIds:Object.freeze([...input.informationEvidenceIds].sort()),
    sourceRightsEvidenceId:input.sourceRightsEvidenceId,authority:'RESEARCH_ONLY',
    canExecute:false,canAuthorizeLive:false});
}
export function gradeMoneyForwardHorizon(input:Readonly<{
  prediction:MoneyForwardPrediction;horizon:MoneyForwardHorizon;
  exit:MoneyForwardQuote;gradedAt:string;maximumMarkDelayMs:number;
  maximumExitSpreadBps:number;additionalRoundTripCostBps:number;
}>):MoneyForwardGrade {
  const {prediction:p,exit}=input;
  if(p.authority!=='RESEARCH_ONLY'||p.canExecute!==false||p.canAuthorizeLive!==false||
     !p.sourceRightsEvidenceId.trim()||!p.informationEvidenceIds.length||
     !MONEY_FORWARD_HORIZONS.includes(input.horizon)||
     !Number.isSafeInteger(input.maximumMarkDelayMs)||input.maximumMarkDelayMs<0||
     !Number.isFinite(input.additionalRoundTripCostBps)||input.additionalRoundTripCostBps<0)
    throw new Error('MONEY_FORWARD_GRADE_AUTHORITY_OR_POLICY_INVALID');
  const cutoff=time(p.informationCutoff,'MONEY_FORWARD_CUTOFF_INVALID');
  const decision=time(p.decisionAt,'MONEY_FORWARD_DECISION_INVALID');
  const created=time(p.createdAt,'MONEY_FORWARD_CREATED_INVALID');
  if(cutoff>decision||created<decision)throw new Error('MONEY_FORWARD_PREDICTION_CHRONOLOGY_INVALID');
  validateForwardQuote(p.entry,p.informationCutoff,10000);
  const entryAt=time(p.entry.receivedAt,'MONEY_FORWARD_ENTRY_INVALID');
  if(entryAt>cutoff||p.entry.instrumentId!==p.instrumentId)
    throw new Error('MONEY_FORWARD_ENTRY_NOT_POINT_IN_TIME');
  const dueAt=decision+periods[input.horizon];
  const observed=time(exit.observedAt,'MONEY_FORWARD_MARK_TIME_INVALID');
  const graded=time(input.gradedAt,'MONEY_FORWARD_GRADED_TIME_INVALID');
  if(graded<dueAt||observed<dueAt||observed>dueAt+input.maximumMarkDelayMs)
    throw new Error('MONEY_FORWARD_EARLY_OR_STALE_HORIZON');
  validateForwardQuote(exit,input.gradedAt,input.maximumExitSpreadBps);
  if(p.entry.quoteId===exit.quoteId||exit.instrumentId!==p.instrumentId||
     exit.sourceId!==p.entry.sourceId||time(exit.receivedAt,'MONEY_FORWARD_MARK_RECEIVED_INVALID')>graded)
    throw new Error('MONEY_FORWARD_EXIT_IDENTITY_INVALID');
  const midEntry=(p.entry.bid+p.entry.ask)/2;
  const gross=p.direction==='LONG_BIAS'
    ?(exit.bid-p.entry.ask)/p.entry.ask*10000
    :p.direction==='SHORT_BIAS'
    ?(p.entry.bid-exit.ask)/p.entry.bid*10000:0;
  const costBps=p.direction==='NO_TRADE'?0:input.additionalRoundTripCostBps;
  const net=gross-costBps;
  const ev=Object.freeze([...p.informationEvidenceIds,p.sourceRightsEvidenceId,
    p.entry.evidenceId,exit.evidenceId].sort());
  const base={schemaVersion:MONEY_FORWARD_GRADE_SCHEMA,predictionId:p.predictionId,
    candidateId:p.candidateId,candidateHash:p.candidateHash,instrumentId:p.instrumentId,
    horizon:input.horizon,dueAt:new Date(dueAt).toISOString(),gradedAt:input.gradedAt,
    entryQuoteId:p.entry.quoteId,exitQuoteId:exit.quoteId,grossReturnBps:gross,costBps,
    netReturnBps:net,markLagMs:observed-dueAt,
    entrySpreadBps:(p.entry.ask-p.entry.bid)/midEntry*10000,
    exitSpreadBps:(exit.ask-exit.bid)/((exit.ask+exit.bid)/2)*10000,
    evidenceIds:ev,proof:'FORWARD_PAPER_EVIDENCE_ONLY' as const,
    authority:'LEARNING_ONLY' as const,canExecute:false as const,canAuthorizeLive:false as const};
  const gradeHash=digest(base);
  return Object.freeze({...base,gradeId:'money-forward:'+gradeHash,gradeHash});
}
export function assertMoneyForwardGrade(grade:MoneyForwardGrade):void{
  const {gradeId,gradeHash,...payload}=grade;
  if(grade.schemaVersion!==MONEY_FORWARD_GRADE_SCHEMA||
     grade.authority!=='LEARNING_ONLY'||grade.canExecute!==false||
     grade.canAuthorizeLive!==false||gradeHash!==digest(payload)||
     gradeId!=='money-forward:'+gradeHash)
    throw new Error('MONEY_FORWARD_GRADE_TAMPERED');
}
