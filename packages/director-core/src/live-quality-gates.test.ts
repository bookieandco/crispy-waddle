import {describe,expect,it} from 'vitest';
import {
  evaluateDirectorLiveTake,
  evaluateDirectorQuality5Repair,
  type DirectorLiveTakeReviewInput,
} from './live-quality-gates';

const observations=()=>[
  'identity-stability','face-stability','hand-anatomy','blink-naturalism',
  'motion-plausibility','camera-plan-match','focus-plan-match',
  'performance-plan-match','background-geometry','audio-sync',
].map(metric=>({
  metric:metric as any,score:.95,confidence:.9,evidenceIds:['e:'+metric],
}));

function take(purpose:'quality4-canary'|'quality5-stress'='quality4-canary'):DirectorLiveTakeReviewInput{
  return {
    purpose,projectId:'p',characterId:'bonez',
    artifact:{
      providerId:'hunyuan-video-1.5',modelId:'hunyuan-video-1.5-480p-i2v-step-distilled',
      modelVersion:'HunyuanVideo-1.5',providerJobId:'job',providerRuntimeReceiptId:'runtime:1',
      seed:42,referenceAssetId:'ref',referenceSha256:'a'.repeat(64),
      outputAssetId:'video',outputSha256:'b'.repeat(64),contentType:'video/mp4',
      measuredDurationSeconds:5.04,storageVerified:true,productionProvider:true,evidenceIds:['provider'],
    },
    performance:{
      audioAssetId:'audio',voiceIdentityId:'voice',speakerFingerprintReceiptId:'fp-receipt',speakerFingerprintRef:'fingerprint',
      speakerSimilarity:.94,lipSyncScore:.93,movedAwayFromChair:true,dialoguePerformed:true,
      interactionRefs:['chair','microphone','set'],evidenceIds:['performance'],
    },
    observations:observations(),evidenceIds:['review'],
  };
}

describe('Director live quality gates',()=>{
  it('keeps renderer provenance separate from independent Q4 QC',()=>{
    const result=evaluateDirectorLiveTake(take());
    expect(result.admissible).toBe(true);
    expect(result.authority).toBe('DIRECTOR_LIVE_TAKE_QC');
  });

  it('rejects a smoke renderer and a stationary Bonez take',()=>{
    const input=take();
    input.artifact.providerId='director-certification-smoke';
    input.performance.movedAwayFromChair=false;
    const result=evaluateDirectorLiveTake(input);
    expect(result.admissible).toBe(false);
    expect(result.reasons).toContain('DIRECTOR_LIVE_TAKE_SMOKE_PROVIDER_FORBIDDEN');
    expect(result.reasons).toContain('DIRECTOR_BONEZ_MOVEMENT_AWAY_FROM_CHAIR_REQUIRED');
  });

  it('recognizes a real ranged Q5 stress failure without calling it a pass',()=>{
    const input=take('quality5-stress');
    input.observations=observations().map((row,index)=>
      index===2?{...row,score:.2,hardFailure:true,startSeconds:1,endSeconds:2}:row
    );
    const result=evaluateDirectorLiveTake(input);
    expect(result.admissible).toBe(false);
    expect(result.expectedFailureObserved).toBe(true);
  });

  it('does not count a structurally invalid take as the intentional Q5 failure',()=>{
    const input=take('quality5-stress');
    input.artifact.storageVerified=false;
    input.observations=observations().map((row,index)=>
      index===2?{...row,score:.2,hardFailure:true,startSeconds:1,endSeconds:2}:row
    );
    const result=evaluateDirectorLiveTake(input);
    expect(result.expectedFailureObserved).toBe(false);
    expect(result.reasons).toContain('DIRECTOR_QUALITY_5_STRESS_TAKE_STRUCTURALLY_INVALID');
    expect(result.reasons).toContain('DIRECTOR_QUALITY_5_REAL_FAILURE_REQUIRED');
  });

  it('requires a changed localized repair that passes post-QC and preserves unaffected work',()=>{
    const failed=observations().map((row,index)=>
      index===2?{...row,score:.2,hardFailure:true,startSeconds:1,endSeconds:2}:row
    );
    const failure=evaluateDirectorLiveTake({...take('quality5-stress'),observations:failed});
    const result=evaluateDirectorQuality5Repair({
      projectId:'p',characterId:'bonez',failureTakeReceiptId:'take:fail',
      failureAssetId:'video:fail',failureAssetSha256:'c'.repeat(64),
      failureQcReasons:failure.reasons,failureObservations:failed,
      plan:{
        id:'repair:1',projectId:'p',timelineVersionId:'timeline:1',sourceClipId:'clip:1',
        sourceAssetId:'video:fail',sourceDurationSeconds:5.04,repairStartSeconds:1,repairEndSeconds:2,
        maskAssetId:'mask:1',operation:'cleanup',instruction:'Repair malformed hand only.',
        evidenceIds:['defect:hand'],authority:'DIRECTOR_LOCALIZED_VIDEO_REPAIR',
      },
      repairedArtifact:{
        providerId:'editor-ai',modelId:'repair-v1',modelVersion:'1',providerJobId:'job:repair',
        providerRuntimeReceiptId:'runtime:repair',assetId:'video:repair',sha256:'d'.repeat(64),
        contentType:'video/mp4',storageVerified:true,evidenceIds:['repair-output'],
      },
      postRepairObservations:observations(),
      preservation:{
        identityPreserved:true,cameraTimingPreserved:true,unaffectedRegionsPreserved:true,
        preservedDirectiveIds:['directive:bonez:identity'],evidenceIds:['preservation:diff'],
      },
      evidenceIds:['q5'],
    });
    expect(result.admissible).toBe(true);
    expect(result.repairDurationSeconds).toBe(1);
  });

  it('rejects a repair that simply re-labels the failed bytes',()=>{
    const failed=observations().map((row,index)=>
      index===2?{...row,score:.2,hardFailure:true,startSeconds:1,endSeconds:2}:row
    );
    const failure=evaluateDirectorLiveTake({...take('quality5-stress'),observations:failed});
    const result=evaluateDirectorQuality5Repair({
      projectId:'p',characterId:'bonez',failureTakeReceiptId:'take:fail',
      failureAssetId:'video:fail',failureAssetSha256:'c'.repeat(64),
      failureQcReasons:failure.reasons,failureObservations:failed,
      plan:{
        id:'repair:1',projectId:'p',timelineVersionId:'timeline:1',sourceClipId:'clip:1',
        sourceAssetId:'video:fail',sourceDurationSeconds:5.04,repairStartSeconds:1,repairEndSeconds:2,
        maskAssetId:'mask:1',operation:'cleanup',instruction:'Repair malformed hand only.',
        evidenceIds:['defect:hand'],authority:'DIRECTOR_LOCALIZED_VIDEO_REPAIR',
      },
      repairedArtifact:{
        providerId:'editor-ai',modelId:'repair-v1',modelVersion:'1',providerJobId:'job:repair',
        providerRuntimeReceiptId:'runtime:repair',assetId:'video:repair',sha256:'c'.repeat(64),
        contentType:'video/mp4',storageVerified:true,evidenceIds:['repair-output'],
      },
      postRepairObservations:observations(),
      preservation:{
        identityPreserved:true,cameraTimingPreserved:true,unaffectedRegionsPreserved:true,
        preservedDirectiveIds:['directive:bonez:identity'],evidenceIds:['preservation:diff'],
      },
      evidenceIds:['q5'],
    });
    expect(result.admissible).toBe(false);
    expect(result.reasons).toContain('DIRECTOR_QUALITY_5_REPAIR_OUTPUT_MUST_CHANGE');
  });
});
