import { describe, expect, it } from 'vitest';
import {
  buildDirectorCoquiVoiceJob,
  buildDirectorLivePortraitJob,
  buildDirectorMuseTalkLipSyncJob,
  buildDirectorSadTalkerFallbackJob,
  type DirectorGovernedMediaAsset,
} from './human-media-adapters.js';
import type {
  CharacterVoiceIdentity,
  DialogueGenerationRequest,
} from './voice-identity.js';
import type { PerformanceDirectionPlan } from './performance-direction.js';
import type { VoiceSyncInput } from './studio-voice-sync.js';

const sha=(char:string)=>char.repeat(64);

const audio:DirectorGovernedMediaAsset={
  assetId:'audio:1',
  mediaType:'audio',
  sha256:sha('a'),
  rightsEvidenceIds:['rights:audio'],
};

const video:DirectorGovernedMediaAsset={
  assetId:'video:1',
  mediaType:'video',
  sha256:sha('b'),
  rightsEvidenceIds:['rights:video'],
};

const image:DirectorGovernedMediaAsset={
  assetId:'image:1',
  mediaType:'image',
  sha256:sha('c'),
  rightsEvidenceIds:['rights:image'],
};

function identity():CharacterVoiceIdentity{
  return {
    id:'voice:1',
    projectId:'project:1',
    characterId:'character:1',
    displayName:'Actor',
    source:'consented-clone',
    consentRef:'consent:voice:1',
    primaryLanguage:'en',
    referenceSamples:[{
      id:'sample:1',
      assetId:'voice-ref:1',
      sha256:sha('d'),
      language:'en',
      durationSeconds:12,
      rightsRef:'rights:voice-ref',
      qualityEvidenceIds:['voice-ref-qc:1'],
    }],
    providerBindings:[{
      id:'binding:coqui',
      provider:'coqui-tts-local',
      modelId:'xtts-v2-admitted',
      referenceSampleIds:['sample:1'],
      supportedLanguages:['en'],
      sampleRateHz:24000,
      provenanceRefs:['model-provenance:xtts'],
    }],
    languageVariants:[{
      id:'variant:en',
      voiceIdentityId:'voice:1',
      language:'en',
      accentPolicy:'preserve-identity',
      providerBindingIds:['binding:coqui'],
    }],
    defaultVariantId:'variant:en',
    speakerFingerprintRefs:['speaker-fingerprint:1'],
    minimumSpeakerSimilarity:.85,
    approvedAt:'2026-10-06T20:00:00.000Z',
    approvedBy:'director-owner',
  };
}

function dialogue():DialogueGenerationRequest{
  return {
    id:'dialogue:1',
    projectId:'project:1',
    characterId:'character:1',
    voiceIdentityId:'voice:1',
    voiceVariantId:'variant:en',
    language:'en',
    text:'This is the approved line.',
    sceneId:'scene:1',
    lineId:'line:1',
    deliveryInstruction:'natural, conversational',
    evidenceIds:['script:approved'],
  };
}

const performance:PerformanceDirectionPlan={
  version:1,
  sceneFunction:'Deliver the product proof naturally.',
  actors:[{
    actorId:'actor:1',
    characterId:'character:1',
    startingState:'neutral',
    endingState:'confident',
  }],
  beats:[{
    id:'beat:1',
    kind:'gesture',
    actorId:'actor:1',
    action:'small hand gesture',
    endState:'hand settles naturally',
  }],
  evidenceRefs:['performance-reference:1'],
};

const voiceSync:VoiceSyncInput={
  videoAssetId:'video:1',
  audioAssetId:'audio:1',
  mode:'lip-sync',
  tracks:[{startMs:0,endMs:1000,viseme:'A',confidence:.92}],
  characterTrackId:'actor:1',
  continuityRef:'continuity:actor:1',
};

describe('Director local human-media adapters',()=>{
  it('builds a consented Coqui clone job and keeps cloned voice media local',()=>{
    const job=buildDirectorCoquiVoiceJob({
      jobId:'human-media:voice:1',
      identity:identity(),
      request:dialogue(),
      providerBindingId:'binding:coqui',
      modelLicenseEvidenceIds:['license:xtts-commercial'],
      allowCloudBurst:true,
    });
    expect(job.engine).toBe('coqui-tts');
    expect(job.task).toBe('voice-clone');
    expect(job.sensitiveData).toBe(true);
    expect(job.allowCloudBurst).toBe(false);
    expect(job.voiceIdentityId).toBe('voice:1');
    expect(job.inputAssets[0]).toMatchObject({
      assetId:'voice-ref:1',
      role:'target-voice',
      rightsEvidenceIds:['rights:voice-ref'],
    });
    expect(job.evidenceIds).toEqual(expect.arrayContaining([
      'consent:voice:1',
      'license:xtts-commercial',
      'model-provenance:xtts',
      'voice-ref-qc:1',
    ]));
  });

  it('refuses Coqui when the exact model has no license evidence',()=>{
    expect(()=>buildDirectorCoquiVoiceJob({
      jobId:'human-media:voice:1',
      identity:identity(),
      request:dialogue(),
      providerBindingId:'binding:coqui',
      modelLicenseEvidenceIds:[],
    })).toThrow('DIRECTOR_COQUI_MODEL_LICENSE_EVIDENCE_REQUIRED');
  });

  it('requires a commercially approved replacement detector for LivePortrait',()=>{
    expect(()=>buildDirectorLivePortraitJob({
      jobId:'human-media:portrait:bad-detector',
      projectId:'project:1',
      source:image,
      drivingVideo:video,
      performancePlan:performance,
      detector:{
        id:'detector:commercial',
        modelId:'commercial-face-detector',
        sha256:'not-a-digest',
        licenseEvidenceIds:['license:commercial-detector'],
        commercialUseApproved:true,
      },
      evidenceIds:['ugc-plan:1'],
    })).toThrow('DIRECTOR_LIVEPORTRAIT_DETECTOR_PROVENANCE_INVALID');

    expect(()=>buildDirectorLivePortraitJob({
      jobId:'human-media:portrait:1',
      projectId:'project:1',
      source:image,
      drivingVideo:video,
      performancePlan:performance,
      detector:{
        id:'detector:insightface-upstream',
        modelId:'insightface-upstream',
        sha256:sha('e'),
        licenseEvidenceIds:['license:research-only'],
        commercialUseApproved:false,
      },
      evidenceIds:['ugc-plan:1'],
    })).toThrow('DIRECTOR_LIVEPORTRAIT_COMMERCIAL_DETECTOR_REQUIRED');

    const job=buildDirectorLivePortraitJob({
      jobId:'human-media:portrait:1',
      projectId:'project:1',
      source:image,
      drivingVideo:video,
      performancePlan:performance,
      detector:{
        id:'detector:commercial',
        modelId:'commercial-face-detector',
        sha256:sha('f'),
        licenseEvidenceIds:['license:commercial-detector'],
        commercialUseApproved:true,
      },
      evidenceIds:['ugc-plan:1'],
      allowCloudBurst:true,
    });
    expect(job.engine).toBe('liveportrait');
    expect(job.task).toBe('portrait-animation');
    expect(job.parameters).toMatchObject({
      detector:expect.objectContaining({commercialUseApproved:true}),
    });
    expect(String(job.parameters.performanceDirective)).toContain('Scene function');
  });

  it('bridges the governed Studio voice-sync lineage into MuseTalk without inventing QC',()=>{
    const job=buildDirectorMuseTalkLipSyncJob({
      jobId:'human-media:musetalk:1',
      projectId:'project:1',
      voiceSync,
      video,
      audio,
      evidenceIds:['voice-sync-action:1'],
      allowCloudBurst:true,
    });
    expect(job.engine).toBe('musetalk');
    expect(job.task).toBe('lip-sync');
    expect(job.inputAssets.map(asset=>asset.assetId)).toEqual(['video:1','audio:1']);
    expect(job.parameters).toMatchObject({
      mode:'lip-sync',
      characterTrackId:'actor:1',
      continuityRef:'continuity:actor:1',
      acceptanceAuthority:'WATCH_QC',
    });
  });

  it('rejects nested MuseTalk plans from another Director project',()=>{
    expect(()=>buildDirectorMuseTalkLipSyncJob({
      jobId:'human-media:musetalk:project-mismatch',
      projectId:'project:1',
      voiceSync:{
        ...voiceSync,
        transcriptPlan:{
          id:'transcript:1',
          projectId:'project:2',
          audioAssetId:'audio:1',
          mode:'untimed-text',
          audioDurationMs:1000,
          text:'This is the approved line.',
          evidenceIds:['transcript-source:1'],
          authority:'DIRECTOR_TRANSCRIPT_LIP_SYNC_PLAN',
        },
      },
      video,
      audio,
      evidenceIds:['voice-sync-action:1'],
    })).toThrow('DIRECTOR_MUSETALK_TRANSCRIPT_PROJECT_MISMATCH');
  });

  it('fails MuseTalk if governed asset IDs do not match the existing Studio voice-sync request',()=>{
    expect(()=>buildDirectorMuseTalkLipSyncJob({
      jobId:'human-media:musetalk:1',
      projectId:'project:1',
      voiceSync,
      video:{...video,assetId:'video:other'},
      audio,
      evidenceIds:['voice-sync-action:1'],
    })).toThrow('DIRECTOR_MUSETALK_GOVERNED_LINEAGE_MISMATCH');
  });

  it('keeps SadTalker explicit fallback-only and requires primary-attempt evidence',()=>{
    expect(()=>buildDirectorSadTalkerFallbackJob({
      jobId:'human-media:sadtalker:1',
      projectId:'project:1',
      sourceImage:image,
      audio,
      fallbackReason:'musetalk-unavailable',
      primaryAttemptEvidenceIds:[],
      evidenceIds:['ugc-plan:1'],
    })).toThrow('DIRECTOR_SADTALKER_PRIMARY_ATTEMPT_EVIDENCE_REQUIRED');

    const job=buildDirectorSadTalkerFallbackJob({
      jobId:'human-media:sadtalker:1',
      projectId:'project:1',
      sourceImage:image,
      audio,
      fallbackReason:'musetalk-qc-rejected',
      primaryAttemptEvidenceIds:['watch-rejection:musetalk:1'],
      evidenceIds:['ugc-plan:1'],
    });
    expect(job.engine).toBe('sadtalker');
    expect(job.task).toBe('talking-head');
    expect(job.parameters).toMatchObject({
      fallbackReason:'musetalk-qc-rejected',
      acceptanceAuthority:'WATCH_QC',
    });
    expect(job.evidenceIds).toContain('sadtalker-fallback:musetalk-qc-rejected');
  });
});
