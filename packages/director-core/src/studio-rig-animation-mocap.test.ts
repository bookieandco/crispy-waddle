import {describe,expect,it,vi} from 'vitest'
import {createRigAnimationProvider} from './studio-rig-animation'
import {createDirectorStudioAction} from './studio-governed-action'
import type {MotionCapture3dPlan} from './motion-capture-3d'

const track={trackId:'t',class:'character' as const,instanceId:'c',frameStart:0,frameEnd:24,annotations:[{frame:0,class:'character' as const,instanceId:'c',confidence:.9,keypoints:[{name:'head',x:.5,y:.2,confidence:.9}]}],source:'hybrid' as const,confidence:.9,approved:true}
const parents={hips:null,head:'hips',leftFoot:'hips',rightFoot:'hips'} as const
const motionCapturePlan:MotionCapture3dPlan={
  id:'mocap:rig',projectId:'p',characterAssetId:'char',
  capture:{id:'capture',mode:'monocular',sourceAssetIds:['video'],subjectIds:['actor'],requiredChannels:['body'],fullBodyVisible:true,feetVisible:true,calibrated:false,evidenceIds:['capture-evidence']},
  sourceSkeleton:{id:'source',topologyId:'smpl',jointNames:['hips','head','leftFoot','rightFoot'],parentByJoint:parents,rootJoint:'hips',restPose:'t-pose',forwardAxis:'+Z',upAxis:'+Y',rotationOrder:'ZXY',unitScaleMeters:1,fps:24,hasFingerJoints:false},
  targetSkeleton:{id:'target',topologyId:'rigify',jointNames:['hips','head','leftFoot','rightFoot'],parentByJoint:parents,rootJoint:'hips',restPose:'t-pose',forwardAxis:'+Z',upAxis:'+Y',rotationOrder:'ZXY',unitScaleMeters:1,fps:24,hasFingerJoints:false},
  certificationPolicy:{maxFootSlideCm:2,maxGroundPenetrationCm:1,maxRootDriftCm:2,maxJitterScore:.2,requireContactPreservation:true,requireRoundTripExport:true},
  evidenceIds:['mocap-plan-evidence'],authority:'DIRECTOR_MOTION_CAPTURE_3D_PLAN',
}

function request(){
  return createDirectorStudioAction({
    id:'rig-action',userId:'u',requestedAt:'now',projectId:'p',capability:'rig',inputAssetIds:['char'],
    parameters:{trackingArtifactId:'tracking',tracks:[track],channels:['body'],motionCapturePlan},
  })
}

describe('Studio rig mocap certification gate',()=>{
  it('admits a mocap rig artifact only after Blender certification passes',async()=>{
    const provider=createRigAnimationProvider({name:'test',animate:vi.fn(async()=>({
      artifactId:'artifact',rigAssetId:'rig',animationAssetId:'anim',provider:'blender-worker',evidenceIds:['solve'],frameStart:0,frameEnd:24,
      motionCertification:{
        planId:'mocap:rig',projectId:'p',characterAssetId:'char',blenderVersion:'4.x',rigAssetId:'rig',animationAssetId:'anim',
        restPoseAligned:true,boneMapComplete:true,scaleNormalized:true,fpsNormalized:true,sideMappingCorrect:true,jointFlipCount:0,
        footSlideCm:.5,groundPenetrationCm:.1,rootDriftCm:.2,jitterScore:.05,contactPreserved:true,roundTripExported:true,
        evidenceIds:['blender-cert'],authority:'DIRECTOR_BLENDER_MOTION_CERTIFICATION' as const,
      },
    }))})
    const req=request()
    const result=await provider.execute(req.action,req)
    expect(result.evidenceIds).toContain('mocap-route:direct-blender')
    expect(result.evidenceIds).toContain('blender-cert')
  })

  it('fails closed when the worker omits Blender certification',async()=>{
    const provider=createRigAnimationProvider({name:'test',animate:vi.fn(async()=>({
      artifactId:'artifact',rigAssetId:'rig',animationAssetId:'anim',provider:'worker',evidenceIds:['solve'],frameStart:0,frameEnd:24,
    }))})
    const req=request()
    await expect(provider.execute(req.action,req)).rejects.toThrow('missing Blender motion certification')
  })
})
