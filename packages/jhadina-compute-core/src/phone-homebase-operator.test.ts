import {describe,expect,it} from 'vitest';
import {assessPhoneHomebase,type PhoneHomebaseEvidence} from './phone-homebase-operator.js';

const BASE:PhoneHomebaseEvidence={
  phoneOnline:true,
  ownerSessionAuthenticated:true,
  chatDriveConnectorVerified:true,
  remoteGatewayHealthy:false,
  remoteCanonicalAuthorityVerified:false,
  machineGoogleOAuthVerified:false,
  encryptedBackupRestoreReceiptVerified:false,
};

describe('PHONE-HOMEBASE portable operator contract',()=>{
  it('does not mistake connected ChatGPT Drive for machine OAuth or live Homebase',()=>{
    const plan=assessPhoneHomebase(BASE);
    expect(plan.mode).toBe('REMOTE_AUTHORITY_UNAVAILABLE');
    expect(plan.permittedUiActions).toContain('BROWSE_CONNECTED_DRIVE');
    expect(plan.permittedUiActions).not.toContain('REQUEST_GOVERNED_JOB');
    expect(plan.blockers).toContain('MACHINE_GOOGLE_OAUTH_NOT_VERIFIED');
    expect(plan.blockers).toContain('ENCRYPTED_BACKUP_RESTORE_NOT_VERIFIED');
    expect(plan.localCanonicalRuntimeReady).toBe(false);
    expect(plan.homebaseFinalCertified).toBe(false);
    expect(plan.localContainerExecutionAllowed).toBe(false);
    expect(plan.localGpuExecutionAllowed).toBe(false);
  });

  it('offline iPhone can only show cached status (not submit jobs)',()=>{
    const plan=assessPhoneHomebase({...BASE,phoneOnline:false,remoteGatewayHealthy:true,remoteCanonicalAuthorityVerified:true});
    expect(plan.mode).toBe('OFFLINE_OPERATOR');
    expect(plan.permittedUiActions).toEqual(['VIEW_CACHED_STATUS']);
    expect(plan.blockers).toContain('PHONE_NETWORK_UNAVAILABLE');
  });

  it('requires authenticated owner session before exposing connected Drive',()=>{
    const plan=assessPhoneHomebase({...BASE,ownerSessionAuthenticated:false});
    expect(plan.mode).toBe('AUTH_REQUIRED');
    expect(plan.permittedUiActions).toEqual(['VIEW_CACHED_STATUS']);
  });

  it('never pretends Drive is connected just because phone is signed in',()=>{
    const plan=assessPhoneHomebase({...BASE,chatDriveConnectorVerified:false});
    expect(plan.permittedUiActions).not.toContain('BROWSE_CONNECTED_DRIVE');
  });

  it('permits requests through an already verified gateway, not local execution',()=>{
    const plan=assessPhoneHomebase({...BASE,remoteGatewayHealthy:true,remoteCanonicalAuthorityVerified:true});
    expect(plan.mode).toBe('REMOTE_OPERATOR_READY');
    expect(plan.permittedUiActions).toEqual([
      'VIEW_CACHED_STATUS','BROWSE_CONNECTED_DRIVE','REVIEW_REMOTE_STATUS',
      'REQUEST_GOVERNED_JOB','SUBMIT_OWNER_APPROVAL',
    ]);
    expect(plan.remoteSubmissionsRequireExistingGateway).toBe(true);
    expect(plan.ownerApprovalsRequireExistingActionCore).toBe(true);
    expect(plan.homebaseFinalCertified).toBe(false);
    expect(plan.localCanonicalRuntimeReady).toBe(false);
  });

  it('remote gateway alone without canonical durable authority does not admit commands',()=>{
    const plan=assessPhoneHomebase({...BASE,remoteGatewayHealthy:true});
    expect(plan.mode).toBe('REMOTE_AUTHORITY_UNAVAILABLE');
    expect(plan.blockers).toContain('REMOTE_CANONICAL_AUTHORITY_NOT_VERIFIED');
    expect(plan.permittedUiActions).not.toContain('REQUEST_GOVERNED_JOB');
  });
});
