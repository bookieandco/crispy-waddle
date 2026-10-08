import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeMoneyIncubation,transitionMoneyIncubation,assessMoneyIncubationHealth,
  assertIncubationReceipt} from './money-finish-incubation.js';
import {registerMoneyStrategy} from './money-finish-strategy-factory.js';
import type {MoneyMimsResearchReview} from './money-finish-market-iq-mims.js';
import type {StrategyLearningRecord} from './autonomous-strategy-learning.js';

const candidate=registerMoneyStrategy({
  candidateId:'incubate:FX:1',strategyFamily:'FX_SUPERVISED',asset:'FOREX',
  instrumentId:'fx:EURUSD',methodologyVersion:'v1',sourceSchema:'MONEY-FINISH-10',
  sourceEvidenceIds:['source:fixture'],informationCutoff:'2026-10-01T09:00:00Z',
  createdAt:'2026-10-01T10:00:00Z',parameters:{lookback:20},maximumDevelopmentTrials:3
});
const root=initializeMoneyIncubation(candidate,'2026-10-01T11:00:00Z');
const review={disposition:'RESEARCH_ONLY',candidateHash:candidate.candidateHash,
  canExecute:false,canAuthorizeLive:false,
  informationCutoff:'2026-10-01T10:00:00Z'} as MoneyMimsResearchReview;
const base={candidate,sourcesVerified:true,durableStoreReadbackVerified:true,
  originalShadowStoreRecovered:true,completedRealPaperCycles:3,
  humanReviewApproved:false,reasonCodes:['paper:receipt'],evidenceIds:['audit:receipt']};
const incubating=()=>transitionMoneyIncubation({
  ...base,previous:root,action:'START_INCUBATION',at:'2026-10-01T12:00:00Z',review
});
const paper=()=>transitionMoneyIncubation({...base,previous:incubating(),
  action:'START_PAPER_OBSERVATION',at:'2026-10-01T13:00:00Z'});
test('FINISH.13 starts only from authentic candidate and MIMS research review',()=>{
  assert.equal(root.state,'REGISTERED');
  assert.equal(incubating().state,'INCUBATING');
  assert.equal(paper().state,'PAPER_OBSERVE');
  assert.equal(paper().canAuthorizeLive,false);
  assert.throws(()=>assertIncubationReceipt({...paper(),state:'REJECTED'}),/RECEIPT_TAMPERED/);
  assert.throws(()=>transitionMoneyIncubation({...base,previous:root,action:'START_INCUBATION',
    at:'2026-10-01T12:00:00Z'}),/MIMS_GATE_REQUIRED/);
});
test('FINISH.13 no paper state without authenticated data, durable readback, original recovery, and cycles',()=>{
  for(const override of [
    {sourcesVerified:false},{durableStoreReadbackVerified:false},
    {originalShadowStoreRecovered:false},{completedRealPaperCycles:2}
  ]) assert.throws(()=>transitionMoneyIncubation({...base,...override,previous:incubating(),
    action:'START_PAPER_OBSERVATION',at:'2026-10-01T13:00:00Z'}),/COMMISSIONING_PROOF_REQUIRED/);
  assert.throws(()=>transitionMoneyIncubation({...base,previous:root,
    action:'START_PAPER_OBSERVATION',at:'2026-10-01T13:00:00Z'}),/COMMISSIONING_PROOF_REQUIRED/);
});
test('FINISH.13 pause latches; no auto restart without separate human review',()=>{
  const paused=transitionMoneyIncubation({...base,previous:paper(),action:'PAUSE',
    at:'2026-10-01T14:00:00Z',reasonCodes:['STALE_PROVIDER']});
  assert.equal(paused.state,'PAPER_PAUSED');
  assert.throws(()=>transitionMoneyIncubation({...base,previous:paused,
    action:'RESUME_AFTER_REVIEW',at:'2026-10-01T15:00:00Z'}),/EXPLICIT_RESUME_REQUIRED/);
  const reviewed=transitionMoneyIncubation({...base,humanReviewApproved:true,
    previous:paused,action:'REQUEST_REVIEW',at:'2026-10-01T15:00:00Z'});
  const resumed=transitionMoneyIncubation({...base,humanReviewApproved:true,
    previous:reviewed,action:'RESUME_AFTER_REVIEW',at:'2026-10-01T16:00:00Z'});
  assert.equal(resumed.state,'INCUBATING');
  assert.equal(resumed.previousHash,reviewed.hash);
  assert.throws(()=>transitionMoneyIncubation({...base,previous:resumed,
    action:'START_INCUBATION',at:'2026-10-01T17:00:00Z'}),/TRANSITION_DENIED/);
});
const mk=(i:number,ret:number):StrategyLearningRecord=>({
  learningRecordId:'lr:'+i,domain:'FOREX',strategyId:candidate.candidateId,
  scenarioId:'paper:1',paperRunId:'run:'+i,strategyResultId:'result:'+i,
  returnBps:ret,fillRateBps:9500,slippageBps:4,feesPaidMinor:'10',
  outcomeScore:ret/10000,executionQuality:.9,evidenceIds:['ledger:'+i],
  evaluatedAt:new Date(Date.UTC(2026,9,2,i)).toISOString(),
  authority:'LEARNING_ONLY',canAuthorizeLive:false
});
const healthInput={candidate,state:paper(),records:[mk(1,10),mk(2,12),mk(3,7)],
  asOf:'2026-10-02T06:00:00Z',latestFeedAt:'2026-10-02T05:59:00Z',
  maxFeedAgeMs:120000,providerHealth:'HEALTHY' as const,
  durableStoreHealth:'READBACK_VERIFIED' as const,unresolvedPaperOutcomes:0,
  minimumRuns:3,rollingWindow:5,maximumDrawdownBps:150,
  maximumConsecutiveLosses:3,maximumAbsSlippageBps:20,minimumFillRateBps:8000};
test('FINISH.13 healthy paper observations remain strictly non-executing',()=>{
 const out=assessMoneyIncubationHealth(healthInput);
 assert.equal(out.action,'KEEP_OBSERVING');
 assert.equal(out.netReturnBps,29);
 assert.equal(out.canExecute,false);
});
test('FINISH.13 real safety deterioration forces pause and does not excuse incomplete coverage',()=>{
 const bad=assessMoneyIncubationHealth({...healthInput,providerHealth:'DOWN',
   durableStoreHealth:'DIVERGED',unresolvedPaperOutcomes:2,
   latestFeedAt:'2026-10-01T00:00:00Z',records:[mk(1,-80),mk(2,-80),mk(3,-80)]});
 assert.equal(bad.action,'PAUSE');
 assert.ok(bad.reasonCodes.includes('PROVIDER_NOT_HEALTHY'));
 assert.ok(bad.reasonCodes.includes('PERSISTENCE_NOT_VERIFIED'));
 assert.ok(bad.reasonCodes.includes('OVERDUE_OR_UNRESOLVED_PAPER_OUTCOME'));
 assert.ok(bad.reasonCodes.includes('CONSECUTIVE_PAPER_LOSSES'));
 assert.ok(bad.reasonCodes.includes('ROLLING_DRAWDOWN_LIMIT'));
 assert.equal(assessMoneyIncubationHealth({...healthInput,records:[mk(1,10)]}).action,'PAUSE');
});
test('FINISH.13 rejects forged, duplicate, future and reordered learning rows',()=>{
 assert.throws(()=>assessMoneyIncubationHealth({...healthInput,records:[
  mk(1,10),mk(1,10),mk(2,10)]}),/LEARNING_PROVENANCE_INVALID/);
 assert.throws(()=>assessMoneyIncubationHealth({...healthInput,records:[
  mk(2,10),mk(1,10),mk(3,10)]}),/LEARNING_PROVENANCE_INVALID/);
 assert.throws(()=>assessMoneyIncubationHealth({...healthInput,records:[
  mk(1,10),{...mk(2,10),evaluatedAt:'2026-10-09T00:00:00Z'},mk(3,10)]}),
 /LEARNING_PROVENANCE_INVALID/);
});
