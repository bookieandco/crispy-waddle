import {describe,it,expect} from 'vitest';
import {
  JHADINA_CANONICAL_VOICE_IDENTITY_CANDIDATE,
  JHADINA_CANONICAL_VOICE_IDENTITY_ID,
} from './jhadina-voice-identity.js';
import {
  JHADINA_VOICE_CALIBRATION_PACK_V1,
  REQUIRED_VOICE_CALIBRATION_CATEGORIES,
  validateVoiceCalibrationPack,
} from './voice-calibration.js';
import {
  createVoiceAuditionPlan,
  rejectVoiceAuditionCandidate,
  shortlistVoiceAuditionCandidate,
  validateVoiceAuditionCandidate,
  type VoiceAuditionCandidateReceipt,
} from './voice-audition.js';

const SHA='a'.repeat(64);

function candidate(overrides:Partial<VoiceAuditionCandidateReceipt>={}):VoiceAuditionCandidateReceipt{
  return {
    id:'audition:jhadina:qwen:1',
    voiceIdentityId:JHADINA_CANONICAL_VOICE_IDENTITY_ID,
    provider:'qwen3-tts',
    providerTaskId:'task:qwen:1',
    modelId:'qwen3-tts',
    providerVoiceRef:'designed:jhadina:candidate-1',
    language:'en-US',
    calibrationPackId:JHADINA_VOICE_CALIBRATION_PACK_V1.id,
    calibrationSampleIds:[
      'jhadina-calibration:v1:normal',
      'jhadina-calibration:v1:thoughtful',
      'jhadina-calibration:v1:serious',
      'jhadina-calibration:v1:playful',
    ],
    artifactAssetId:'asset:jhadina:audition:qwen:1',
    artifactSha256:SHA,
    durationSeconds:31,
    transcript:'Original Jhadina calibration audition composite.',
    state:'candidate_unapproved',
    qualityClaim:false,
    provenanceRefs:['provider:qwen3-tts','calibration:jhadina:v1'],
    createdAt:'2026-10-03T20:00:00.000Z',
    ...overrides,
  };
}

describe('JHADINA-VOICE.7 calibration and audition',()=>{
  it('contains every required register exactly once under the same canonical identity',()=>{
    expect(validateVoiceCalibrationPack(JHADINA_VOICE_CALIBRATION_PACK_V1)).toEqual([]);
    expect(JHADINA_VOICE_CALIBRATION_PACK_V1.samples).toHaveLength(REQUIRED_VOICE_CALIBRATION_CATEGORIES.length);
    expect(new Set(JHADINA_VOICE_CALIBRATION_PACK_V1.samples.map(item=>item.category)).size)
      .toBe(REQUIRED_VOICE_CALIBRATION_CATEGORIES.length);
    expect(JHADINA_VOICE_CALIBRATION_PACK_V1.samples.every(
      item=>item.voiceIdentityId===JHADINA_CANONICAL_VOICE_IDENTITY_ID
    )).toBe(true);
    expect(JHADINA_VOICE_CALIBRATION_PACK_V1.samples.every(item=>item.identityMustRemainStable)).toBe(true);
  });

  it('keeps serious calibration free of playful/sass/escalation performance',()=>{
    const serious=JHADINA_VOICE_CALIBRATION_PACK_V1.samples.find(item=>item.category==='serious');
    expect(serious).toBeDefined();
    expect(serious?.delivery.playfulness).toBe(0);
    expect(serious?.delivery.operationalSass).toBe(0);
    expect(serious?.delivery.absurdEscalation).toBe(0);
  });

  it('creates an audition plan only for a candidate identity and never treats selection as approval',()=>{
    const plan=createVoiceAuditionPlan(
      JHADINA_CANONICAL_VOICE_IDENTITY_CANDIDATE,
      JHADINA_VOICE_CALIBRATION_PACK_V1,
    );
    expect(plan.voiceIdentityId).toBe(JHADINA_CANONICAL_VOICE_IDENTITY_ID);
    expect(plan.requestedCandidates).toBe(4);
    expect(plan.providers).toEqual(['qwen3-tts','voxcpm2']);
    expect(plan.requiresExplicitApproval).toBe(true);
    expect(plan.selectionDoesNotApprove).toBe(true);

    expect(()=>createVoiceAuditionPlan(
      {...JHADINA_CANONICAL_VOICE_IDENTITY_CANDIDATE,status:'approved'},
      JHADINA_VOICE_CALIBRATION_PACK_V1,
    )).toThrow('VOICE_AUDITION_IDENTITY_MUST_BE_CANDIDATE');
  });

  it('requires exact artifact provenance and admitted calibration sample ids',()=>{
    expect(validateVoiceAuditionCandidate(
      candidate(),
      JHADINA_CANONICAL_VOICE_IDENTITY_CANDIDATE,
      JHADINA_VOICE_CALIBRATION_PACK_V1,
    )).toEqual([]);

    const badSha=validateVoiceAuditionCandidate(
      candidate({artifactSha256:'not-a-sha'}),
      JHADINA_CANONICAL_VOICE_IDENTITY_CANDIDATE,
      JHADINA_VOICE_CALIBRATION_PACK_V1,
    );
    expect(badSha).toContain('VOICE_AUDITION_ARTIFACT_PROVENANCE_REQUIRED');

    const badSample=validateVoiceAuditionCandidate(
      candidate({calibrationSampleIds:['invented-sample']}),
      JHADINA_CANONICAL_VOICE_IDENTITY_CANDIDATE,
      JHADINA_VOICE_CALIBRATION_PACK_V1,
    );
    expect(badSample).toContain('VOICE_AUDITION_CALIBRATION_SAMPLE_INVALID');
  });

  it('shortlists without approving and does not resurrect a rejected candidate',()=>{
    const original=candidate();
    const shortlisted=shortlistVoiceAuditionCandidate(original);
    expect(shortlisted.state).toBe('shortlisted');
    expect(shortlisted.voiceIdentityId).toBe(JHADINA_CANONICAL_VOICE_IDENTITY_ID);
    expect(JHADINA_CANONICAL_VOICE_IDENTITY_CANDIDATE.status).toBe('candidate');

    const rejected=rejectVoiceAuditionCandidate(original);
    expect(rejected.state).toBe('rejected');
    expect(()=>shortlistVoiceAuditionCandidate(rejected)).toThrow(
      'VOICE_AUDITION_REJECTED_CANDIDATE_CANNOT_SHORTLIST'
    );
  });

  it('keeps callback calibration synthetic instead of manufacturing relationship history',()=>{
    const callback=JHADINA_VOICE_CALIBRATION_PACK_V1.samples.find(item=>item.category==='callback-reentry');
    expect(callback?.syntheticScenario).toBe(true);
    expect(callback?.intent.toLowerCase()).toContain('synthetic');
    expect(callback?.intent.toLowerCase()).toContain('never claims real shared history');
  });
});
