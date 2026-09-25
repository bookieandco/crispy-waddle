import type { ActionRequest } from '@jhadina/action-core'
import type { VideoTrack } from './studio-contracts'
import type { DirectorStudioAction, DirectorStudioCapabilityProvider } from './studio-governed-action'
import { validateAnimationPrinciplesPlan, type AnimationPrinciplesPlan } from './animation-principles.js'
import { performanceRigEvidence, validateCharacterPerformanceRigPlan, type CharacterPerformanceRigPlan } from './character-performance-rig.js'

export type RigChannel='body'|'head'|'face'|'hands'
export interface RigAnimationInput {
  characterAssetId:string
  trackingArtifactId:string
  tracks:VideoTrack[]
  channels:RigChannel[]
  animationPlan?:AnimationPrinciplesPlan
  performancePlan?:CharacterPerformanceRigPlan
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
    continuityRef:typeof p.continuityRef==='string'?p.continuityRef:undefined,
  }
  const errors=validateRigAnimationInput(input)
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
          ...(input.continuityRef?[`continuity:${input.continuityRef}`]:[]),
        ],
      }
    },
  }
}
