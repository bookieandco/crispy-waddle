import test from 'node:test';
import assert from 'node:assert/strict';
import {assessNewMoneyForwardOnly,type MoneyPortableProof,type MoneyForwardOnlyFeed} from './money-forward-only-commissioning.js';
import {registerMoneyStrategy} from './money-finish-strategy-factory.js';
import {makeMoneyForwardPrediction,gradeMoneyForwardHorizon,
  MONEY_FORWARD_HORIZONS,type MoneyForwardQuote,type MoneyForwardHorizon} from './money-finish-forward-grades.js';
import type {MoneyForwardJournalReadback,MoneyPaperCycleEvidence} from './money-finish-forward-journal.js';

const sha='a'.repeat(40),now='2026-10-20T00:00:00Z',start='2026-10-08T00:00:00Z';
const runtime:MoneyPortableProof={
  expectedMainSha:sha,deployedSha:sha,deployedEnvironment:'production',
  memoryProvider:'PORTABLE_OIDC_POSTGRES',gatewayHealthStatus:200,
  persistentHostEvidenceId:'host:non-ephemeral',verifiedHostMountId:'mount:readback',
  restartReadbackEvidenceId:'restart:independent',emptyNewJournalReadbackId:'empty:new:host',
  separateForwardNamespaceId:'forward:2026-10-08',
  swlcAuditIssueId:'1110',supabaseMode:'DEFERRED_AUDIT_REPAIR'
};
const feeds:MoneyForwardOnlyFeed[]=(['STOCK','FOREX','OPTIONS','METALS'] as const)
  .map(asset=>({asset,providerId:'provider:'+asset,entitlementEvidenceId:'rights:'+asset,
    observedAt:'2026-10-09T00:00:00Z',availableAt:'2026-10-09T00:00:01Z',
    receivedAt:'2026-10-09T00:00:02Z',observationEvidenceId:'quote:'+asset,
    origin:'LICENSED_READ_ONLY',settlementAndAdjustmentsVerified:true}));
const base={asOf:now,lineageStartAt:start,runtime,feeds,grades:[],journal:null,cycles:[],
  priorShadowRowsImported:false,liveOrdersDisabled:true} as const;
test('NEW forward-only lane permits independent review of new collection, NOT a FINAL or live authority',()=>{
  const result=assessNewMoneyForwardOnly(base);
  assert.equal(result.state,'COLLECTOR_REVIEW_REQUIRED');
  assert.equal(result.finalCertification,'NOT_ISSUED');
  assert.equal(result.originalShadowRecovered,false);
  assert.equal(result.historicalPerformanceCertified,false);
  assert.equal(result.unattendedPaperCertified,false);
  assert.equal(result.canAuthorizeLive,false);
});
test('SWLC in recovery need not block separately hosted forward-only research but must remain explicitly deferred',()=>{
  assert.ok(!assessNewMoneyForwardOnly(base).reasonCodes.length);
  const result=assessNewMoneyForwardOnly({...base,runtime:{...runtime,
    supabaseMode:'DEFERRED_AUDIT_REPAIR',swlcAuditIssueId:'not-tracked'}});
  assert.equal(result.state,'BLOCKED');
  assert.ok(result.reasonCodes.includes('SWLC_DEFERRAL_NOT_EXPLICIT'));
});
test('volatile memory, absent host readback, stale deployment and fake provider all block',()=>{
  const cases=[
    [{...runtime,memoryProvider:'IN_MEMORY' as const},'INDEPENDENT_DURABLE_MEMORY_NOT_PROVEN'],
    [{...runtime,gatewayHealthStatus:500 as const},'INDEPENDENT_DURABLE_MEMORY_NOT_PROVEN'],
    [{...runtime,deployedSha:'b'.repeat(40)},'EXACT_MAIN_NOT_DEPLOYED'],
    [{...runtime,verifiedHostMountId:''},'PERSISTENT_HOST_AND_FRESH_JOURNAL_UNVERIFIED']
  ] as const;
  for(const [candidate,reason] of cases){
    const out=assessNewMoneyForwardOnly({...base,runtime:candidate});
    assert.equal(out.state,'BLOCKED');assert.ok(out.reasonCodes.includes(reason));
  }
  const fake=assessNewMoneyForwardOnly({...base,feeds:feeds.map((f,i)=>
    i===1?{...f,origin:'SYNTHETIC_FIXTURE' as const}:f)});
  assert.equal(fake.state,'BLOCKED');
  assert.ok(fake.reasonCodes.includes('LICENSED_PROVIDER_NOT_VERIFIED:FOREX'));
});
test('original Shadow records cannot be silently imported and trading authority cannot be upgraded',()=>{
  const result=assessNewMoneyForwardOnly({...base,priorShadowRowsImported:true,
    liveOrdersDisabled:false});
  assert.equal(result.state,'BLOCKED');
  assert.ok(result.reasonCodes.includes('OLD_SHADOW_HISTORY_MUST_NOT_MIX_WITH_NEW_FORWARD_ONLY'));
  assert.ok(result.reasonCodes.includes('LIVE_ORDER_AUTHORITY_NOT_DENIED'));
});
test('future quotes, absent options terms, missing required market class fail closed',()=>{
  const future=assessNewMoneyForwardOnly({...base,
    feeds:feeds.map(f=>f.asset==='OPTIONS'
      ? {...f,receivedAt:'2026-10-22T00:00:00Z',settlementAndAdjustmentsVerified:false}:f)});
  assert.equal(future.state,'BLOCKED');
  assert.ok(future.reasonCodes.includes('FEED_NOT_POINT_IN_TIME:OPTIONS'));
  assert.ok(future.reasonCodes.includes('OPTION_CONTRACT_TERMS_UNVERIFIED'));
  const missing=assessNewMoneyForwardOnly({...base,feeds:feeds.filter(f=>f.asset!=='METALS')});
  assert.ok(missing.reasonCodes.includes('REQUIRED_FEED_MISSING:METALS'));
});
const strategy=registerMoneyStrategy({
  candidateId:'new:forward:test',strategyFamily:'TREND',asset:'STOCK',
  instrumentId:'stock:TEST',methodologyVersion:'fixture-1',sourceSchema:'MONEY-FINISH-08',
  sourceEvidenceIds:['review:evidence'],
  informationCutoff:'2026-10-07T12:00:00Z',createdAt:'2026-10-07T13:00:00Z',
  parameters:{sma:20},maximumDevelopmentTrials:2
});
const dt=(ms:number)=>new Date(ms).toISOString();
const decision=Date.parse('2026-10-09T12:00:00Z');
const entry:MoneyForwardQuote={
  quoteId:'entry:1',instrumentId:'stock:TEST',sourceId:'licensed:source',
  bid:99.8,ask:100.2,observedAt:dt(decision-6000),
  availableAt:dt(decision-5000),receivedAt:dt(decision-4000),
  evidenceId:'source:quote:1',provenanceHash:'quote:hash:1',status:'VERIFIED_READ_ONLY'
};
const prediction=makeMoneyForwardPrediction({
  candidate:strategy,predictionId:'new:prediction:1',direction:'LONG_BIAS',
  decisionAt:dt(decision),createdAt:dt(decision+1000),
  informationCutoff:dt(decision-3000),entry,informationEvidenceIds:['study:receipt'],
  sourceRightsEvidenceId:'licensed:receipt',maximumEntrySpreadBps:100
});
const durations:Record<MoneyForwardHorizon,number>={
  '15m':900000,'1h':3600000,'4h':14400000,'24h':86400000,'3d':259200000,'7d':604800000
};
const grades=MONEY_FORWARD_HORIZONS.map(h=>{
  const due=decision+durations[h];
  return gradeMoneyForwardHorizon({prediction,horizon:h,
    exit:{...entry,quoteId:'exit:'+h,observedAt:dt(due),
      availableAt:dt(due+1000),receivedAt:dt(due+2000),
      evidenceId:'mark:'+h,provenanceHash:'mark:sha:'+h,
      bid:102,ask:102.1},gradedAt:dt(due+3000),
    maximumMarkDelayMs:30000,maximumExitSpreadBps:100,
    additionalRoundTripCostBps:5});
});
const journal:MoneyForwardJournalReadback={
  count:6,tailHash:'event:6',gradeIds:grades.map(g=>g.gradeId),
  eventHashes:['event:1','event:2','event:3','event:4','event:5','event:6'],
  integrity:'HASH_CHAIN_VERIFIED',canExecute:false,canAuthorizeLive:false
};
const cycles:MoneyPaperCycleEvidence[]=[2,4,6].map((count,i)=>({
  cycleId:'paper-cycle:'+count,
  completedAt:dt(Date.parse('2026-10-19T00:00:00Z')+i*3600000),
  journalCount:count,journalTailHash:journal.eventHashes[count-1]!,
  evidenceIds:['independent:cycle:'+count],
  realFeedOrigin:'LICENSED_READ_ONLY',isolatedIndependentReadback:true
}));
test('six horizons and three disjoint advancing cycles stay external-review-only, never certified',()=>{
  const out=assessNewMoneyForwardOnly({...base,grades,journal,cycles});
  assert.equal(out.state,'PAPER_EVIDENCE_REVIEW_REQUIRED');
  assert.equal(out.horizonCoverage.length,6);
  assert.equal(out.finalCertification,'NOT_ISSUED');
  assert.equal(out.canExecute,false);
});
test('non-advancing and synthetic watchdog cycles fail',()=>{
  const duplicated=assessNewMoneyForwardOnly({...base,grades,journal,
    cycles:[cycles[0]!,{...cycles[1]!,journalCount:2},cycles[2]!]});
  assert.equal(duplicated.state,'BLOCKED');
  assert.ok(duplicated.reasonCodes.includes('PAPER_WATCHDOG_NOT_REAL_OR_ADVANCING'));
  const fixture=assessNewMoneyForwardOnly({...base,grades,journal,cycles:cycles.map((c,i)=>
    i===0?{...c,realFeedOrigin:'SYNTHETIC_FIXTURE' as const}:c)});
  assert.equal(fixture.state,'BLOCKED');
});
test('missing immature 7d horizon is never fabricated or called FINAL',()=>{
  const out=assessNewMoneyForwardOnly({...base,grades:grades.slice(0,5),
    journal:{...journal,count:5,gradeIds:journal.gradeIds.slice(0,5),
      eventHashes:journal.eventHashes.slice(0,5),tailHash:'event:5'},
    cycles:[]});
  assert.equal(out.state,'COLLECTOR_REVIEW_REQUIRED');
  assert.ok(!out.horizonCoverage.includes('7d'));
  assert.equal(out.finalCertification,'NOT_ISSUED');
});
