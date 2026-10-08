import test from 'node:test';
import assert from 'node:assert/strict';
import {assertProposalEligible} from './decision-workflow-contracts.js';
import {registerMoneyStrategy} from './money-finish-strategy-factory.js';
import {voteMakeItMakeSense,reviewMoneyStrategyWithMims,
  type MoneyMarketIqClaim,type MoneyResearchEvidence,type MoneyResearchSourceArtifact
} from './money-finish-market-iq-mims.js';
const cutoff='2026-10-08T19:00:00Z';
const evidence:MoneyResearchEvidence[]=[
  {evidenceId:'price:trend',claimId:'trend:1',sourceId:'licensed:price',observedAt:'2026-10-08T18:00:00Z',
    availableAt:'2026-10-08T18:00:01Z',direction:'SUPPORTS',strength:'DIRECT',
    status:'VERIFIED',rights:'RESEARCH_ALLOWED',provenanceHash:'price:sha'},
  {evidenceId:'filing:sector',claimId:'trend:1',sourceId:'official:filing',
    observedAt:'2026-10-08T17:00:00Z',availableAt:'2026-10-08T17:01:00Z',
    direction:'SUPPORTS',strength:'INDIRECT',status:'VERIFIED',
    rights:'RESEARCH_ALLOWED',provenanceHash:'filing:sha'},
  {evidenceId:'history:base',claimId:'trend:1',sourceId:'official:filing',
    observedAt:'2026-10-08T17:00:00Z',availableAt:'2026-10-08T17:01:00Z',
    direction:'SUPPORTS',strength:'INDIRECT',status:'VERIFIED',
    rights:'RESEARCH_ALLOWED',provenanceHash:'base:sha'}
];
const claim:MoneyMarketIqClaim={
  claimId:'trend:1',
  statement:'A validated technical trend might persist after a confirmed breakout',
  assumptions:['quote timestamps are authentic','trading cost models remain conservative'],
  causalSteps:[{from:'verified-trend',to:'continuation-possibility',evidenceId:'price:trend'}],
  alternativeExplanations:['trend could be mean reversion','momentum could be macro news'],
  baseRate:{probability:0.5,sourceEvidenceId:'history:base'},
  claimEvidenceIds:evidence.map(e=>e.evidenceId),contradictions:[],
  incentives:['trend-followers respond to momentum','liquidity suppliers may fade rallies']
};
const candidate=registerMoneyStrategy({
  candidateId:'trend:v1',strategyFamily:'TREND',asset:'STOCK',instrumentId:'stock:TEST',
  methodologyVersion:'trend-research-1',sourceSchema:'MONEY-FINISH-08',
  sourceEvidenceIds:['feed:rights','indicator:proof'],
  informationCutoff:'2026-10-08T17:00:00Z',createdAt:'2026-10-08T18:00:00Z',
  parameters:{smaFast:20,smaSlow:50},maximumDevelopmentTrials:10
});
const artifact:MoneyResearchSourceArtifact={
  artifactId:'signal:1',kind:'SIGNAL_LEAGUE',instrumentId:'stock:TEST',
  informationCutoff:'2026-10-08T18:55:00Z',evidenceHash:'indicator:hash',
  evidenceIds:['licensed:quote','indicator:proof'],authority:'RESEARCH_ONLY',
  canExecute:false,canAuthorizeLive:false
};
const reviewInput={candidate,artifact,claim,evidence,informationCutoff:cutoff,
  createdAt:'2026-10-08T19:00:01Z',reviewedBy:'Jhadina Market-IQ',
  hardRiskGate:'PASS' as const,dataRights:'VERIFIED' as const};
test('FINISH.12 coherent and supported is STILL not true or executable',()=>{
  const vote=voteMakeItMakeSense({claim,evidence,informationCutoff:cutoff});
  assert.equal(vote.coherence,'COHERENT');
  assert.equal(vote.empiricalSupport,'SUPPORTED');
  assert.equal(vote.truthStatus,'NOT_ESTABLISHED');
  assert.equal(vote.independentVerifiedSources,2);
  assert.equal(vote.canExecute,false);
  const reviewed=reviewMoneyStrategyWithMims(reviewInput);
  assert.equal(reviewed.disposition,'RESEARCH_ONLY');
  assert.equal(reviewed.decisionAssessment.authorityStatus,'NONE');
  assert.equal(reviewed.decisionAssessment.calibrationStatus,'NOT_CERTIFIED');
  assert.equal(reviewed.canAuthorizeLive,false);
  assert.throws(()=>assertProposalEligible(reviewed.decisionAssessment),/NOT_PROPOSAL_ELIGIBLE/);
});
test('FINISH.12 internally coherent theories can be unverified',()=>{
  const unsupported=evidence.map(e=>({...e,status:'UNVERIFIED' as const}));
  const vote=voteMakeItMakeSense({claim,evidence:unsupported,informationCutoff:cutoff});
  assert.equal(vote.coherence,'COHERENT');assert.equal(vote.empiricalSupport,'UNVERIFIED');
  assert.equal(vote.truthStatus,'NOT_ESTABLISHED');
  const review=reviewMoneyStrategyWithMims({...reviewInput,evidence:unsupported});
  assert.equal(review.disposition,'BLOCKED');
});
test('FINISH.12 contradictory evidence or circular causality cannot pass review',()=>{
  const contrary=evidence.map(e=>e.evidenceId==='filing:sector'
    ? {...e,direction:'CHALLENGES' as const}:e);
  const disputed=voteMakeItMakeSense({claim,evidence:contrary,informationCutoff:cutoff});
  assert.equal(disputed.empiricalSupport,'CONTESTED');
  const cyclic=voteMakeItMakeSense({claim:{...claim,causalSteps:[
    {from:'A',to:'B',evidenceId:'price:trend'},
    {from:'B',to:'A',evidenceId:'filing:sector'}]},evidence,informationCutoff:cutoff});
  assert.equal(cyclic.coherence,'CONTRADICTORY');
  const contradiction=voteMakeItMakeSense({claim:{...claim,contradictions:[
    {contradictionId:'c1',description:'source dispute',evidenceIds:['price:trend','filing:sector']}]},
    evidence,informationCutoff:cutoff});
  assert.equal(contradiction.coherence,'CONTRADICTORY');
});
test('FINISH.12 rejects future or unlicensed evidence without hiding its uncertainty',()=>{
  assert.throws(()=>voteMakeItMakeSense({claim,evidence:[...evidence.slice(0,1),
    {...evidence[1]!,availableAt:'2026-10-09T00:00:00Z'},evidence[2]!],
    informationCutoff:cutoff}),/FUTURE_CONFLICT_OR_SOURCE_INVALID/);
  const unknown=evidence.map(e=>e.evidenceId==='price:trend'
    ? {...e,rights:'UNKNOWN' as const}:e);
  const vote=voteMakeItMakeSense({claim,evidence:unknown,informationCutoff:cutoff});
  assert.ok(vote.epistemicReasons.includes('UNVERIFIED_OR_UNLICENSED_EVIDENCE'));
  assert.throws(()=>voteMakeItMakeSense({claim:{...claim,
    baseRate:{probability:1.5,sourceEvidenceId:'history:base'}},evidence,
    informationCutoff:cutoff}),/BASE_RATE_INVALID/);
  assert.throws(()=>voteMakeItMakeSense({claim:{...claim,claimEvidenceIds:['not-found']},
    evidence,informationCutoff:cutoff}),/CLAIM_EVIDENCE_UNRESOLVED/);
});
test('FINISH.12 hard risk, data rights, source authority and future artifact are immutable blockers',()=>{
  assert.equal(reviewMoneyStrategyWithMims({...reviewInput,hardRiskGate:'FAIL'}).disposition,'BLOCKED');
  assert.equal(reviewMoneyStrategyWithMims({...reviewInput,dataRights:'UNVERIFIED'}).disposition,'BLOCKED');
  assert.throws(()=>reviewMoneyStrategyWithMims({...reviewInput,artifact:{
    ...artifact,canExecute:true as false}}),/SOURCE_OR_CHRONOLOGY_INVALID/);
  assert.throws(()=>reviewMoneyStrategyWithMims({...reviewInput,artifact:{
    ...artifact,informationCutoff:'2026-10-09T00:00:00Z'}}),/SOURCE_OR_CHRONOLOGY_INVALID/);
  assert.throws(()=>reviewMoneyStrategyWithMims({...reviewInput,candidate:{
    ...candidate,parameters:{smaFast:999,smaSlow:50}}}),/CANDIDATE_TAMPERED/);
});
test('FINISH.12 a holdout grade must be bound to exact candidate and artifact hash',()=>{
  const blocked=reviewMoneyStrategyWithMims({...reviewInput,artifact:{
    ...artifact,kind:'HOLDOUT_GRADE'}});
  assert.equal(blocked.disposition,'BLOCKED');
  assert.ok(blocked.reasons.includes('HOLDOUT_GRADE_UNBOUND'));
});
