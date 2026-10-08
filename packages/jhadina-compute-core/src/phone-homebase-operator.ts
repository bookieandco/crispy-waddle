/**
 * PHONE-HOMEBASE.1 — mobile operator profile.
 *
 * "Homebase is my iPhone" means the user interface is on a phone, NOT that
 * Docker, Postgres, MinIO, NATS, DVC, Restic or GPU workers are running there.
 * Actual runtime authority remains the existing Jhadina service when verified.
 */
export type PhoneHomebaseEvidence={
  phoneOnline:boolean;
  ownerSessionAuthenticated:boolean;
  chatDriveConnectorVerified:boolean;
  remoteGatewayHealthy:boolean;
  remoteCanonicalAuthorityVerified:boolean;
  machineGoogleOAuthVerified:boolean;
  encryptedBackupRestoreReceiptVerified:boolean;
};

export type PhoneHomebaseAssessment={
  mode:'OFFLINE_OPERATOR'|'AUTH_REQUIRED'|'REMOTE_AUTHORITY_UNAVAILABLE'|'REMOTE_OPERATOR_READY';
  operatorDevice:'IPHONE';
  permittedUiActions:readonly ('VIEW_CACHED_STATUS'|'BROWSE_CONNECTED_DRIVE'|'REVIEW_REMOTE_STATUS'|'REQUEST_GOVERNED_JOB'|'SUBMIT_OWNER_APPROVAL')[];
  ownerApprovalsRequireExistingActionCore:true;
  remoteSubmissionsRequireExistingGateway:true;
  localCanonicalRuntimeReady:false;
  localContainerExecutionAllowed:false;
  localGpuExecutionAllowed:false;
  machineGoogleOAuthVerified:boolean;
  encryptedBackupRestoreReceiptVerified:boolean;
  homebaseFinalCertified:false;
  blockers:readonly string[];
};

/** Evidence-based readiness; this never certifies provider connections or spends money. */
export function assessPhoneHomebase(e:PhoneHomebaseEvidence):PhoneHomebaseAssessment{
  const ui:Array<PhoneHomebaseAssessment['permittedUiActions'][number]>=['VIEW_CACHED_STATUS'];
  const blockers:string[]=['PHONE_IS_OPERATOR_NOT_CANONICAL_SERVER'];
  let mode:PhoneHomebaseAssessment['mode']='OFFLINE_OPERATOR';

  if(!e.phoneOnline){
    blockers.push('PHONE_NETWORK_UNAVAILABLE');
  }else if(!e.ownerSessionAuthenticated){
    mode='AUTH_REQUIRED';
    blockers.push('OWNER_SESSION_AUTH_REQUIRED');
  }else{
    if(e.chatDriveConnectorVerified)ui.push('BROWSE_CONNECTED_DRIVE');
    if(!e.remoteGatewayHealthy){
      mode='REMOTE_AUTHORITY_UNAVAILABLE';
      blockers.push('REMOTE_GATEWAY_NOT_VERIFIED');
    }else if(!e.remoteCanonicalAuthorityVerified){
      mode='REMOTE_AUTHORITY_UNAVAILABLE';
      blockers.push('REMOTE_CANONICAL_AUTHORITY_NOT_VERIFIED');
    }else{
      mode='REMOTE_OPERATOR_READY';
      ui.push('REVIEW_REMOTE_STATUS','REQUEST_GOVERNED_JOB','SUBMIT_OWNER_APPROVAL');
    }
  }

  if(!e.machineGoogleOAuthVerified)blockers.push('MACHINE_GOOGLE_OAUTH_NOT_VERIFIED');
  if(!e.encryptedBackupRestoreReceiptVerified)blockers.push('ENCRYPTED_BACKUP_RESTORE_NOT_VERIFIED');
  return Object.freeze({
    mode,
    operatorDevice:'IPHONE',
    permittedUiActions:Object.freeze(ui),
    ownerApprovalsRequireExistingActionCore:true,
    remoteSubmissionsRequireExistingGateway:true,
    localCanonicalRuntimeReady:false,
    localContainerExecutionAllowed:false,
    localGpuExecutionAllowed:false,
    machineGoogleOAuthVerified:e.machineGoogleOAuthVerified,
    encryptedBackupRestoreReceiptVerified:e.encryptedBackupRestoreReceiptVerified,
    homebaseFinalCertified:false,
    blockers:Object.freeze(blockers),
  });
}
