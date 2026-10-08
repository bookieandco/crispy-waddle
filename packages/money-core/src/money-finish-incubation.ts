import {createHash} from 'node:crypto';
import {assertMoneyStrategyCandidate,type MoneyStrategyCandidate} from './money-finish-strategy-factory.js';
import type {MoneyMimsResearchReview} from './money-finish-market-iq-mims.js';
import type {StrategyLearningRecord} from './autonomous-strategy-learning.js';

export const MONEY_INCUBATION_SCHEMA='MONEY-FINISH-13' as const;
export type MoneyIncubationState='REGISTERED'|'INCUBATING'|'PAPER_OBSERVE'|'PAPER_PAUSED'|'REJECTED';
export type MoneyIncubationAction='START_INCUBATION'|'START_PAPER_OBSERVATION'|'PAUSE'|'REJECT'|'REQUEST_REVIEW'|'RESUME_AFTER_REVIEW';
export type MoneyIncubationReceipt=Readonly<{
  schemaVersion:typeof MONEY_INCUBATION_SCHEMA;receiptId:string;candidateId:string;candidateHash:string;
  sequence:number;previousHash:string;state:MoneyIncubationState;lastAction:MoneyIncubationAction|null;
  at:string;reasonCodes:readonly string[];evidenceIds:readonly string[];hash:string;
  authority:'RESEARCH_STATE_ONLY';canExecute:false;canAuthorizeLive:false;
}>;
export type MoneyIncubationHealth=Readonly<{
  action:'KEEP_OBSERVING'|'PAUSE';reasonCodes:readonly string[];
  observedRuns:number;netReturnBps:number;maximumDrawdownBps:number;consecutiveLosingRuns:number;
  proof:'RESEARCH_MONITOR_ONLY';canExecute:false;canAuthorizeLive:false;
}>;
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function time(v:string,code:string):number{
  const n=Date.parse(v);
  if(!v||!Number.isFinite(n))throw new Error(code);
  return n;
}
function assertIds(ids:readonly string[],code:string) {
  if(!ids.length||ids.some(id=>!id.trim())||new Set(ids).size!==ids.length)throw new Error(code);
}
export function initializeMoneyIncubation(candidate:MoneyStrategyCandidate,at:string):MoneyIncubationReceipt {
  assertMoneyStrategyCandidate(candidate);
  if(time(at,'MONEY_INCUBATION_INIT_TIME_INVALID')<time(candidate.createdAt,'MONEY_INCUBATION_CANDIDATE_TIME_INVALID'))
    throw new Error('MONEY_INCUBATION_CANDIDATE_FUTURE');
  const record={schemaVersion:MONEY_INCUBATION_SCHEMA,receiptId:'incubation:'+candidate.candidateHash,
    candidateId:candidate.candidateId,candidateHash:candidate.candidateHash,
    sequence:0,previousHash:'GENESIS',state:'REGISTERED' as const,lastAction:null,
    at,reasonCodes:Object.freeze(['NOT_COMMISSIONED']),evidenceIds:Object.freeze([...candidate.sourceEvidenceIds].sort()),
    authority:'RESEARCH_STATE_ONLY' as const,canExecute:false as const,canAuthorizeLive:false as const};
  return Object.freeze({...record,hash:digest(record)});
}
export function assertIncubationReceipt(receipt:MoneyIncubationReceipt):void {
  const {hash,...data}=receipt;
  if(receipt.schemaVersion!==MONEY_INCUBATION_SCHEMA||receipt.authority!=='RESEARCH_STATE_ONLY'||
     receipt.canExecute!==false||receipt.canAuthorizeLive!==false||hash!==digest(data))
    throw new Error('MONEY_INCUBATION_RECEIPT_TAMPERED');
}
export function transitionMoneyIncubation(input:Readonly<{
  previous:MoneyIncubationReceipt;candidate:MoneyStrategyCandidate;action:MoneyIncubationAction;
  at:string;reasonCodes:readonly string[];evidenceIds:readonly string[];
  review?:MoneyMimsResearchReview;
  sourcesVerified:boolean;durableStoreReadbackVerified:boolean;
  originalShadowStoreRecovered:boolean;completedRealPaperCycles:number;
  humanReviewApproved:boolean;
}>):MoneyIncubationReceipt {
  assertIncubationReceipt(input.previous);assertMoneyStrategyCandidate(input.candidate);
  if(input.candidate.candidateHash!==input.previous.candidateHash||
     input.candidate.candidateId!==input.previous.candidateId)
    throw new Error('MONEY_INCUBATION_IDENTITY_MISMATCH');
  if(time(input.at,'MONEY_INCUBATION_TRANSITION_TIME_INVALID')<=
     time(input.previous.at,'MONEY_INCUBATION_PREVIOUS_TIME_INVALID'))
    throw new Error('MONEY_INCUBATION_TIME_NOT_MONOTONE');
  assertIds(input.evidenceIds,'MONEY_INCUBATION_EVIDENCE_REQUIRED');
  if(input.reasonCodes.some(x=>!x.trim()))throw new Error('MONEY_INCUBATION_REASON_INVALID');
  const state=input.previous.state;
  let next:MoneyIncubationState;
  switch(input.action){
    case 'START_INCUBATION':
      if(state!=='REGISTERED')throw new Error('MONEY_INCUBATION_TRANSITION_DENIED');
      if(!input.review||input.review.disposition!=='RESEARCH_ONLY'||
         input.review.candidateHash!==input.candidate.candidateHash||
         input.review.canExecute!==false||input.review.canAuthorizeLive!==false||
         input.review.informationCutoff>input.at)
        throw new Error('MONEY_INCUBATION_MIMS_GATE_REQUIRED');
      next='INCUBATING';break;
    case 'START_PAPER_OBSERVATION':
      if(state!=='INCUBATING'||!input.sourcesVerified||!input.durableStoreReadbackVerified||
         !input.originalShadowStoreRecovered||
         !Number.isSafeInteger(input.completedRealPaperCycles)||input.completedRealPaperCycles<3)
        throw new Error('MONEY_INCUBATION_COMMISSIONING_PROOF_REQUIRED');
      next='PAPER_OBSERVE';break;
    case 'PAUSE':
      if(state==='REJECTED')throw new Error('MONEY_INCUBATION_REJECTED_TERMINAL');
      next='PAPER_PAUSED';break;
    case 'REJECT':
      next='REJECTED';break;
    case 'REQUEST_REVIEW':
      if(state!=='PAPER_PAUSED'||!input.humanReviewApproved)
        throw new Error('MONEY_INCUBATION_HUMAN_REVIEW_REQUIRED');
      next='PAPER_PAUSED';break;
    case 'RESUME_AFTER_REVIEW':
      // Deliberately return to incubation, not auto-trading or automatic paper orders.
      if(state!=='PAPER_PAUSED'||input.previous.lastAction!=='REQUEST_REVIEW'||
         !input.humanReviewApproved||!input.sourcesVerified||
         !input.durableStoreReadbackVerified||!input.originalShadowStoreRecovered)
        throw new Error('MONEY_INCUBATION_EXPLICIT_RESUME_REQUIRED');
      next='INCUBATING';break;
    default:throw new Error('MONEY_INCUBATION_ACTION_UNKNOWN');
  }
  const record={schemaVersion:MONEY_INCUBATION_SCHEMA,receiptId:input.previous.receiptId,
    candidateId:input.previous.candidateId,candidateHash:input.previous.candidateHash,
    sequence:input.previous.sequence+1,previousHash:input.previous.hash,state:next,
    lastAction:input.action,at:input.at,reasonCodes:Object.freeze([...input.reasonCodes].sort()),
    evidenceIds:Object.freeze([...input.evidenceIds].sort()),
    authority:'RESEARCH_STATE_ONLY' as const,canExecute:false as const,canAuthorizeLive:false as const};
  return Object.freeze({...record,hash:digest(record)});
}
export function assessMoneyIncubationHealth(input:Readonly<{
  candidate:MoneyStrategyCandidate;state:MoneyIncubationReceipt;
  records:readonly StrategyLearningRecord[];
  asOf:string;latestFeedAt:string;maxFeedAgeMs:number;
  providerHealth:'HEALTHY'|'DEGRADED'|'DOWN'|'UNKNOWN';
  durableStoreHealth:'READBACK_VERIFIED'|'UNAVAILABLE'|'DIVERGED';
  unresolvedPaperOutcomes:number;
  minimumRuns:number;rollingWindow:number;
  maximumDrawdownBps:number;maximumConsecutiveLosses:number;
  maximumAbsSlippageBps:number;minimumFillRateBps:number;
}>):MoneyIncubationHealth {
  assertMoneyStrategyCandidate(input.candidate);assertIncubationReceipt(input.state);
  if(input.candidate.candidateHash!==input.state.candidateHash)
    throw new Error('MONEY_INCUBATION_HEALTH_CANDIDATE_MISMATCH');
  const at=time(input.asOf,'MONEY_INCUBATION_HEALTH_ASOF_INVALID');
  const feed=time(input.latestFeedAt,'MONEY_INCUBATION_HEALTH_FEED_INVALID');
  if(!Number.isSafeInteger(input.maxFeedAgeMs)||input.maxFeedAgeMs<=0||
     !Number.isSafeInteger(input.minimumRuns)||input.minimumRuns<2||
     !Number.isSafeInteger(input.rollingWindow)||input.rollingWindow<input.minimumRuns||
     !Number.isFinite(input.maximumDrawdownBps)||input.maximumDrawdownBps<=0||
     !Number.isSafeInteger(input.maximumConsecutiveLosses)||input.maximumConsecutiveLosses<1||
     !Number.isFinite(input.maximumAbsSlippageBps)||input.maximumAbsSlippageBps<0||
     !Number.isFinite(input.minimumFillRateBps)||input.minimumFillRateBps<0||
     input.minimumFillRateBps>10000||!Number.isSafeInteger(input.unresolvedPaperOutcomes)||
     input.unresolvedPaperOutcomes<0)
    throw new Error('MONEY_INCUBATION_HEALTH_POLICY_INVALID');
  const reasons:string[]=[];
  if(input.state.state!=='PAPER_OBSERVE')reasons.push('STRATEGY_NOT_ACTIVE_FOR_PAPER_OBSERVATION');
  if(input.providerHealth!=='HEALTHY')reasons.push('PROVIDER_NOT_HEALTHY');
  if(input.durableStoreHealth!=='READBACK_VERIFIED')reasons.push('PERSISTENCE_NOT_VERIFIED');
  if(feed>at||at-feed>input.maxFeedAgeMs)reasons.push('MARKET_FEED_UNAVAILABLE_OR_STALE');
  if(input.unresolvedPaperOutcomes>0)reasons.push('OVERDUE_OR_UNRESOLVED_PAPER_OUTCOME');
  let prev=-Infinity;const seen=new Set<string>();
  for(const rec of input.records){
    const observed=time(rec.evaluatedAt,'MONEY_INCUBATION_LEARNING_TIME_INVALID');
    if(rec.strategyId!==input.candidate.candidateId||rec.authority!=='LEARNING_ONLY'||
       rec.canAuthorizeLive!==false||!rec.evidenceIds.length||
       !rec.paperRunId.trim()||seen.has(rec.paperRunId)||observed<=prev||observed>at||
       [rec.returnBps,rec.fillRateBps,rec.slippageBps].some(x=>!Number.isFinite(x)))
      throw new Error('MONEY_INCUBATION_LEARNING_PROVENANCE_INVALID');
    seen.add(rec.paperRunId);prev=observed;
  }
  const window=input.records.slice(-input.rollingWindow);
  if(window.length<input.minimumRuns)reasons.push('MINIMUM_PAPER_SAMPLE_NOT_MET');
  let cumulative=0,peak=0,drawdown=0,lossStreak=0,maxStreak=0;
  for(const rec of window){
    cumulative+=rec.returnBps;peak=Math.max(peak,cumulative);
    drawdown=Math.max(drawdown,peak-cumulative);
    lossStreak=rec.returnBps<0?lossStreak+1:0;
    maxStreak=Math.max(maxStreak,lossStreak);
    if(Math.abs(rec.slippageBps)>input.maximumAbsSlippageBps)reasons.push('SLIPPAGE_LIMIT_EXCEEDED');
    if(rec.fillRateBps<input.minimumFillRateBps)reasons.push('PAPER_FILL_QUALITY_LOW');
  }
  if(drawdown>=input.maximumDrawdownBps)reasons.push('ROLLING_DRAWDOWN_LIMIT');
  if(maxStreak>=input.maximumConsecutiveLosses)reasons.push('CONSECUTIVE_PAPER_LOSSES');
  const reasonCodes=Object.freeze([...new Set(reasons)].sort());
  return Object.freeze({action:reasonCodes.length?'PAUSE':'KEEP_OBSERVING',reasonCodes,
    observedRuns:window.length,netReturnBps:cumulative,maximumDrawdownBps:drawdown,
    consecutiveLosingRuns:maxStreak,proof:'RESEARCH_MONITOR_ONLY',
    canExecute:false,canAuthorizeLive:false});
}
