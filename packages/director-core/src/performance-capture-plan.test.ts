import {describe,expect,it} from 'vitest';
import {performanceCaptureEvidence,validatePerformanceCapturePlan,type PerformanceCapturePlan} from './performance-capture-plan';

const plan:PerformanceCapturePlan={
  id:'capture:1',
  projectId:'project-1',
  characterAssetId:'character-1',
  framing:'full-body',
  fps:24,
  calibrationCountdownSeconds:5,
  calibrationPose:'standing neutral with arms diagonally out',
  trackedLandmarks:['head','leftWrist','rightWrist','waist','leftHeel','rightHeel'],
  trackingLoss:{policy:'return-to-rest',returnDurationFrames:12},
  trackingStrength:1,
  passes:[
    {id:'body-pass',kind:'body',frameStart:0,frameEnd:240,trackedLandmarks:['head','leftWrist','rightWrist','waist','leftHeel','rightHeel'],blendInFrames:0,blendOutFrames:0,evidenceIds:['capture:body']},
    {id:'face-pass',kind:'face',frameStart:0,frameEnd:240,trackedLandmarks:['head'],blendInFrames:2,blendOutFrames:2,evidenceIds:['capture:face-close']},
    {id:'left-wrist-fix',kind:'hands',frameStart:90,frameEnd:130,trackedLandmarks:['leftWrist'],blendInFrames:4,blendOutFrames:4,evidenceIds:['repair:left-wrist']},
  ],
  controllerWindows:[
    {id:'live',frameStart:0,frameEnd:179,controller:'body-tracking',bodyTrackingStrength:1,evidenceIds:['capture:live']},
    {id:'jump-trigger',frameStart:180,frameEnd:210,controller:'trigger-animation',bodyTrackingStrength:0,evidenceIds:['trigger:jump']},
  ],
  setupEvidenceIds:['camera:full-body-in-frame','lighting:usable','background:contrast-usable'],
  authority:'DIRECTOR_PERFORMANCE_CAPTURE_PLAN',
};

describe('performance capture plan',()=>{
  it('supports calibrated full-body capture with layered repair passes',()=>{
    expect(validatePerformanceCapturePlan(plan)).toEqual([]);
    expect(performanceCaptureEvidence(plan)).toEqual(expect.arrayContaining([
      'performance-capture-framing:full-body',
      'performance-capture-loss:return-to-rest',
      'performance-capture-pass:left-wrist-fix:hands:90-130',
      'performance-capture-controller:jump-trigger:trigger-animation:0',
    ]));
  });

  it('rejects competing manual/trigger control while body tracking remains active',()=>{
    const invalid={...plan,controllerWindows:[
      {id:'bad',frameStart:0,frameEnd:10,controller:'manual-dragger' as const,bodyTrackingStrength:.5,evidenceIds:['bad']},
    ]};
    expect(validatePerformanceCapturePlan(invalid)).toContain('DIRECTOR_CAPTURE_CONTROLLER_CONFLICT:bad');
  });

  it('requires a bounded return duration for return-to-rest',()=>{
    expect(validatePerformanceCapturePlan({...plan,trackingLoss:{policy:'return-to-rest'}}))
      .toContain('DIRECTOR_CAPTURE_RETURN_DURATION_REQUIRED');
  });
});
