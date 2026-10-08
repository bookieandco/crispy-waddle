import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMoneyFinishFinal,type MoneyFinalRuntimeManifest,
  type MoneyFinalIntegrationManifest} from './money-finish-final-gate.js';
import {registerMoneyStrategy} from './money-finish-strategy-factory.js';
import {makeMoneyForwardPrediction,gradeMoneyForwardHorizon,
  MONEY_FORWARD_HORIZONS,type MoneyForwardQuote,type MoneyForwardHorizon}
  from './money-finish-forward-grades.js';
const date=(ms:number)=>new Date(ms).toISOString();
const oneDay=86400000;
const delays:Record<MoneyForwardHorizon,number>={
 '15m':900000,'1h':3600000,'4h':14400000,'24h':oneDay,
 '3d':3*oneDay,'7d':7*oneDay
};
const sha=(c:string)=>c.repeat(64);
const now='2026-10-13T15:00:00Z';
const integration:MoneyFinalIntegrationManifest={
 expectedHeadSha:'a'.repeat(40),mainHeadSha:'a'.repeat(40),
 rootCiHeadSha:'a'.repeat(40),rootCiRunId:'CI:123',
 rootCiConclusion:'success',
 compilationReceiptHash:sha('b'),
 mergedPullRequests:[1170,1171,1173,1174,1175]
};
const candidate=registerMoneyStrategy({
 candidateId:'money-final-fixture',strategyFamily:'TREND',asset:'STOCK',
 instrumentId:'stock:TEST',methodologyVersion:'model-v1',
 sourceSchema:'MONEY-FINISH-08',sourceEvidenceIds:['source:fixture'],
 informationCutoff:'2026-09-30T12:00:00Z',
 createdAt:'2026-09-30T12:01:00Z',
 parameters:{emaFast:12},maximumDevelopmentTrials:2
});
function fixture(){
 const grades=[];
 for(let cycle=0;cycle<3;cycle++){
   const decision=Date.parse('2026-10-01T00:01:00Z')+cycle*oneDay;
   const q:MoneyForwardQuote={
     quoteId:'entry:'+cycle,instrumentId:'stock:TEST',
     sourceId:'source:licensed-fixture',bid:99.9,ask:100.1,
     observedAt:date(decision-15000),availableAt:date(decision-12000),
     receivedAt:date(decision-10000),evidenceId:'entry:receipt:'+cycle,
     provenanceHash:'entry:hash:'+cycle,status:'VERIFIED_READ_ONLY'
   };
   const p=makeMoneyForwardPrediction({
     candidate,predictionId:'p:'+cycle,direction:'LONG_BIAS',
     decisionAt:date(decision),createdAt:date(decision+1000),
     informationCutoff:date(decision-5000),entry:q,
     informationEvidenceIds:['signal:'+cycle],sourceRightsEvidenceId:'rights:fixture',
     maximumEntrySpreadBps:100
   });
   for(const h of MONEY_FORWARD_HORIZONS){
     const due=decision+delays[h];
     grades.push(gradeMoneyForwardHorizon({prediction:p,horizon:h,
       exit:{...q,quoteId:'exit:'+cycle+':'+h,bid:101+cycle,ask:101.2+cycle,
         observedAt:date(due),availableAt:date(due+1000),receivedAt:date(due+1500),
         evidenceId:'exit:'+cycle+':'+h,provenanceHash:'mark:'+cycle+':'+h},
       gradedAt:date(due+3000),maximumMarkDelayMs:10000,
       maximumExitSpreadBps:100,additionalRoundTripCostBps:4
     }));
   }
 }
 const eventHashes=grades.map((_,i)=>String(i+1).padStart(64,'a'));
 const journal={count:grades.length,gradeIds:grades.map(g=>g.gradeId),
   eventHashes,tailHash:eventHashes.at(-1)!,integrity:'HASH_CHAIN_VERIFIED' as const,
   canExecute:false as const,canAuthorizeLive:false as const};
 const cycles=[6,12,18].map((count,i)=>({
   cycleId:'cycle:'+i,
   completedAt:date(Date.parse('2026-10-11T12:00:00Z')+i*oneDay),
   journalCount:count,journalTailHash:eventHashes[count-1]!,
   evidenceIds:['cycle:evidence:'+i],
   realFeedOrigin:'LICENSED_READ_ONLY' as const,
   isolatedIndependentReadback:true
 }));
 const runtime:MoneyFinalRuntimeManifest={
   paperOnly:true,liveOrdersDisabled:true,
   marketData:{sourceId:'source:licensed-fixture',
     sourceMode:'LICENSED_READ_ONLY',providerHostVerified:true,
     observedAt:'2026-10-13T13:00:00Z',
     receivedAt:'2026-10-13T13:01:00Z',rightsReviewedAt:'2026-10-12T00:00:00Z',
     entitlementEvidenceId:'rights:fixture',
     independentSourceReceiptHash:sha('c')},
   originalShadow:{originalPodId:'pod:historical',
     originalVolumeId:'volume:historical',originalBackupSnapshotId:'restic:original',
     sourceSnapshotSha256:sha('d'),
     encryptedBackupSha256:sha('e'),restoredBackupSha256:sha('e'),
     sourceRowCount:250,restoredRowCount:250,
     sourceHorizonCount:6,restoredHorizonCount:6,
     isolatedRestoreReceiptHash:sha('f'),
     sourceMachineEvidenceId:'pod:owner:receipt',
     independentRestorerEvidenceId:'restorer:separate:receipt',
     recoveredAt:'2026-10-11T08:00:00Z',
     restoredAt:'2026-10-11T09:00:00Z'},
   journal,journalLocation:'HOMEBASE_DURABLE_VOLUME',
   journalIndependentReadbackEvidenceId:'independent:readback:fixture',
   grades,cycles,observedAt:now
 };
 return runtime;
}
const defaults={integration,assessedAt:now,
 minimumCycles:3,maximumHeartbeatGapMs:26*3600000,
 maximumEvidenceAgeMs:4*oneDay};
test('FINISH.15 missing original provenance / backups and data keeps FINAL blocked',()=>{
 const runtime={...fixture(),marketData:null,originalShadow:null,
   journal:null,grades:[],cycles:[],journalLocation:'EPHEMERAL_TEST_RUNNER' as const,
   journalIndependentReadbackEvidenceId:null};
 const result=assessMoneyFinishFinal({...defaults,runtime});
 assert.equal(result.readiness,'BLOCKED');
 assert.equal(result.finalCertification,'NOT_ISSUED');
 assert.ok(result.reasonCodes.includes('ORIGINAL_SHADOW_ISOLATED_RESTORE_NOT_PROVEN'));
 assert.ok(result.reasonCodes.includes('LICENSED_LIVE_READONLY_PROVIDER_UNVERIFIED'));
 assert.ok(result.reasonCodes.includes('MULTICYCLE_WATCHDOG_NOT_PROVEN'));
 assert.equal(result.canExecute,false);
});
test('FINISH.15 fake fully filled STRUCTURAL receipts can only reach external review, never FINAL',()=>{
 const res=assessMoneyFinishFinal({...defaults,runtime:fixture()});
 assert.equal(res.readiness,'EXTERNAL_REVIEW_REQUIRED');
 assert.equal(res.finalCertification,'NOT_ISSUED');
 assert.equal(res.coverage.length,6);
 assert.equal(res.canAuthorizeLive,false);
 assert.equal(res.financialAuthority,'NONE');
});
test('FINISH.15 malformed isolated restore, changed cost grade and heartbeat reuse are refused',()=>{
 const original=fixture();
 const recovery=assessMoneyFinishFinal({...defaults,runtime:{...original,
   originalShadow:{...original.originalShadow!,restoredRowCount:249}}});
 assert.ok(recovery.reasonCodes.includes('ORIGINAL_SHADOW_ISOLATED_RESTORE_NOT_PROVEN'));
 const first=original.grades[0]!;
 const tampered=assessMoneyFinishFinal({...defaults,runtime:{...original,
   grades:[{...first,netReturnBps:0},...original.grades.slice(1)]}});
 assert.ok(tampered.reasonCodes.includes('INVALID_FORWARD_GRADE_PROVENANCE'));
 const stalled=assessMoneyFinishFinal({...defaults,runtime:{...original,
   cycles:[original.cycles[0]!,{...original.cycles[1]!,journalCount:6},original.cycles[2]!] }});
 assert.ok(stalled.reasonCodes.includes('WATCHDOG_CYCLE_ORDER_OR_READBACK_INVALID'));
});
test('FINISH.15 PR stack, exact-head CI, and synthetic market receipts are non-optional',()=>{
 const original=fixture();
 const mismatch=assessMoneyFinishFinal({...defaults,
   integration:{...integration,mainHeadSha:'0'.repeat(40)},
   runtime:original});
 assert.ok(mismatch.reasonCodes.includes('EXACT_MAIN_HEAD_AND_STACKED_CI_UNVERIFIED'));
 const synthetic=assessMoneyFinishFinal({...defaults,runtime:{...original,
   marketData:{...original.marketData!,sourceMode:'SYNTHETIC_FIXTURE'},
   cycles:original.cycles.map(c=>({...c,realFeedOrigin:'SYNTHETIC_FIXTURE'}))}});
 assert.ok(synthetic.reasonCodes.includes('LICENSED_LIVE_READONLY_PROVIDER_UNVERIFIED'));
 assert.ok(synthetic.reasonCodes.includes('SYNTHETIC_OR_UNVERIFIED_WATCHDOG_CYCLE'));
});
