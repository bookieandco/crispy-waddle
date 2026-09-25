import {describe,expect,it} from 'vitest';
import {evaluateBlenderMotionCertification,planMotionCapture3dRoute,type MotionCapture3dPlan} from './motion-capture-3d';

const parent={hips:null,spine:'hips',head:'spine',leftFoot:'hips',rightFoot:'hips'} as const;
const plan:MotionCapture3dPlan={
  id:'mocap:1',projectId:'p',characterAssetId:'char:1',
  capture:{id:'capture:1',mode:'monocular',sourceAssetIds:['video:1'],subjectIds:['actor:1'],requiredChannels:['body'],fullBodyVisible:true,feetVisible:true,calibrated:false,calibrationPose:'t-pose',evidenceIds:['capture:approved']},
  sourceSkeleton:{id:'source',topologyId:'smpl',jointNames:['hips','spine','head','leftFoot','rightFoot'],parentByJoint:parent,rootJoint:'hips',restPose:'t-pose',forwardAxis:'+Z',upAxis:'+Y',rotationOrder:'ZXY',unitScaleMeters:1,fps:30,hasFingerJoints:false},
  targetSkeleton:{id:'target',topologyId:'rigify-human',jointNames:['hips','spine','head','leftFoot','rightFoot'],parentByJoint:parent,rootJoint:'hips',restPose:'a-pose',forwardAxis:'-Z',upAxis:'+Y',rotationOrder:'QUATERNION',unitScaleMeters:1,fps:24,hasFingerJoints:false},
  learnedRetarget:{id:'deep-motion-editing',runtimeRole:'research-specialist',allowedSourceTopologyIds:['smpl'],allowedTargetTopologyIds:['rigify-human'],requiredRestPose:'t-pose',evidenceIds:['github:deep-motion-editing']},
  certificationPolicy:{maxFootSlideCm:2,maxGroundPenetrationCm:1,maxRootDriftCm:3,maxJitterScore:.2,requireContactPreservation:true,requireRoundTripExport:true},
  evidenceIds:['director:mocap-plan'],authority:'DIRECTOR_MOTION_CAPTURE_3D_PLAN',
};

describe('3D mocap and Blender certification',()=>{
  it('routes convention mismatches through normalization and keeps research retargeters out of production',()=>{
    const decision=planMotionCapture3dRoute(plan);
    expect(decision.admissible).toBe(true);
    expect(decision.route).toBe('normalize-then-blender');
    expect(decision.notes).toContain('DIRECTOR_MOCAP_LEARNED_RETARGET_NOT_PRODUCTION_ADMITTED');
    expect(decision.requiredSteps).toContain('blender-motion-certification');
  });
  it('permits a learned retargeter only after explicit production admission and compatible topology/rest pose',()=>{
    const compatible:MotionCapture3dPlan={
      ...plan,
      targetSkeleton:{...plan.targetSkeleton,restPose:'t-pose',forwardAxis:'+Z',rotationOrder:'ZXY',fps:30},
      learnedRetarget:{...plan.learnedRetarget!,runtimeRole:'production-admitted'},
    };
    expect(planMotionCapture3dRoute(compatible).route).toBe('learned-retarget-then-blender');
  });
  it('fails Blender certification when foot skating exceeds the project policy',()=>{
    const receipt={
      planId:'mocap:1',projectId:'p',characterAssetId:'char:1',blenderVersion:'4.x',rigAssetId:'rig:1',animationAssetId:'anim:1',
      restPoseAligned:true,boneMapComplete:true,scaleNormalized:true,fpsNormalized:true,sideMappingCorrect:true,jointFlipCount:0,
      footSlideCm:4,groundPenetrationCm:.2,rootDriftCm:.5,jitterScore:.05,contactPreserved:true,roundTripExported:true,
      evidenceIds:['blender:qa'],authority:'DIRECTOR_BLENDER_MOTION_CERTIFICATION' as const,
    };
    const result=evaluateBlenderMotionCertification(plan,receipt);
    expect(result.approved).toBe(false);
    expect(result.reasons).toContain('DIRECTOR_BLENDER_FOOT_SLIDE_EXCEEDED');
  });
});
