import type { ActionRequest } from '@jhadina/action-core'
import type { DirectorStudioAction, DirectorStudioCapabilityProvider } from './studio-governed-action'

export type StudioQCCheck='tracking'|'composite'|'continuity'|'voice-sync'|'animation'|'physics'
export interface StudioQCMetric { check:StudioQCCheck; score:number; evidenceIds:string[]; notes?:string[] }
export interface StudioQCInput {
  assetId:string
  requiredChecks:StudioQCCheck[]
  evidenceIds:string[]
  minimumScore:number
}
export interface StudioQCArtifact {
  reportId:string
  provider:string
  metrics:StudioQCMetric[]
  evidenceIds:string[]
}
export interface StudioQCAdapter { readonly name:string; inspect(input:StudioQCInput):Promise<StudioQCArtifact> }
export interface StudioQCDecision {
  passed:boolean
  reportId:string
  failedChecks:StudioQCCheck[]
  minimumObservedScore:number
}
export function validateStudioQCInput(input:StudioQCInput):string[]{
  const errors:string[]=[]
  if(!input.assetId) errors.push('assetId is required')
  if(!input.requiredChecks.length) errors.push('at least one QC check is required')
  if(!input.evidenceIds.length) errors.push('upstream evidence is required')
  if(input.minimumScore<0||input.minimumScore>1) errors.push('minimumScore must be between 0 and 1')
  return errors
}
export function decideStudioQC(input:StudioQCInput,artifact:StudioQCArtifact):StudioQCDecision{
  const byCheck=new Map(artifact.metrics.map(m=>[m.check,m]))
  const failedChecks=input.requiredChecks.filter(check=>{
    const metric=byCheck.get(check)
    return !metric||metric.score<input.minimumScore
  })
  const scores=input.requiredChecks.map(c=>byCheck.get(c)?.score??0)
  return {passed:failedChecks.length===0,reportId:artifact.reportId,failedChecks,minimumObservedScore:Math.min(...scores)}
}
function readChecks(v:unknown):StudioQCCheck[]{const allowed=['tracking','composite','continuity','voice-sync','animation','physics'];return Array.isArray(v)?v.filter(x=>allowed.includes(String(x))) as StudioQCCheck[]:[]}
function readStrings(v:unknown):string[]{return Array.isArray(v)?v.filter(x=>typeof x==='string') as string[]:[]}
function readInput(action:DirectorStudioAction):StudioQCInput{
  const p=action.parameters??{}
  const input={assetId:action.inputAssetIds[0]??'',requiredChecks:readChecks(p.requiredChecks),evidenceIds:readStrings(p.evidenceIds),minimumScore:typeof p.minimumScore==='number'?p.minimumScore:.8}
  const errors=validateStudioQCInput(input);if(errors.length) throw new Error(`Invalid Studio QC: ${errors.join('; ')}`);return input
}
/** Final machine QC gate before a generated Studio asset can be presented for human approval. */
export function createStudioQCProvider(adapter:StudioQCAdapter):DirectorStudioCapabilityProvider{
 return {
  supports:capability=>capability==='qc',
  async execute(action:DirectorStudioAction,_request:ActionRequest<DirectorStudioAction>){
   if(action.capability!=='qc') throw new Error('QC provider received wrong capability')
   const input=readInput(action),artifact=await adapter.inspect(input),decision=decideStudioQC(input,artifact)
   if(!decision.passed) throw new Error(`Studio QC failed: ${decision.failedChecks.join(', ')}`)
   return {capability:'qc',projectId:action.projectId,outputAssetIds:[input.assetId],evidenceIds:[...input.evidenceIds,...artifact.evidenceIds,...artifact.metrics.flatMap(m=>m.evidenceIds),`qc-report:${artifact.reportId}`,`qc-provider:${artifact.provider}`,`qc-min-score:${decision.minimumObservedScore}`]}
  }
 }
}
