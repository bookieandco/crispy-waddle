import test from 'node:test';
import assert from 'node:assert/strict';
import {assessOriginalShadowRecovery,type OriginalRecoveryGateInput}
  from './shark-history-original-gate.js';
import type {MoneyRecoveryReport} from './money-finish-recovery.js';
const restored:MoneyRecoveryReport={
 paperRunId:'shadow-old',status:'CONTENT_MATCHED_EXTERNAL_CERTIFICATION_REQUIRED',
 sourceIdentity:'runpod-pod+volume:source',isolatedRestoreIdentity:'independent:restore',
 rowCount:4,manifestHash:'b'.repeat(64),reasons:['EXTERNAL_ATTESTATION_REQUIRED'],
 authority:'AUDIT_ONLY',canAuthorizeLive:false,
};
const original:NonNullable<OriginalRecoveryGateInput['artifact']>={
 id:'old-ledger',kind:'ORIGINAL_DB_CANDIDATE',origin:'OWNER_LOCAL',
 sha256:'a'.repeat(64),bytes:4096,sourceRef:'physical-volume:old',
 discoveredAt:'2026-10-08T00:00:00Z',
};
const data:OriginalRecoveryGateInput={
 artifact:original,restore:restored,
 historicalSourcePodId:'source-pod-1',historicalPersistentVolumeId:'source-volume-1',
 sourceVsRestoredSnapshotSha256:'a'.repeat(64),encryptedBackupReceiptId:'restic:snapshot-1',
 verifiedOffsiteReadback:true,historicalLedgerExplicitlyExcludedSynthetic:true,
 restoredOnIndependentHost:true,
};
test('even a fully self-attested original candidate needs independent source audit',()=>{
 const result=assessOriginalShadowRecovery(data);
 assert.deepEqual(result.blockers,[]);
 assert.equal(result.state,'EXTERNAL_SOURCE_AUDIT_REQUIRED');
 assert.equal(result.originalRecovered,false);
 assert.equal(result.mayImportLessons,false);
 assert.equal(result.mayCreateFreshLedger,false);
 assert.equal(result.mayExecute,false);
});
test('missing original candidate cannot be promoted from synthetic fixture or market archive',()=>{
 for(const artifact of [null,{...original,id:'synthetic shadow canary'},
   {...original,kind:'MARKET_ARCHIVE' as const}]){
  const r=assessOriginalShadowRecovery({...data,artifact});
  assert.equal(r.state,'BLOCKED');
  assert.ok(r.blockers.includes('ORIGINAL_SOURCE_CANDIDATE_MISSING'));
 }
});
test('original volume, hashes, encryption and independent row parity are mandatory',()=>{
 const absent=assessOriginalShadowRecovery({
  ...data,historicalSourcePodId:null,historicalPersistentVolumeId:null,
  verifiedOffsiteReadback:false,encryptedBackupReceiptId:null,
  sourceVsRestoredSnapshotSha256:'0'.repeat(64),restore:null,
  restoredOnIndependentHost:false,historicalLedgerExplicitlyExcludedSynthetic:false,
 });
 assert.equal(absent.state,'BLOCKED');
 assert.ok(absent.blockers.includes('ORIGINAL_POD_AND_VOLUME_IDENTITY_UNVERIFIED'));
 assert.ok(absent.blockers.includes('ORIGINAL_BACKUP_HASH_MISMATCH'));
 assert.ok(absent.blockers.includes('ENCRYPTED_OFFSITE_READBACK_UNVERIFIED'));
 assert.ok(absent.blockers.includes('INDEPENDENT_ROW_PARITY_UNVERIFIED'));
});
test('Money FINISH synthetic-only and unavailable statuses cannot certify old SHARK history',()=>{
 for(const status of ['SYNTHETIC_REPLAY_ONLY','ORIGINAL_DATA_UNAVAILABLE'] as const){
  const x=assessOriginalShadowRecovery({...data,restore:{...restored,status}});
  assert.equal(x.state,'BLOCKED');
  assert.equal(x.mayImportLessons,false);
 }
});
test('identical source and restore identities fail independent verification',()=>{
 const x=assessOriginalShadowRecovery({...data,restore:{
  ...restored,isolatedRestoreIdentity:restored.sourceIdentity,
 }});
 assert.ok(x.blockers.includes('INDEPENDENT_ROW_PARITY_UNVERIFIED'));
});
