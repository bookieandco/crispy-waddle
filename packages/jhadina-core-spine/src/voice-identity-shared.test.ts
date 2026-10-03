import {describe,it,expect} from 'vitest';
import {
  JHADINA_CANONICAL_VOICE_IDENTITY_CANDIDATE,
  JHADINA_CANONICAL_VOICE_IDENTITY_ID,
} from './jhadina-voice-identity.js';
import {
  admitCanonicalVoiceIdentity,
  validateCanonicalVoiceIdentity,
  validateGeneratedCanonicalVoice,
  type CanonicalVoiceIdentity,
  type SpeakerFingerprintReceipt,
  type VoiceIdentityApprovalReceipt,
} from './voice-identity-shared.js';
import {
  JHADINA_CANONICAL_VOICE_PROFILE,
  voiceProfileWithApprovedIdentity,
} from './voice-runtime.js';

const SHA='1'.repeat(64);
const NORMALIZED='2'.repeat(64);
const EMBEDDING='3'.repeat(64);

function readyCandidate():CanonicalVoiceIdentity{
  return {
    ...JHADINA_CANONICAL_VOICE_IDENTITY_CANDIDATE,
    referenceSamples:[{
      id:'sample:jhadina:v1',
      assetId:'asset:jhadina:voice:v1',
      sha256:SHA,
      language:'en-US',
      durationSeconds:9,
      rightsRef:'rights:jhadina:original-design',
      qualityEvidenceIds:['evidence:jhadina:audition'],
    }],
    providerBindings:[{
      id:'binding:jhadina:qwen3',
      provider:'qwen3-tts',
      modelId:'qwen3-tts',
      providerVoiceRef:'jhadina-v1',
      referenceSampleIds:['sample:jhadina:v1'],
      supportedLanguages:['en-US'],
      provenanceRefs:['provider:qwen3-tts','candidate:jhadina:v1'],
    }],
    languageVariants:[{
      id:'variant:jhadina:en-US',
      voiceIdentityId:JHADINA_CANONICAL_VOICE_IDENTITY_ID,
      language:'en-US',
      locale:'en-US',
      accentPolicy:'preserve-identity',
      providerBindingIds:['binding:jhadina:qwen3'],
    }],
    defaultVariantId:'variant:jhadina:en-US',
  };
}

function fingerprint():SpeakerFingerprintReceipt{
  return {
    id:'fp:jhadina:v1',
    subject:{type:'assistant',id:'jhadina'},
    sourceAssetId:'asset:jhadina:voice:v1',
    sourceSha256:SHA,
    normalizedAudioSha256:NORMALIZED,
    modelId:'ecapa-voxceleb',
    modelRevision:'pinned-v1',
    embeddingDimensions:192,
    embeddingSha256:EMBEDDING,
    fingerprintRef:'speaker-embedding:ecapa-voxceleb:jhadina-v1',
    quantization:'float32-sha256',
    sampleRateHz:16000,
    durationSeconds:9,
    qualityClaim:false,
    evidenceIds:['evidence:jhadina:fingerprint'],
    createdAt:'2026-10-03T18:00:00.000Z',
  };
}

function approval():VoiceIdentityApprovalReceipt{
  return {
    id:'approval:jhadina:v1',
    voiceIdentityId:JHADINA_CANONICAL_VOICE_IDENTITY_ID,
    subject:{type:'assistant',id:'jhadina'},
    candidateAssetId:'asset:jhadina:voice:v1',
    candidateSha256:SHA,
    speakerFingerprintReceiptId:'fp:jhadina:v1',
    speakerFingerprintRef:'speaker-embedding:ecapa-voxceleb:jhadina-v1',
    minimumSpeakerSimilarity:0.80,
    provider:'qwen3-tts',
    modelId:'qwen3-tts',
    providerVoiceRef:'jhadina-v1',
    authority:'VOICE_EXPLICIT_APPROVAL',
    evidenceIds:['evidence:jhadina:approval'],
    approvedBy:'owner-user-id',
    approvedAt:'2026-10-03T18:05:00.000Z',
  };
}

describe('shared canonical voice identity',()=>{
  it('keeps the permanent Jhadina identity as a candidate until acoustic evidence is admitted',()=>{
    expect(JHADINA_CANONICAL_VOICE_IDENTITY_CANDIDATE.id).toBe('voice:jhadina:canonical:v1');
    expect(JHADINA_CANONICAL_VOICE_IDENTITY_CANDIDATE.subject).toEqual({type:'assistant',id:'jhadina'});
    expect(JHADINA_CANONICAL_VOICE_IDENTITY_CANDIDATE.status).toBe('candidate');
    expect(JHADINA_CANONICAL_VOICE_IDENTITY_CANDIDATE.speakerFingerprintRefs).toEqual([]);
    expect(validateCanonicalVoiceIdentity(JHADINA_CANONICAL_VOICE_IDENTITY_CANDIDATE)).toEqual([]);
    expect(JHADINA_CANONICAL_VOICE_PROFILE.identity.id).toBe(JHADINA_CANONICAL_VOICE_IDENTITY_ID);
    expect(JHADINA_CANONICAL_VOICE_PROFILE.identity.status).toBe('candidate');
  });

  it('requires exact sample, fingerprint and explicit approval before production admission',()=>{
    const admitted=admitCanonicalVoiceIdentity(readyCandidate(),approval(),fingerprint());
    expect(admitted.status).toBe('approved');
    expect(admitted.speakerFingerprintRefs).toEqual(['speaker-embedding:ecapa-voxceleb:jhadina-v1']);
    expect(validateCanonicalVoiceIdentity(admitted)).toEqual([]);

    const profile=voiceProfileWithApprovedIdentity(admitted,'approval:jhadina:v1');
    expect(profile.identity).toEqual({
      id:'voice:jhadina:canonical:v1',
      version:1,
      status:'approved',
      minimumSpeakerSimilarity:0.80,
      fingerprintRef:'speaker-embedding:ecapa-voxceleb:jhadina-v1',
      approvalReceiptId:'approval:jhadina:v1',
    });
  });

  it('fails closed on speaker drift after approval',()=>{
    const admitted=admitCanonicalVoiceIdentity(readyCandidate(),approval(),fingerprint());
    const failed=validateGeneratedCanonicalVoice(admitted,{
      voiceIdentityId:admitted.id,
      providerBindingId:'binding:jhadina:qwen3',
      audioAssetId:'asset:jhadina:take:bad',
      audioSha256:'4'.repeat(64),
      language:'en-US',
      sampleRateHz:24000,
      durationSeconds:7,
      speakerSimilarity:0.72,
      intelligibilityScore:0.95,
      evidenceIds:['evidence:take'],
    },{minimumSpeakerSimilarity:0.80,minimumIntelligibility:0.90});
    expect(failed.admissible).toBe(false);
    expect(failed.reasons).toContain('VOICE_ARTIFACT_SPEAKER_SIMILARITY_LOW');
  });

  it('does not allow a Bonez identity to become the Jhadina runtime profile',()=>{
    const bonez={...readyCandidate(),id:'voice:bonez:canonical:v1',subject:{type:'character' as const,id:'project:bonez'}};
    expect(()=>voiceProfileWithApprovedIdentity({...bonez,status:'approved',speakerFingerprintRefs:['speaker:bonez'],approvedAt:'2026-10-03T00:00:00.000Z',approvedBy:'owner'},'approval:bonez')).toThrow('JHADINA_VOICE_IDENTITY_MISMATCH');
  });
});
