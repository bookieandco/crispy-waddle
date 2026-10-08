/**
 * GOOGLE-HOMEBASE.4-.10: evidence inventory ONLY.
 *
 * This is not a new authority, deployment gate, credential verifier or power
 * to cancel providers. The caller must read genuine, independently checked
 * receipts from trusted provider APIs; booleans on a phone cannot attest them.
 */
export const GOOGLE_HOMEBASE_REQUIREMENTS={
  'GOOGLE-HOMEBASE.4':['EXACT_HEAD_CI_GREEN','CHANGE_REVIEWED'],
  'GOOGLE-HOMEBASE.5':['TRUSTED_WORKER_IDENTIFIED','WORKER_GOOGLE_OAUTH_VERIFIED','WORKER_SECRET_STORE_VERIFIED'],
  'GOOGLE-HOMEBASE.6':['DVC_SYNTHETIC_PUSH_PULL_VERIFIED'],
  'GOOGLE-HOMEBASE.7':['RESTIC_REMOTE_BYTE_RESTORE_VERIFIED','POSTGRES_DISPOSABLE_IMPORT_VERIFIED','MINIO_OBJECT_RESTORE_VERIFIED','NATS_RECOVERY_TESTED','RESTIC_PASSWORD_RECOVERY_VERIFIED'],
  'GOOGLE-HOMEBASE.8':['BACKUP_TIMER_OBSERVED','BACKUP_HEALTH_ALERT_TESTED','BACKUP_RETENTION_DRY_RUN_REVIEWED'],
  'GOOGLE-HOMEBASE.9':['SUPABASE_DEPENDENCY_AUDITED','AUTH_RLS_REALTIME_FALLBACK_PROVEN','RUNPOD_SPEND_AND_COMPUTE_AUDITED','MIGRATION_ROLLBACK_READY'],
  'GOOGLE-HOMEBASE.10':['DIRECTOR_E2E_VERIFIED','OVERAGE_E2E_VERIFIED','SHARK_E2E_VERIFIED','MUSIC_E2E_VERIFIED','SOCIAL_E2E_VERIFIED','BUSINESS_FACTORY_E2E_VERIFIED','OWNER_FINAL_REVIEW'],
} as const;
export type GoogleHomebaseStep=keyof typeof GOOGLE_HOMEBASE_REQUIREMENTS;
export type GoogleHomebaseRequirement=typeof GOOGLE_HOMEBASE_REQUIREMENTS[GoogleHomebaseStep][number];
export type GoogleHomebaseReceipt={
  kind:GoogleHomebaseRequirement;
  receiptId:string;
  observedAt:string;
  /** exact commit tied to receipt, if applicable */
  commitSha?:string;
  /** SHA of payload where available, not an attestation by itself */
  payloadSha256?:string;
  /** verifier must check provider provenance before supplying receipts */
  trustedVerification:boolean;
};
export type GoogleHomebaseStage={
  id:GoogleHomebaseStep;
  evidencePresent:boolean;
  missing:readonly string[];
};
export type GoogleHomebaseProgress={
  schema:'jhadina.google-homebase-progress.v1';
  stages:readonly GoogleHomebaseStage[];
  advisoryEvidenceComplete:boolean;
  /** Phone + Drive connection alone never constitute a durable local runtime. */
  phoneIsControlOnly:true;
  machineOAuthInferredFromChatDrive:false;
  /** Provider shutdown is governed separately even if every receipt is present. */
  providerDecommissionAuthorized:false;
  productionCutoverPerformed:false;
  outstandingRequirements:readonly string[];
};

const shaRe=/^[0-9a-f]{40}$/;
function isReceiptValid(r:GoogleHomebaseReceipt,head:string,now:Date):boolean{
  if(!r.trustedVerification||!r.receiptId.trim()||!Number.isFinite(Date.parse(r.observedAt)))return false;
  const age=now.getTime()-Date.parse(r.observedAt);
  if(age<0||age>30*24*60*60*1000)return false;
  if(r.payloadSha256!==undefined&&!/^[0-9a-f]{64}$/.test(r.payloadSha256))return false;
  if(r.kind==='EXACT_HEAD_CI_GREEN')return shaRe.test(head)&&r.commitSha===head;
  return true;
}

/** Advisory inventory: never pass client-supplied receipts to an action authorizer. */
export function assessGoogleHomebaseProgress(
  receipts:readonly GoogleHomebaseReceipt[],
  expectedHeadSha:string,
  now:Date,
):GoogleHomebaseProgress{
  if(!Number.isFinite(now.getTime()))throw new Error('INVALID_REVIEW_TIME');
  const valid=new Set(receipts.filter(r=>isReceiptValid(r,expectedHeadSha,now)).map(r=>r.kind));
  const stages=(Object.entries(GOOGLE_HOMEBASE_REQUIREMENTS) as [GoogleHomebaseStep,readonly GoogleHomebaseRequirement[]][])
    .map(([id,required])=>{
      const missing=required.filter(kind=>!valid.has(kind));
      return Object.freeze({id,evidencePresent:missing.length===0,missing:Object.freeze(missing)});
    });
  const outstanding=stages.flatMap(s=>s.missing);
  return Object.freeze({
    schema:'jhadina.google-homebase-progress.v1',
    stages:Object.freeze(stages),
    advisoryEvidenceComplete:outstanding.length===0,
    phoneIsControlOnly:true,
    machineOAuthInferredFromChatDrive:false,
    providerDecommissionAuthorized:false,
    productionCutoverPerformed:false,
    outstandingRequirements:Object.freeze(outstanding),
  });
}
