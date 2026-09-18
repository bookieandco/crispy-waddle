import type { ActionRequest } from '@jhadina/action-core'
import type { DirectorStudioAction, DirectorStudioCapabilityProvider } from './studio-governed-action'

export type SecondaryPhysicsMaterial='cloth'|'hair'|'fur'|'puppet-fabric'|'accessory'
export interface SecondaryPhysicsLayer {
  id:string
  material:SecondaryPhysicsMaterial
  attachment:string
  stiffness:number
  damping:number
  gravityScale:number
}
export interface SecondaryPhysicsInput {
  characterAssetId:string
  rigAssetId:string
  animationAssetId:string
  layers:SecondaryPhysicsLayer[]
  frameStart:number
  frameEnd:number
  continuityRef?:string
}
export interface SecondaryPhysicsArtifact {
  artifactId:string
  simulatedAnimationAssetId:string
  provider:string
  evidenceIds:string[]
  frameStart:number
  frameEnd:number
}
export interface SecondaryPhysicsAdapter {
  readonly name:string
  simulate(input:SecondaryPhysicsInput):Promise<SecondaryPhysicsArtifact>
}
export function validateSecondaryPhysicsInput(input:SecondaryPhysicsInput):string[]{
  const errors:string[]=[]
  if(!input.characterAssetId) errors.push('characterAssetId is required')
  if(!input.rigAssetId) errors.push('rigAssetId is required')
  if(!input.animationAssetId) errors.push('animationAssetId is required')
  if(!input.layers.length) errors.push('at least one physics layer is required')
  if(input.frameEnd<input.frameStart) errors.push('frame range is invalid')
  for(const layer of input.layers){
    if(!layer.id||!layer.attachment) errors.push('physics layers require id and attachment')
    if(layer.stiffness<0||layer.stiffness>1||layer.damping<0||layer.damping>1) errors.push('stiffness and damping must be between 0 and 1')
  }
  return errors
}
function readLayers(v:unknown):SecondaryPhysicsLayer[]{return Array.isArray(v)?v as SecondaryPhysicsLayer[]:[]}
function readInput(action:DirectorStudioAction):SecondaryPhysicsInput{
  const p=action.parameters??{}
  const input:SecondaryPhysicsInput={
    characterAssetId:action.inputAssetIds[0]??'',
    rigAssetId:action.inputAssetIds[1]??'',
    animationAssetId:action.inputAssetIds[2]??'',
    layers:readLayers(p.layers),
    frameStart:typeof p.frameStart==='number'?p.frameStart:0,
    frameEnd:typeof p.frameEnd==='number'?p.frameEnd:-1,
    continuityRef:typeof p.continuityRef==='string'?p.continuityRef:undefined,
  }
  const errors=validateSecondaryPhysicsInput(input)
  if(errors.length) throw new Error(`Invalid secondary physics: ${errors.join('; ')}`)
  return input
}
export function createSecondaryPhysicsProvider(adapter:SecondaryPhysicsAdapter):DirectorStudioCapabilityProvider{
  return {
    supports:capability=>capability==='physics',
    async execute(action:DirectorStudioAction,_request:ActionRequest<DirectorStudioAction>){
      if(action.capability!=='physics') throw new Error('Physics provider received wrong capability')
      const input=readInput(action)
      const artifact=await adapter.simulate(input)
      if(artifact.frameStart!==input.frameStart||artifact.frameEnd!==input.frameEnd) throw new Error('Physics output frame range does not match governed input')
      return {
        capability:'physics',
        projectId:action.projectId,
        outputAssetIds:[artifact.simulatedAnimationAssetId,artifact.artifactId],
        evidenceIds:[
          ...artifact.evidenceIds,
          `physics-provider:${artifact.provider}`,
          ...input.layers.map(layer=>`physics-layer:${layer.id}:${layer.material}:${layer.attachment}`),
          ...(input.continuityRef?[`continuity:${input.continuityRef}`]:[]),
        ],
      }
    },
  }
}
