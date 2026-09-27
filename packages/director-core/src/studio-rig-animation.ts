import type { ActionRequest } from '@jhadina/action-core'
import type { VideoTrack } from './studio-contracts'
import type { DirectorStudioAction, DirectorStudioCapabilityProvider } from './studio-governed-action'
import { validateAnimationPrinciplesPlan, type AnimationPrinciplesPlan } from './animation-principles.js'
import { evaluateBlenderMotionCertification, motionCapture3dEvidence, validateMotionCapture3dPlan, type BlenderMotionCertification, type MotionCapture3dPlan } from './motion-capture-3d.js'
import { performanceRigEvidence, validateCharacterPerformanceRigPlan, type CharacterPerformanceRigPlan } from './character-performance-rig.js'
import {
  characterAnimationEnhancementEvidence,
  validateCharacterLocomotionPlan,
  validateCharacterMotionEffectsPlan,
  type CharacterLocomotionPlan,
  type CharacterMotionEffectsPlan,
} from './character-animation-enhancements.js'
import {
  cartoonProductionEvidence,
  validateShotRigScopePlan,
  type ShotRigScopePlan,
} from './cartoon-production-workflow.js'

export type RigChannel='body'|'head'|'face'|'hands'
export interface RigAnimationInput {
  characterAssetId:string
  trackingArtifactId:string
  tracks:VideoTrack[]
  channels:RigChannel[]
  animationPlan?:AnimationPrinciplesPlan
  performancePlan?:CharacterPerformanceRigPlan
  motionEffectsPlan?:CharacterMotionEffectsPlan
  locomotionPlan?:CharacterLocomotionPlan
  rigScopePlan?:ShotRigScopePlan
  motionCapturePlan?:MotionCapture3dPlan
  continuityRef?:string
}
export interface RigAnimationArtifact {
  artifactId:string
  rigAssetId:string
  animationAssetId:string
  provider:string
  evidenceIds:string[]
  frameStart:number
  frameEnd:number
  motionCertification?:BlenderMotionCertification
}
export interface RigAnimationAdapter {
  readonly name:string
  animate(input:RigAnimationInput):Promise<RigAnimationArtifact>
}

export function validateRigAnimationInput(input:RigAnimationInput):string[] {
  const errors:string[]=[]
  if(!input.characterAssetId) errors.push('characterAssetId is required')
  if(!input.trackingArtifactId) errors.push('trackingArtifactId is required')
  if(!input.tracks.length) errors.push('approved tracking is required')
  if(input.tracks.some(t=>!t.approved)) errors.push('all rig source tracks must be approved')
  if(!input.channels.length) errors.push('at least one rig channel is required')
  if(input.animationPlan){for(const issue of validateAnimationPrinciplesPlan(input.animationPlan)) errors.push(`animation principle plan invalid: ${issue.code}`)}
  if(input.performancePlan){
    const decision=validateCharacterPerformanceRigPlan(input.performancePlan)
    if(!decision.valid) errors.push(...decision.reasons.map(reason=>`performance rig plan invalid: ${reason}`))
    if(input.performancePlan.characterAssetId!==input.characterAssetId) errors.push('performance rig characterAssetId must match rig characterAssetId')
  }
  if(input.motionEffectsPlan){
    const reasons=validateCharacterMotionEffectsPlan(input.motionEffectsPlan)
    if(reasons.length) errors.push(...reasons.map(reason=>`motion effects plan invalid: ${reason}`))
    if(input.motionEffectsPlan.characterAssetId!==input.characterAssetId) errors.push('motion effects characterAssetId must match rig characterAssetId')
  }
  if(input.locomotionPlan){
    const reasons=validateCharacterLocomotionPlan(input.locomotionPlan)
    if(reasons.length) errors.push(...reasons.map(reason=>`locomotion plan invalid: ${reason}`))
    if(input.locomotionPlan.characterAssetId!==input.characterAssetId) errors.push('locomotion characterAssetId must match rig characterAssetId')
  }
  if(input.motionCapturePlan){
    const reasons=validateMotionCapture3dPlan(input.motionCapturePlan)
    if(reasons.length) errors.push(...reasons.map(reason=>`motion capture 3d plan invalid: ${reason}`))
    if(input.motionCapturePlan.characterAssetId!==input.characterAssetId) errors.push('motion capture characterAssetId must match rig characterAssetId')
    for(const channel of input.motionCapturePlan.capture.requiredChannels){
      const required=channel==='body'?'body':channel==='hands'?'hands':'face'
      if(!input.channels.includes(required)) errors.push(`motion capture requires channel not requested: ${required}`)
    }
  }
  if(input.rigScopePlan){
    const reasons=validateShotRigScopePlan(input.rigScopePlan)
    if(reasons.length) errors.push(...reasons.map(reason=>`rig scope plan invalid: ${reason}`))
    if(input.rigScopePlan.characterAssetId!==input.characterAssetId) errors.push('rig scope characterAssetId must match rig characterAssetId')
    for(const channel of input.rigScopePlan.requiredChannels){
      if(!input.channels.includes(channel)) errors.push(`rig scope requires channel not requested: ${channel}`)
    }
  }
  return errors
}
function readTracks(v:unknown):VideoTrack[]{return Array.isArray(v)?v as VideoTrack[]:[]}
function readChannels(v:unknown):RigChannel[]{return Array.isArray(v)?v.filter(x=>['body','head','face','hands'].includes(String(x))) as RigChannel[]:[]}
function readInput(action:DirectorStudioAction):RigAnimationInput {
  const p=action.parameters??{}
  const input:RigAnimationInput={
    characterAssetId:action.inputAssetIds[0]??'',
    trackingArtifactId:typeof p.trackingArtifactId==='string'?p.trackingArtifactId:'',
    tracks:readTracks(p.tracks),
    channels:readChannels(p.channels),
    animationPlan:typeof p.animationPlan==='object'&&p.animationPlan!==null?p.animationPlan as AnimationPrinciplesPlan:undefined,
    performancePlan:typeof p.performancePlan==='object'&&p.performancePlan!==null?p.performancePlan as CharacterPerformanceRigPlan:undefined,
    motionEffectsPlan:typeof p.motionEffectsPlan==='object'&&p.motionEffectsPlan!==null?p.motionEffectsPlan as CharacterMotionEffectsPlan:undefined,
    locomotionPlan:typeof p.locomotionPlan==='object'&&p.locomotionPlan!==null?p.locomotionPlan as CharacterLocomotionPlan:undefined,
    rigScopePlan:typeof p.rigScopePlan==='object'&&p.rigScopePlan!==null?p.rigScopePlan as ShotRigScopePlan:undefined,
    motionCapturePlan:typeof p.motionCapturePlan==='object'&&p.motionCapturePlan!==null?p.motionCapturePlan as MotionCapture3dPlan:undefined,
    continuityRef:typeof p.continuityRef==='string'?p.continuityRef:undefined,
  }
  const errors=validateRigAnimationInput(input)
  if(input.performancePlan?.projectId!==undefined && input.performancePlan.projectId!==action.projectId) {
    errors.push('performance rig projectId must match rig projectId')
  }
  if(input.motionEffectsPlan?.projectId!==undefined && input.motionEffectsPlan.projectId!==action.projectId) {
    errors.push('motion effects projectId must match rig projectId')
  }
  if(input.locomotionPlan?.projectId!==undefined && input.locomotionPlan.projectId!==action.projectId) {
    errors.push('locomotion projectId must match rig projectId')
  }
  if(input.motionCapturePlan?.projectId!==undefined && input.motionCapturePlan.projectId!==action.projectId) {
    errors.push('motion capture projectId must match rig projectId')
  }
  if(input.rigScopePlan?.projectId!==undefined && input.rigScopePlan.projectId!==action.projectId) {
    errors.push('rig scope projectId must match rig projectId')
  }
  if(errors.length) throw new Error(`Invalid rig animation: ${errors.join('; ')}`)
  return input
}

/** Converts approved tracking evidence into a reusable rig + animation artifact. */
export function createRigAnimationProvider(adapter:RigAnimationAdapter):DirectorStudioCapabilityProvider {
  return {
    supports:capability=>capability==='rig',
    async execute(action:DirectorStudioAction,_request:ActionRequest<DirectorStudioAction>){
      if(action.capability!=='rig') throw new Error('Rig provider received wrong capability')
      const input=readInput(action)
      const artifact=await adapter.animate(input)
      if(artifact.frameEnd<artifact.frameStart) throw new Error('Rig animation returned invalid frame range')
      let motionCertificationEvidence:readonly string[]=[]
      if(input.motionCapturePlan){
        if(!artifact.motionCertification) throw new Error('Rig animation missing Blender motion certification')
        const certification=evaluateBlenderMotionCertification(input.motionCapturePlan,artifact.motionCertification)
        if(!certification.approved) throw new Error(`Rig animation failed Blender motion certification: ${certification.reasons.join(', ')}`)
        motionCertificationEvidence=certification.evidenceIds
      }
      return {
        capability:'rig',
        projectId:action.projectId,
        outputAssetIds:[artifact.rigAssetId,artifact.animationAssetId,artifact.artifactId],
        evidenceIds:[
          input.trackingArtifactId,
          ...artifact.evidenceIds,
          `rig-provider:${artifact.provider}`,
          `rig-channels:${input.channels.join(',')}`,
          `rig-frame-range:${artifact.frameStart}-${artifact.frameEnd}`,
          ...(input.animationPlan?[`animation-method:${input.animationPlan.method}`,...(input.animationPlan.evidenceRefs??[])]:[]),
          ...(input.performancePlan?performanceRigEvidence(input.performancePlan):[]),
          ...characterAnimationEnhancementEvidence({motionEffectsPlan:input.motionEffectsPlan,locomotionPlan:input.locomotionPlan}),
          ...cartoonProductionEvidence({rigScopePlan:input.rigScopePlan}),
          ...(input.motionCapturePlan?motionCapture3dEvidence(input.motionCapturePlan):[]),
          ...motionCertificationEvidence,
          ...(input.continuityRef?[`continuity:${input.continuityRef}`]:[]),
        ],
      }
    },
  }
}
