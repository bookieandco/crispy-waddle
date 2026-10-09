import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewMoneyPortableIndependentEvidence} from './money-portable-independent-review.js';
import type {MoneyPortableProof,MoneyForwardOnlyFeed} from './money-forward-only-commissioning.js';

const SHA='a'.repeat(40),T='2026-10-08T12:00:00Z';
const runtime:MoneyPortableProof={
  expectedMainSha:SHA,deployedSha:SHA,deployedEnvironment:'production',
  memoryProvider:'HOMEBASE_POSTGRES',gatewayHealthStatus:200,
  persistentHostEvidenceId:'host:proven',verifiedHostMountId:'mount:one',
  restartReadbackEvidenceId:'reboot:proof',emptyNewJournalReadbackId:'empty:proof',
  separateForwardNamespaceId:'forward:2026-10',
  swlcAuditIssueId:'1110',supabaseMode:'DEFERRED_AUDIT_REPAIR'
};
const feeds:MoneyForwardOnlyFeed[]=(['STOCK','FOREX','OPTIONS','METALS'] as const)
  .map(asset=>({
    asset,providerId:'vendor:'+asset,entitlementEvidenceId:'license:'+asset,
    observedAt:'2026-10-08T11:00:00Z',availableAt:'2026-10-08T11:00:01Z',
    receivedAt:'2026-10-08T11:00:02Z',observationEvidenceId:'provider:'+asset,
    origin:'LICENSED_READ_ONLY',settlementAndAdjustmentsVerified:true
  }));
const base={
  asOf:T,lineageStartAt:'2026-10-08T00:00:00Z',
  runtime,feeds,quotes:[],grades:[],journal:null,cycles:[],
  priorShadowRowsImported:false,liveOrdersDisabled:true,
  host:{beforeBootId:'boot:before',afterBootId:'boot:after',
    canarySha256Before:'a'.repeat(64),canarySha256After:'a'.repeat(64),
    mountReviewEvidenceId:'mount:review',independentBackupRestoreEvidenceId:'independent:restore'}
} as const;
test('PORTABLE.6 empty real-market history never qualifies as operations-ready or FINAL',()=>{
 const x=reviewMoneyPortableIndependentEvidence(base);
 assert.equal(x.state,'BLOCKED');
 assert.equal(x.finalCertification,'NOT_ISSUED');
 assert.equal(x.paperWorkerOperationallyCertified,false);
 assert.equal(x.historicalShadowRecovered,false);
 assert.equal(x.canExecute,false);
 assert.ok(x.reasonCodes.includes('REAL_SIX_HORIZON_THREE_CYCLE_EVIDENCE_INCOMPLETE'));
});
test('PORTABLE.6 host without actual independent reboot and offsite restore blocks',()=>{
 const x=reviewMoneyPortableIndependentEvidence({...base,
   host:{...base.host,afterBootId:base.host.beforeBootId,
     independentBackupRestoreEvidenceId:''}});
 assert.equal(x.hostReadbackChecked,false);
 assert.ok(x.reasonCodes.includes('INDEPENDENT_HOST_RESTART_AND_BACKUP_NOT_PROVEN'));
});
test('PORTABLE.6 no external licensed options cannot be mislabeled as full operating',()=>{
 const x=reviewMoneyPortableIndependentEvidence({...base,
   feeds:feeds.filter(f=>f.asset!=='OPTIONS')});
 assert.equal(x.allAssetsObserved,false);
 assert.ok(x.reasonCodes.includes('ALL_ASSET_CLASSES_NOT_LICENSED'));
 assert.ok(x.reasonCodes.includes('REQUIRED_FEED_MISSING:OPTIONS'));
});
test('PORTABLE.6 authority is evidence-only and immutable regardless of runtime evidence assertions',()=>{
 const x=reviewMoneyPortableIndependentEvidence(base);
 assert.equal(x.authority,'EVIDENCE_ONLY');
 assert.equal(x.canAuthorizeLive,false);
 assert.equal(x.scope,'NEW_FORWARD_ONLY_PAPER_NOT_ORIGINAL_SHADOW');
 assert.ok(/^[a-f0-9]{64}$/.test(x.sourceHash));
});
