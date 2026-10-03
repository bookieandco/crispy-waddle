import type {VoiceCalibrationPack} from './voice-calibration.js';
import type {CanonicalVoiceIdentity} from './voice-identity-shared.js';

export type VoiceAuditionCandidateState='candidate_unapproved'|'shortlisted'|'rejected';

export interface VoiceAuditionCandidateReceipt {
  id:string;
  voiceIdentityId:string;
  provider:string;
  providerTaskId:string;
  modelId:string;
  providerVoiceRef:string;
  language:string;
  calibrationPackId:string;
  calibrationSampleIds:readonly string[];
  artifactAssetId:string;
  artifactSha256:string;
  durationSeconds:number;
  transcript:string;
  state:VoiceAuditionCandidateState;
  qualityClaim:false;
  provenanceRefs:readonly string[];
  createdAt:string;
}

export interface VoiceAuditionPlan {
  id:string;
  voiceIdentityId:string;
  calibrationPackId:string;
  requestedCandidates:number;
  providers:readonly string[];
  requiresExplicitApproval:true;
  selectionDoesNotApprove:true;
}

const SHA256=/^[a-f0-9]{64}$/i;

export function createVoiceAuditionPlan(
  identity:CanonicalVoiceIdentity,
  pack:VoiceCalibrationPack,
  providers:readonly string[]=['qwen3-tts','voxcpm2'],
  requestedCandidates=4,
):VoiceAuditionPlan{
  if(identity.status!=='candidate') throw new Error('VOICE_AUDITION_IDENTITY_MUST_BE_CANDIDATE');
  if(pack.voiceIdentityId!==identity.id) throw new Error('VOICE_AUDITION_CALIBRATION_IDENTITY_MISMATCH');
  const admittedProviders=[...new Set(providers.map(value=>value.trim()).filter(Boolean))];
  if(!admittedProviders.length) throw new Error('VOICE_AUDITION_PROVIDER_REQUIRED');
  const count=Math.max(2,Math.min(8,Math.floor(requestedCandidates)));
  return Object.freeze({
    id:`voice-audition:${identity.id}:calibration-v${pack.version}`,
    voiceIdentityId:identity.id,
    calibrationPackId:pack.id,
    requestedCandidates:count,
    providers:Object.freeze(admittedProviders),
    requiresExplicitApproval:true as const,
    selectionDoesNotApprove:true as const,
  });
}

export function validateVoiceAuditionCandidate(
  receipt:VoiceAuditionCandidateReceipt,
  identity:CanonicalVoiceIdentity,
  pack:VoiceCalibrationPack,
):readonly string[]{
  const reasons:string[]=[];
  if(receipt.voiceIdentityId!==identity.id||receipt.voiceIdentityId!==pack.voiceIdentityId){
    reasons.push('VOICE_AUDITION_CANDIDATE_IDENTITY_MISMATCH');
  }
  if(!receipt.id.trim()||!receipt.provider.trim()||!receipt.providerTaskId.trim()||!receipt.modelId.trim()||!receipt.providerVoiceRef.trim()){
    reasons.push('VOICE_AUDITION_CANDIDATE_PROVIDER_PROVENANCE_REQUIRED');
  }
  if(receipt.calibrationPackId!==pack.id) reasons.push('VOICE_AUDITION_CALIBRATION_PACK_MISMATCH');
  const validSampleIds=new Set(pack.samples.map(item=>item.id));
  if(!receipt.calibrationSampleIds.length||receipt.calibrationSampleIds.some(id=>!validSampleIds.has(id))){
    reasons.push('VOICE_AUDITION_CALIBRATION_SAMPLE_INVALID');
  }
  if(!receipt.artifactAssetId.trim()||!SHA256.test(receipt.artifactSha256)){
    reasons.push('VOICE_AUDITION_ARTIFACT_PROVENANCE_REQUIRED');
  }
  if(!Number.isFinite(receipt.durationSeconds)||receipt.durationSeconds<=0||!receipt.transcript.trim()){
    reasons.push('VOICE_AUDITION_AUDIO_METADATA_INVALID');
  }
  if(receipt.qualityClaim!==false) reasons.push('VOICE_AUDITION_CANDIDATE_MUST_NOT_CLAIM_QUALITY');
  if(!receipt.provenanceRefs.length) reasons.push('VOICE_AUDITION_PROVENANCE_REQUIRED');
  if(!Number.isFinite(Date.parse(receipt.createdAt))) reasons.push('VOICE_AUDITION_TIMESTAMP_INVALID');
  return Object.freeze([...new Set(reasons)]);
}

/**
 * Shortlisting is a human audition decision only. It never changes the canonical
 * identity's approval state; fingerprinting + explicit approval remain separate.
 */
export function shortlistVoiceAuditionCandidate(
  receipt:VoiceAuditionCandidateReceipt,
):VoiceAuditionCandidateReceipt{
  if(receipt.state==='rejected') throw new Error('VOICE_AUDITION_REJECTED_CANDIDATE_CANNOT_SHORTLIST');
  return Object.freeze({...receipt,state:'shortlisted' as const});
}

export function rejectVoiceAuditionCandidate(
  receipt:VoiceAuditionCandidateReceipt,
):VoiceAuditionCandidateReceipt{
  return Object.freeze({...receipt,state:'rejected' as const});
}
