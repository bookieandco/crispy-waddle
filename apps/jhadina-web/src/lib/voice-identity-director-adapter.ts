import {
  validateMovieGradeVoiceIdentity,
  type CharacterVoiceIdentity,
} from '@jhadina/director-core';
import type {
  CanonicalVoiceIdentity,
  SpeakerFingerprintReceipt,
  VoiceIdentityApprovalReceipt,
} from '@jhadina/core-spine';

function directorSubject(projectId:string,characterId:string){
  return Object.freeze({type:'character' as const,id:`${projectId}:${characterId}`});
}

/**
 * Compatibility adapter: Director/Bonez keeps its current storage and APIs,
 * while cross-surface voice consumers see the shared canonical identity shape.
 */
export function directorVoiceIdentityToCanonical(
  identity:CharacterVoiceIdentity,
  version=1,
):CanonicalVoiceIdentity{
  const movieGradeReasons=validateMovieGradeVoiceIdentity(identity);
  const approved=movieGradeReasons.length===0;
  return Object.freeze({
    id:identity.id,
    version,
    subject:directorSubject(identity.projectId,identity.characterId),
    displayName:identity.displayName,
    source:identity.source,
    ...(identity.consentRef?{consentRef:identity.consentRef}:{}),
    primaryLanguage:identity.primaryLanguage,
    status:approved?'approved' as const:'candidate' as const,
    referenceSamples:Object.freeze(identity.referenceSamples.map(sample=>Object.freeze({...sample}))),
    providerBindings:Object.freeze(identity.providerBindings.map(binding=>Object.freeze({...binding}))),
    languageVariants:Object.freeze(identity.languageVariants.map(variant=>Object.freeze({...variant}))),
    defaultVariantId:identity.defaultVariantId,
    speakerFingerprintRefs:Object.freeze([...(identity.speakerFingerprintRefs??[])]),
    minimumSpeakerSimilarity:identity.minimumSpeakerSimilarity??0.80,
    ...(approved?{approvedAt:identity.approvedAt,approvedBy:identity.approvedBy}:{}),
  });
}

export interface DirectorSpeakerFingerprintRow {
  id:string;
  projectId:string;
  characterId:string;
  sourceAssetId:string;
  sourceSha256:string;
  normalizedAudioSha256:string;
  modelId:string;
  modelRevision:string;
  embeddingDimensions:number;
  embeddingSha256:string;
  fingerprintRef:string;
  quantization:string;
  sampleRateHz:number;
  durationSeconds:number;
  qualityClaim:boolean;
  evidenceIds:readonly string[];
  createdAt:string;
}

export function directorSpeakerFingerprintToCanonical(
  row:DirectorSpeakerFingerprintRow,
):SpeakerFingerprintReceipt{
  if(row.qualityClaim!==false) throw new Error('DIRECTOR_FINGERPRINT_QUALITY_CLAIM_INVALID');
  return Object.freeze({
    id:row.id,
    subject:directorSubject(row.projectId,row.characterId),
    sourceAssetId:row.sourceAssetId,
    sourceSha256:row.sourceSha256,
    normalizedAudioSha256:row.normalizedAudioSha256,
    modelId:row.modelId,
    modelRevision:row.modelRevision,
    embeddingDimensions:row.embeddingDimensions,
    embeddingSha256:row.embeddingSha256,
    fingerprintRef:row.fingerprintRef,
    quantization:row.quantization,
    sampleRateHz:row.sampleRateHz,
    durationSeconds:row.durationSeconds,
    qualityClaim:false as const,
    evidenceIds:Object.freeze([...row.evidenceIds]),
    createdAt:row.createdAt,
  });
}

export interface DirectorVoiceApprovalRow {
  id:string;
  projectId:string;
  characterId:string;
  voiceIdentityId:string;
  candidateAssetId:string;
  candidateSha256:string;
  speakerFingerprintReceiptId:string;
  speakerFingerprintRef:string;
  minimumSpeakerSimilarity:number;
  provider:string;
  modelId:string;
  providerVoiceRef?:string;
  authority:'DIRECTOR_EXPLICIT_VOICE_APPROVAL';
  evidenceIds:readonly string[];
  approvedBy:string;
  approvedAt:string;
}

export function directorVoiceApprovalToCanonical(
  row:DirectorVoiceApprovalRow,
):VoiceIdentityApprovalReceipt{
  return Object.freeze({
    id:row.id,
    voiceIdentityId:row.voiceIdentityId,
    subject:directorSubject(row.projectId,row.characterId),
    candidateAssetId:row.candidateAssetId,
    candidateSha256:row.candidateSha256,
    speakerFingerprintReceiptId:row.speakerFingerprintReceiptId,
    speakerFingerprintRef:row.speakerFingerprintRef,
    minimumSpeakerSimilarity:row.minimumSpeakerSimilarity,
    provider:row.provider,
    modelId:row.modelId,
    ...(row.providerVoiceRef?{providerVoiceRef:row.providerVoiceRef}:{}),
    authority:row.authority,
    evidenceIds:Object.freeze([...row.evidenceIds]),
    approvedBy:row.approvedBy,
    approvedAt:row.approvedAt,
  });
}
