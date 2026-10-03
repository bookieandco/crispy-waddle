import {describe,it,expect} from 'vitest';
import {
  JHADINA_CANONICAL_VOICE_IDENTITY_CANDIDATE,
  JHADINA_CANONICAL_VOICE_IDENTITY_ID,
} from './jhadina-voice-identity.js';
import {
  resolveCanonicalVoiceIdentityAdmission,
  type CanonicalVoiceIdentityRepository,
} from './voice-identity-admission.js';
import type {
  CanonicalVoiceIdentity,
  SpeakerFingerprintReceipt,
  VoiceIdentityApprovalReceipt,
} from './voice-identity-shared.js';

const SHA='d'.repeat(64);
const NORMALIZED='e'.repeat(64);
const EMBEDDING='f'.repeat(64);

function candidate():CanonicalVoiceIdentity{
  return {
    ...JHADINA_CANONICAL_VOICE_IDENTITY_CANDIDATE,
    referenceSamples:[{
      id:'sample:jhadina:v1',
      assetId:'asset:jhadina:v1',
      sha256:SHA,
      language:'en-US',
      durationSeconds:8,
      rightsRef:'rights:jhadina:original-design',
      qualityEvidenceIds:['evidence:sample'],
    }],
    providerBindings:[{
      id:'binding:jhadina:qwen',
      provider:'qwen3-tts',
      modelId:'qwen3-tts',
      providerVoiceRef:'jhadina-v1',
      referenceSampleIds:['sample:jhadina:v1'],
      supportedLanguages:['en-US'],
      provenanceRefs:['provider:qwen3-tts'],
    }],
    languageVariants:[{
      id:'variant:jhadina:en-US',
      voiceIdentityId:JHADINA_CANONICAL_VOICE_IDENTITY_ID,
      language:'en-US',
      accentPolicy:'preserve-identity',
      providerBindingIds:['binding:jhadina:qwen'],
    }],
    defaultVariantId:'variant:jhadina:en-US',
  };
}

function fingerprint():SpeakerFingerprintReceipt{
  return {
    id:'fp:jhadina:v1',
    subject:{type:'assistant',id:'jhadina'},
    sourceAssetId:'asset:jhadina:v1',
    sourceSha256:SHA,
    normalizedAudioSha256:NORMALIZED,
    modelId:'ecapa-voxceleb',
    modelRevision:'pinned-v1',
    embeddingDimensions:192,
    embeddingSha256:EMBEDDING,
    fingerprintRef:'speaker-embedding:ecapa-voxceleb:jhadina-v1',
    quantization:'float32-sha256',
    sampleRateHz:16000,
    durationSeconds:8,
    qualityClaim:false,
    evidenceIds:['evidence:fp'],
    createdAt:'2026-10-03T19:00:00.000Z',
  };
}

function approval():VoiceIdentityApprovalReceipt{
  return {
    id:'approval:jhadina:v1',
    voiceIdentityId:JHADINA_CANONICAL_VOICE_IDENTITY_ID,
    subject:{type:'assistant',id:'jhadina'},
    candidateAssetId:'asset:jhadina:v1',
    candidateSha256:SHA,
    speakerFingerprintReceiptId:'fp:jhadina:v1',
    speakerFingerprintRef:'speaker-embedding:ecapa-voxceleb:jhadina-v1',
    minimumSpeakerSimilarity:0.80,
    provider:'qwen3-tts',
    modelId:'qwen3-tts',
    providerVoiceRef:'jhadina-v1',
    authority:'VOICE_EXPLICIT_APPROVAL',
    evidenceIds:['evidence:approval'],
    approvedBy:'owner-user-id',
    approvedAt:'2026-10-03T19:05:00.000Z',
  };
}

class MemoryVoiceRepository implements CanonicalVoiceIdentityRepository{
  identities=new Map<string,CanonicalVoiceIdentity>();
  fingerprints=new Map<string,SpeakerFingerprintReceipt>();
  approvals=new Map<string,VoiceIdentityApprovalReceipt>();
  async getIdentity(id:string){return this.identities.get(id);}
  async getFingerprint(id:string){return this.fingerprints.get(id);}
  async getApproval(id:string){return this.approvals.get(id);}
  async saveIdentity(value:CanonicalVoiceIdentity){this.identities.set(value.id,value);}
  async saveFingerprint(value:SpeakerFingerprintReceipt){this.fingerprints.set(value.id,value);}
  async saveApproval(value:VoiceIdentityApprovalReceipt){this.approvals.set(value.voiceIdentityId,value);}
}

describe('canonical voice identity admission service',()=>{
  it('distinguishes missing and unapproved candidate state',async()=>{
    const repo=new MemoryVoiceRepository();
    const missing=await resolveCanonicalVoiceIdentityAdmission(repo,JHADINA_CANONICAL_VOICE_IDENTITY_ID);
    expect(missing.state).toBe('missing');

    await repo.saveIdentity(candidate());
    const pending=await resolveCanonicalVoiceIdentityAdmission(repo,JHADINA_CANONICAL_VOICE_IDENTITY_ID);
    expect(pending.state).toBe('candidate');
    expect(pending.reasons).toContain('VOICE_IDENTITY_AWAITING_EXPLICIT_APPROVAL');
  });

  it('fails closed when an approval references a missing fingerprint',async()=>{
    const repo=new MemoryVoiceRepository();
    await repo.saveIdentity(candidate());
    await repo.saveApproval(approval());
    const result=await resolveCanonicalVoiceIdentityAdmission(repo,JHADINA_CANONICAL_VOICE_IDENTITY_ID);
    expect(result.state).toBe('fingerprint-missing');
  });

  it('promotes the exact candidate only after matching approval and fingerprint receipts exist',async()=>{
    const repo=new MemoryVoiceRepository();
    await repo.saveIdentity(candidate());
    await repo.saveFingerprint(fingerprint());
    await repo.saveApproval(approval());

    const result=await resolveCanonicalVoiceIdentityAdmission(repo,JHADINA_CANONICAL_VOICE_IDENTITY_ID);
    expect(result.state).toBe('approved');
    expect(result.reasons).toEqual([]);
    expect(result.identity?.status).toBe('approved');
    expect(result.identity?.speakerFingerprintRefs).toEqual(['speaker-embedding:ecapa-voxceleb:jhadina-v1']);
  });

  it('rejects mismatched approval provenance instead of auto-correcting it',async()=>{
    const repo=new MemoryVoiceRepository();
    await repo.saveIdentity(candidate());
    await repo.saveFingerprint(fingerprint());
    await repo.saveApproval({...approval(),provider:'voxcpm2'});
    const result=await resolveCanonicalVoiceIdentityAdmission(repo,JHADINA_CANONICAL_VOICE_IDENTITY_ID);
    expect(result.state).toBe('invalid');
    expect(result.reasons).toContain('VOICE_APPROVAL_PROVIDER_PROVENANCE_MISMATCH');
  });
});
