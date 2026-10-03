import {describe,it,expect} from 'vitest';
import {
  validateCanonicalVoiceIdentity,
  validateSpeakerFingerprintReceipt,
  validateVoiceApprovalReceipt,
} from '@jhadina/core-spine';
import {
  directorSpeakerFingerprintToCanonical,
  directorVoiceApprovalToCanonical,
  directorVoiceIdentityToCanonical,
} from './voice-identity-director-adapter';

const SHA='a'.repeat(64);
const NORMALIZED='b'.repeat(64);
const EMBEDDING='c'.repeat(64);

describe('Director voice identity shared adapter',()=>{
  it('maps a Bonez-shaped approved identity without changing acoustic ownership',()=>{
    const identity=directorVoiceIdentityToCanonical({
      id:'voice:bonez:canonical:v1',
      projectId:'tales-from-the-crip',
      characterId:'bonez',
      displayName:'Bonez',
      source:'designed',
      primaryLanguage:'en-US',
      referenceSamples:[{
        id:'sample:bonez:1',
        assetId:'asset:bonez:voice:1',
        sha256:SHA,
        language:'en-US',
        durationSeconds:8,
        rightsRef:'rights:bonez:owned-design',
        qualityEvidenceIds:['evidence:bonez:sample'],
      }],
      providerBindings:[{
        id:'binding:bonez:qwen',
        provider:'qwen3-tts',
        modelId:'qwen3-tts',
        providerVoiceRef:'bonez-v1',
        referenceSampleIds:['sample:bonez:1'],
        supportedLanguages:['en-US'],
        provenanceRefs:['provider:qwen3-tts'],
      }],
      languageVariants:[{
        id:'variant:bonez:en-US',
        voiceIdentityId:'voice:bonez:canonical:v1',
        language:'en-US',
        locale:'en-US',
        accentPolicy:'preserve-identity',
        providerBindingIds:['binding:bonez:qwen'],
      }],
      defaultVariantId:'variant:bonez:en-US',
      speakerFingerprintRefs:['speaker-embedding:ecapa-voxceleb:bonez-v1'],
      minimumSpeakerSimilarity:0.80,
      approvedAt:'2026-09-29T00:00:00.000Z',
      approvedBy:'owner-user-id',
    });

    expect(identity.subject).toEqual({type:'character',id:'tales-from-the-crip:bonez'});
    expect(identity.id).toBe('voice:bonez:canonical:v1');
    expect(identity.status).toBe('approved');
    expect(validateCanonicalVoiceIdentity(identity)).toEqual([]);
  });

  it('maps fingerprint + explicit approval receipts into the shared validator',()=>{
    const identity=directorVoiceIdentityToCanonical({
      id:'voice:bonez:canonical:v1',
      projectId:'tales-from-the-crip',
      characterId:'bonez',
      displayName:'Bonez',
      source:'designed',
      primaryLanguage:'en-US',
      referenceSamples:[{
        id:'sample:bonez:1',assetId:'asset:bonez:voice:1',sha256:SHA,language:'en-US',
        durationSeconds:8,rightsRef:'rights:bonez:owned-design',qualityEvidenceIds:['evidence:sample'],
      }],
      providerBindings:[{
        id:'binding:bonez:qwen',provider:'qwen3-tts',modelId:'qwen3-tts',
        providerVoiceRef:'bonez-v1',referenceSampleIds:['sample:bonez:1'],
        supportedLanguages:['en-US'],provenanceRefs:['provider:qwen3-tts'],
      }],
      languageVariants:[{
        id:'variant:bonez:en-US',voiceIdentityId:'voice:bonez:canonical:v1',
        language:'en-US',accentPolicy:'preserve-identity',providerBindingIds:['binding:bonez:qwen'],
      }],
      defaultVariantId:'variant:bonez:en-US',
      speakerFingerprintRefs:['speaker-embedding:ecapa-voxceleb:bonez-v1'],
      minimumSpeakerSimilarity:0.80,
      approvedAt:'2026-09-29T00:00:00.000Z',
      approvedBy:'owner-user-id',
    });

    const fingerprint=directorSpeakerFingerprintToCanonical({
      id:'fp:bonez:1',projectId:'tales-from-the-crip',characterId:'bonez',
      sourceAssetId:'asset:bonez:voice:1',sourceSha256:SHA,normalizedAudioSha256:NORMALIZED,
      modelId:'ecapa-voxceleb',modelRevision:'pinned-v1',embeddingDimensions:192,
      embeddingSha256:EMBEDDING,fingerprintRef:'speaker-embedding:ecapa-voxceleb:bonez-v1',
      quantization:'float32-sha256',sampleRateHz:16000,durationSeconds:8,qualityClaim:false,
      evidenceIds:['evidence:fp'],createdAt:'2026-09-29T00:01:00.000Z',
    });
    const approval=directorVoiceApprovalToCanonical({
      id:'approval:bonez:1',projectId:'tales-from-the-crip',characterId:'bonez',
      voiceIdentityId:'voice:bonez:canonical:v1',candidateAssetId:'asset:bonez:voice:1',
      candidateSha256:SHA,speakerFingerprintReceiptId:'fp:bonez:1',
      speakerFingerprintRef:'speaker-embedding:ecapa-voxceleb:bonez-v1',
      minimumSpeakerSimilarity:0.80,provider:'qwen3-tts',modelId:'qwen3-tts',
      providerVoiceRef:'bonez-v1',authority:'DIRECTOR_EXPLICIT_VOICE_APPROVAL',
      evidenceIds:['evidence:approval'],approvedBy:'owner-user-id',
      approvedAt:'2026-09-29T00:02:00.000Z',
    });

    expect(validateSpeakerFingerprintReceipt(fingerprint)).toEqual([]);
    expect(validateVoiceApprovalReceipt(identity,approval,fingerprint)).toEqual([]);
  });
});
