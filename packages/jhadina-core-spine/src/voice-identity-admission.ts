import {
  admitCanonicalVoiceIdentity,
  validateCanonicalVoiceIdentity,
  validateSpeakerFingerprintReceipt,
  validateVoiceApprovalReceipt,
  type CanonicalVoiceIdentity,
  type SpeakerFingerprintReceipt,
  type VoiceIdentityApprovalReceipt,
} from './voice-identity-shared.js';

export interface CanonicalVoiceIdentityRepository {
  getIdentity(identityId:string):Promise<CanonicalVoiceIdentity|undefined>;
  getFingerprint(receiptId:string):Promise<SpeakerFingerprintReceipt|undefined>;
  getApproval(identityId:string):Promise<VoiceIdentityApprovalReceipt|undefined>;
  saveIdentity(identity:CanonicalVoiceIdentity):Promise<void>;
  saveFingerprint(receipt:SpeakerFingerprintReceipt):Promise<void>;
  saveApproval(receipt:VoiceIdentityApprovalReceipt):Promise<void>;
}

export type VoiceIdentityAdmissionState =
  | 'missing'
  | 'candidate'
  | 'approval-missing'
  | 'fingerprint-missing'
  | 'invalid'
  | 'approved';

export interface VoiceIdentityAdmissionResolution {
  state:VoiceIdentityAdmissionState;
  identity?:CanonicalVoiceIdentity;
  fingerprint?:SpeakerFingerprintReceipt;
  approval?:VoiceIdentityApprovalReceipt;
  reasons:readonly string[];
}

export async function resolveCanonicalVoiceIdentityAdmission(
  repository:CanonicalVoiceIdentityRepository,
  identityId:string,
):Promise<VoiceIdentityAdmissionResolution>{
  const identity=await repository.getIdentity(identityId);
  if(!identity) return Object.freeze({state:'missing',reasons:Object.freeze(['VOICE_IDENTITY_NOT_FOUND'])});

  const identityReasons=validateCanonicalVoiceIdentity(identity);
  if(identity.status==='retired'){
    return Object.freeze({state:'invalid',identity,reasons:Object.freeze(['VOICE_IDENTITY_RETIRED',...identityReasons])});
  }
  const approval=await repository.getApproval(identity.id);
  if(!approval){
    return Object.freeze({
      state:identity.status==='candidate'?'candidate':'approval-missing',
      identity,
      reasons:Object.freeze(identity.status==='candidate'
        ? ['VOICE_IDENTITY_AWAITING_EXPLICIT_APPROVAL',...identityReasons]
        : ['VOICE_APPROVAL_RECEIPT_NOT_FOUND',...identityReasons]),
    });
  }
  const fingerprint=await repository.getFingerprint(approval.speakerFingerprintReceiptId);
  if(!fingerprint){
    return Object.freeze({
      state:'fingerprint-missing',
      identity,
      approval,
      reasons:Object.freeze(['VOICE_FINGERPRINT_RECEIPT_NOT_FOUND']),
    });
  }

  const reasons=[
    ...identityReasons.filter(reason=>!reason.startsWith('VOICE_APPROVED_')),
    ...validateSpeakerFingerprintReceipt(fingerprint),
    ...validateVoiceApprovalReceipt(identity,approval,fingerprint),
  ];
  if(reasons.length){
    return Object.freeze({
      state:'invalid',
      identity,
      approval,
      fingerprint,
      reasons:Object.freeze([...new Set(reasons)]),
    });
  }

  const approved=identity.status==='approved'
    ? identity
    : admitCanonicalVoiceIdentity(identity,approval,fingerprint);
  const approvedReasons=validateCanonicalVoiceIdentity(approved);
  if(approvedReasons.length){
    return Object.freeze({
      state:'invalid',
      identity:approved,
      approval,
      fingerprint,
      reasons:Object.freeze(approvedReasons),
    });
  }
  return Object.freeze({
    state:'approved',
    identity:approved,
    approval,
    fingerprint,
    reasons:Object.freeze([]),
  });
}
