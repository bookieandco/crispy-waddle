import type {MoneyRecoveryReport} from './money-finish-recovery.js';
import type {SalvageArtifact} from './shark-history-salvage.js';
import {classifySharkSalvage} from './shark-history-salvage.js';

/**
 * SHARK-HISTORY-SALVAGE.07 original source admission after independent
 * content/parity verification. Can approve *audit review* only, never mark
 * historical production recovery or start SHARK.
 */
export type OriginalRecoveryGateInput=Readonly<{
  artifact:SalvageArtifact|null;
  restore:MoneyRecoveryReport|null;
  historicalSourcePodId:string|null;
  historicalPersistentVolumeId:string|null;
  sourceVsRestoredSnapshotSha256:string|null;
  encryptedBackupReceiptId:string|null;
  verifiedOffsiteReadback:boolean;
  historicalLedgerExplicitlyExcludedSynthetic:boolean;
  restoredOnIndependentHost:boolean;
}>;
export type OriginalRecoveryGate=Readonly<{
  state:'BLOCKED'|'EXTERNAL_SOURCE_AUDIT_REQUIRED';
  blockers:readonly string[];
  originalRecovered:false;
  mayImportLessons:false;
  mayReplaceOriginal:false;
  mayCreateFreshLedger:false;
  mayExecute:false;
  mayAuthorizeLive:false;
}>;
const valid=(v:string|null):v is string=>typeof v==='string'&&v.trim().length>0;
const digest=(v:string|null)=>valid(v)&&/^[a-f0-9]{64}$/.test(v);
export function assessOriginalShadowRecovery(input:OriginalRecoveryGateInput):OriginalRecoveryGate{
  const reasons:string[]=[];
  let original=false;
  if(input.artifact){
    const classified=classifySharkSalvage([input.artifact]);
    original=classified.entries[0]?.disposition==='ORIGINAL_UNVERIFIED';
  }
  if(!original)reasons.push('ORIGINAL_SOURCE_CANDIDATE_MISSING');
  if(!valid(input.historicalSourcePodId)||!valid(input.historicalPersistentVolumeId))
    reasons.push('ORIGINAL_POD_AND_VOLUME_IDENTITY_UNVERIFIED');
  if(!input.historicalLedgerExplicitlyExcludedSynthetic)
    reasons.push('SOURCE_SYNTHETIC_CONTAMINATION_UNVERIFIED');
  if(!input.restoredOnIndependentHost)
    reasons.push('ISOLATED_RESTORE_HOST_UNVERIFIED');
  if(!input.verifiedOffsiteReadback||!valid(input.encryptedBackupReceiptId))
    reasons.push('ENCRYPTED_OFFSITE_READBACK_UNVERIFIED');
  if(!digest(input.sourceVsRestoredSnapshotSha256)||
     !input.artifact||input.sourceVsRestoredSnapshotSha256!==input.artifact.sha256)
    reasons.push('ORIGINAL_BACKUP_HASH_MISMATCH');
  if(!input.restore||input.restore.status!=='CONTENT_MATCHED_EXTERNAL_CERTIFICATION_REQUIRED'||
     !input.restore.sourceIdentity||!input.restore.isolatedRestoreIdentity||
     input.restore.sourceIdentity===input.restore.isolatedRestoreIdentity||
     input.restore.rowCount<1||!digest(input.restore.manifestHash)||
     input.restore.canAuthorizeLive!==false)
    reasons.push('INDEPENDENT_ROW_PARITY_UNVERIFIED');
  // Even if all self-asserted fields are present, this pure function is not a
  // trusted witness to physical device identity or encryption. It only
  // prepares the independent audit/reconciliation queue.
  return Object.freeze({state:reasons.length?'BLOCKED' as const:'EXTERNAL_SOURCE_AUDIT_REQUIRED' as const,
    blockers:Object.freeze(reasons),originalRecovered:false as const,
    mayImportLessons:false as const,mayReplaceOriginal:false as const,
    mayCreateFreshLedger:false as const,mayExecute:false as const,mayAuthorizeLive:false as const});
}
