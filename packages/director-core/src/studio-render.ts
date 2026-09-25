import type { ActionRequest } from '@jhadina/action-core'
import type { DirectorStudioAction,DirectorStudioCapabilityProvider } from './studio-governed-action'
import {
  cartoonProductionEvidence,
  validateMasterSceneScalePlan,
  validatePreRenderCachePlan,
  validateSpriteSequencePlan,
  type MasterSceneScalePlan,
  type PreRenderCachePlan,
  type SpriteSequencePlan,
} from './cartoon-production-workflow.js'

export interface StudioRenderInput {
  sourceAssetId:string
  compositeAssetId:string
  voiceSyncArtifactId:string
  animationAssetId:string
  physicsAssetId:string
  frameStart:number
  frameEnd:number
  cachePlan?:PreRenderCachePlan
  spriteSequences?:readonly SpriteSequencePlan[]
  scalePlan?:MasterSceneScalePlan
  continuityRef?:string
}

export interface StudioRenderArtifact {
  artifactId:string
  mediaAssetId:string
  provider:string
  evidenceIds:string[]
  frameStart:number
  frameEnd:number
}

export interface StudioRenderAdapter {
  readonly name:string
  render(input:StudioRenderInput):Promise<StudioRenderArtifact>
}

export function validateStudioRenderInput(input:StudioRenderInput):string[]{
  const errors:string[]=[]
  for(const [key,value] of Object.entries({
    sourceAssetId:input.sourceAssetId,
    compositeAssetId:input.compositeAssetId,
    voiceSyncArtifactId:input.voiceSyncArtifactId,
    animationAssetId:input.animationAssetId,
    physicsAssetId:input.physicsAssetId,
  })) if(!value) errors.push(`${key} is required`)
  if(input.frameStart<0||input.frameEnd<input.frameStart) errors.push('frame range is invalid')
  if(input.cachePlan){
    const reasons=validatePreRenderCachePlan(input.cachePlan)
    if(reasons.length) errors.push(...reasons.map(reason=>`pre-render cache invalid: ${reason}`))
    if(input.cachePlan.frameStart!==input.frameStart||input.cachePlan.frameEnd!==input.frameEnd) {
      errors.push('pre-render cache frame range must match render frame range')
    }
  }
  for(const sequence of input.spriteSequences??[]){
    const reasons=validateSpriteSequencePlan(sequence)
    if(reasons.length) errors.push(...reasons.map(reason=>`sprite sequence invalid: ${reason}`))
  }
  if(input.scalePlan){
    const reasons=validateMasterSceneScalePlan(input.scalePlan)
    if(reasons.length) errors.push(...reasons.map(reason=>`master scene scale invalid: ${reason}`))
  }
  return errors
}

function readInput(action:DirectorStudioAction):StudioRenderInput{
  const p=action.parameters??{}
  const input:StudioRenderInput={
    sourceAssetId:action.inputAssetIds[0]??'',
    compositeAssetId:action.inputAssetIds[1]??'',
    voiceSyncArtifactId:action.inputAssetIds[2]??'',
    animationAssetId:action.inputAssetIds[3]??'',
    physicsAssetId:action.inputAssetIds[4]??'',
    frameStart:typeof p.frameStart==='number'?p.frameStart:0,
    frameEnd:typeof p.frameEnd==='number'?p.frameEnd:-1,
    cachePlan:typeof p.cachePlan==='object'&&p.cachePlan!==null?p.cachePlan as PreRenderCachePlan:undefined,
    spriteSequences:Array.isArray(p.spriteSequences)?p.spriteSequences as SpriteSequencePlan[]:undefined,
    scalePlan:typeof p.scalePlan==='object'&&p.scalePlan!==null?p.scalePlan as MasterSceneScalePlan:undefined,
    continuityRef:typeof p.continuityRef==='string'?p.continuityRef:undefined,
  }
  const errors=validateStudioRenderInput(input)
  if(input.cachePlan?.projectId!==undefined&&input.cachePlan.projectId!==action.projectId) {
    errors.push('pre-render cache projectId must match render projectId')
  }
  if(input.scalePlan?.projectId!==undefined&&input.scalePlan.projectId!==action.projectId) {
    errors.push('master scene scale projectId must match render projectId')
  }
  if(input.spriteSequences?.some(sequence=>sequence.projectId!==action.projectId)) {
    errors.push('sprite sequence projectId must match render projectId')
  }
  if(errors.length) throw new Error(`Invalid render input: ${errors.join('; ')}`)
  return input
}

export function createStudioRenderProvider(adapter:StudioRenderAdapter):DirectorStudioCapabilityProvider{
  return {
    supports:c=>c==='render',
    async execute(action:DirectorStudioAction,_request:ActionRequest<DirectorStudioAction>){
      if(action.capability!=='render') throw new Error('Render provider received wrong capability')
      const input=readInput(action)
      const artifact=await adapter.render(input)
      if(artifact.frameStart!==input.frameStart||artifact.frameEnd!==input.frameEnd) {
        throw new Error('Render changed governed frame range')
      }
      return {
        capability:'render',
        projectId:action.projectId,
        outputAssetIds:[artifact.mediaAssetId,artifact.artifactId],
        evidenceIds:[
          ...artifact.evidenceIds,
          `render-provider:${artifact.provider}`,
          ...cartoonProductionEvidence({
            spriteSequences:input.spriteSequences,
            cachePlan:input.cachePlan,
            scalePlan:input.scalePlan,
          }),
          ...(input.continuityRef?[`continuity:${input.continuityRef}`]:[]),
        ],
      }
    },
  }
}
