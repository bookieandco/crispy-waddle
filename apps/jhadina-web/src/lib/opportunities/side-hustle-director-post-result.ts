import type {SupabaseClient} from '@supabase/supabase-js'
import {
  evolveWorkSessionTask,
  reconcileWorkSessionTaskReadiness,
  type WorkSessionTask,
} from '@jhadina/core-spine'
import type {
  DirectorHierarchicalCoherenceDecision,
  FinalExportInspection,
} from '@jhadina/director-core'
import {SupabaseWorkSessionTaskRepository} from '@/lib/work-session/supabase-work-session-task-repository'
import type {SideHustleDirectorProductionPlan} from './side-hustle-director-bridge'

export type DirectorPostCapability=
  |'director.audio.voice'
  |'director.audio.music'
  |'director.audio.foley'
  |'director.video.lip-sync'
  |'director.audio.mix'
  |'director.render.final'
  |'director.qc.final-watch'

export type DirectorPostTaskResultInput=Readonly<{
  projectId:string
  ownerUserId:string
  workSessionId:string
  taskId:string
  status:'succeeded'|'failed'
  outputRefs:readonly string[]
  completedAt:string
  errorCode?:string
  evidence?:Readonly<{
    finalMasterAssetId?:string
    timelineVersionId?:string
    finalInspection?:FinalExportInspection
    coherence?:DirectorHierarchicalCoherenceDecision
    audioStemRoles?:readonly string[]
    audioEvidenceIds?:readonly string[]
    narrationEvidenceIds?:readonly string[]
    lipSyncEvidenceIds?:readonly string[]
    nleExportEvidenceIds?:readonly string[]
    evidenceIds?:readonly string[]
  }>
}>

export type DirectorPostTaskResultReceipt=Readonly<{
  projectId:string
  workSessionId:string
  taskId:string
  capability:DirectorPostCapability
  taskStatus:'completed'|'failed'
  outputRefs:readonly string[]
  finalQcEvidenceUpdated:boolean
  audioPostCompleted:boolean
  authority:'DIRECTOR_POST_RESULT_RECONCILIATION'
  canApprove:false
  canPublish:false
}>

const CAPABILITIES=new Set<DirectorPostCapability>([
  'director.audio.voice',
  'director.audio.music',
  'director.audio.foley',
  'director.video.lip-sync',
  'director.audio.mix',
  'director.render.final',
  'director.qc.final-watch',
])
const STEM_ROLES=new Set(['dialogue','voiceover','music','sfx','foley','ambience'])

function unique(values:readonly string[]|undefined):string[]{
  return [...new Set((values??[]).map(value=>String(value).trim()).filter(Boolean))]
}
function required(value:string,name:string):string{
  const clean=value.trim()
  if(!clean)throw new Error('DIRECTOR_POST_RESULT_'+name+'_REQUIRED')
  return clean
}
function iso(value:string):string{
  const clean=required(value,'COMPLETED_AT')
  const ms=Date.parse(clean)
  if(!Number.isFinite(ms))throw new Error('DIRECTOR_POST_RESULT_COMPLETED_AT_INVALID')
  if(ms>Date.now()+5*60_000)throw new Error('DIRECTOR_POST_RESULT_COMPLETED_AT_FUTURE')
  return new Date(ms).toISOString()
}
function assertCapabilityEvidence(capability:DirectorPostCapability,input:DirectorPostTaskResultInput):void{
  const evidence=input.evidence??{}
  const stemRoles=unique(evidence.audioStemRoles)
  if(stemRoles.some(role=>!STEM_ROLES.has(role))){
    throw new Error('DIRECTOR_POST_RESULT_STEM_ROLE_INVALID')
  }

  switch(capability){
    case 'director.audio.voice':
      if(input.status==='succeeded'&&!unique(evidence.audioEvidenceIds).length){
        throw new Error('DIRECTOR_POST_RESULT_VOICE_EVIDENCE_REQUIRED')
      }
      if(stemRoles.some(role=>role!=='dialogue'&&role!=='voiceover')){
        throw new Error('DIRECTOR_POST_RESULT_VOICE_STEM_ROLE_INVALID')
      }
      break
    case 'director.audio.music':
      if(input.status==='succeeded'&&!unique(evidence.audioEvidenceIds).length){
        throw new Error('DIRECTOR_POST_RESULT_MUSIC_EVIDENCE_REQUIRED')
      }
      if(stemRoles.some(role=>role!=='music')){
        throw new Error('DIRECTOR_POST_RESULT_MUSIC_STEM_ROLE_INVALID')
      }
      break
    case 'director.audio.foley':
      if(input.status==='succeeded'&&!unique(evidence.audioEvidenceIds).length){
        throw new Error('DIRECTOR_POST_RESULT_FOLEY_EVIDENCE_REQUIRED')
      }
      if(stemRoles.some(role=>!['foley','sfx','ambience'].includes(role))){
        throw new Error('DIRECTOR_POST_RESULT_FOLEY_STEM_ROLE_INVALID')
      }
      break
    case 'director.video.lip-sync':
      if(input.status==='succeeded'&&!unique(evidence.lipSyncEvidenceIds).length){
        throw new Error('DIRECTOR_POST_RESULT_LIP_SYNC_EVIDENCE_REQUIRED')
      }
      break
    case 'director.audio.mix':
      if(input.status==='succeeded'&&!unique(evidence.audioEvidenceIds).length){
        throw new Error('DIRECTOR_POST_RESULT_MIX_EVIDENCE_REQUIRED')
      }
      break
    case 'director.render.final':
      if(input.status==='succeeded'&&!String(evidence.finalMasterAssetId??'').trim()){
        throw new Error('DIRECTOR_POST_RESULT_FINAL_MASTER_REQUIRED')
      }
      if(input.status==='succeeded'&&!String(evidence.timelineVersionId??'').trim()){
        throw new Error('DIRECTOR_POST_RESULT_TIMELINE_VERSION_REQUIRED')
      }
      break
    case 'director.qc.final-watch':
      if(input.status==='succeeded'&&!evidence.finalInspection){
        throw new Error('DIRECTOR_POST_RESULT_FINAL_INSPECTION_REQUIRED')
      }
      if(input.status==='succeeded'&&!evidence.coherence){
        throw new Error('DIRECTOR_POST_RESULT_COHERENCE_REQUIRED')
      }
      if(evidence.finalInspection&&evidence.finalInspection.projectId!==input.projectId){
        throw new Error('DIRECTOR_POST_RESULT_INSPECTION_PROJECT_MISMATCH')
      }
      if(evidence.coherence&&evidence.coherence.authority!=='DIRECTOR_HIERARCHICAL_COHERENCE_QC'){
        throw new Error('DIRECTOR_POST_RESULT_COHERENCE_AUTHORITY_INVALID')
      }
      break
  }
}

function taskCanFinish(task:WorkSessionTask,status:'succeeded'|'failed'):void{
  if(task.status==='completed'&&status==='succeeded')return
  if(task.status==='failed'&&status==='failed')return
  if(!['running','waiting-approval','retrying','ready'].includes(task.status)){
    throw new Error('DIRECTOR_POST_RESULT_TASK_STATE_INVALID:'+task.status)
  }
}

async function mergeFinalQcEvidence(
  client:SupabaseClient,
  input:DirectorPostTaskResultInput,
  capability:DirectorPostCapability,
):Promise<boolean>{
  if(input.status!=='succeeded')return false
  const evidence=input.evidence??{}
  const carriesEvidence=
    Boolean(evidence.finalMasterAssetId)||
    Boolean(evidence.timelineVersionId)||
    Boolean(evidence.finalInspection)||
    Boolean(evidence.coherence)||
    unique(evidence.audioStemRoles).length>0||
    unique(evidence.audioEvidenceIds).length>0||
    unique(evidence.narrationEvidenceIds).length>0||
    unique(evidence.lipSyncEvidenceIds).length>0||
    unique(evidence.nleExportEvidenceIds).length>0||
    unique(evidence.evidenceIds).length>0
  if(!carriesEvidence)return false

  const {data:current,error:readError}=await client.from('director_project_final_qc_evidence')
    .select('final_master_asset_id,timeline_version_id,final_inspection,coherence,audio_stem_roles,audio_evidence_ids,narration_evidence_ids,lip_sync_evidence_ids,nle_export_evidence_ids,evidence_ids,source')
    .eq('project_id',input.projectId).eq('owner_user_id',input.ownerUserId).maybeSingle()
  if(readError)throw new Error('DIRECTOR_POST_RESULT_FINAL_QC_READ_FAILED:'+readError.message)

  if(evidence.finalMasterAssetId){
    const assetId=String(evidence.finalMasterAssetId).trim()
    const {data:asset,error:assetError}=await client.from('director_generated_editing_assets')
      .select('id,project_id,media_type')
      .eq('id',assetId).eq('project_id',input.projectId).maybeSingle()
    if(assetError)throw new Error('DIRECTOR_POST_RESULT_MASTER_ASSET_READ_FAILED:'+assetError.message)
    if(!asset||asset.media_type!=='video')throw new Error('DIRECTOR_POST_RESULT_MASTER_ASSET_INVALID')
  }

  const currentRow=current as Record<string,unknown>|null
  const finalInspection=evidence.finalInspection??currentRow?.final_inspection??null
  const coherence=evidence.coherence??currentRow?.coherence??null
  const finalMasterAssetId=String(evidence.finalMasterAssetId??currentRow?.final_master_asset_id??'').trim()||null
  if(finalInspection&&finalMasterAssetId){
    const inspection=finalInspection as FinalExportInspection
    if(!inspection.variants.some(variant=>variant.assetId===finalMasterAssetId)){
      throw new Error('DIRECTOR_POST_RESULT_MASTER_NOT_IN_FINAL_INSPECTION')
    }
  }

  const now=new Date().toISOString()
  const merged={
    project_id:input.projectId,
    owner_user_id:input.ownerUserId,
    final_master_asset_id:finalMasterAssetId,
    timeline_version_id:String(evidence.timelineVersionId??currentRow?.timeline_version_id??'').trim()||null,
    final_inspection:finalInspection,
    coherence,
    audio_stem_roles:unique([
      ...(Array.isArray(currentRow?.audio_stem_roles)?currentRow!.audio_stem_roles as string[]:[]),
      ...unique(evidence.audioStemRoles),
    ]),
    audio_evidence_ids:unique([
      ...(Array.isArray(currentRow?.audio_evidence_ids)?currentRow!.audio_evidence_ids as string[]:[]),
      ...unique(evidence.audioEvidenceIds),
    ]),
    narration_evidence_ids:unique([
      ...(Array.isArray(currentRow?.narration_evidence_ids)?currentRow!.narration_evidence_ids as string[]:[]),
      ...unique(evidence.narrationEvidenceIds),
    ]),
    lip_sync_evidence_ids:unique([
      ...(Array.isArray(currentRow?.lip_sync_evidence_ids)?currentRow!.lip_sync_evidence_ids as string[]:[]),
      ...unique(evidence.lipSyncEvidenceIds),
    ]),
    nle_export_evidence_ids:unique([
      ...(Array.isArray(currentRow?.nle_export_evidence_ids)?currentRow!.nle_export_evidence_ids as string[]:[]),
      ...unique(evidence.nleExportEvidenceIds),
    ]),
    evidence_ids:unique([
      ...(Array.isArray(currentRow?.evidence_ids)?currentRow!.evidence_ids as string[]:[]),
      ...unique(evidence.evidenceIds),
      ...unique(input.outputRefs),
      'post-task:'+input.taskId,
      'post-capability:'+capability,
    ]),
    source:'one-runtime-post-results',
    updated_at:now,
  }
  const {error}=await client.from('director_project_final_qc_evidence').upsert(merged,{onConflict:'project_id'})
  if(error)throw new Error('DIRECTOR_POST_RESULT_FINAL_QC_WRITE_FAILED:'+error.message)
  return true
}

export async function reconcileSideHustleDirectorPostTaskResult(
  client:SupabaseClient,
  input:DirectorPostTaskResultInput,
):Promise<DirectorPostTaskResultReceipt>{
  const projectId=required(input.projectId,'PROJECT')
  const ownerUserId=required(input.ownerUserId,'OWNER')
  const workSessionId=required(input.workSessionId,'WORK_SESSION')
  const taskId=required(input.taskId,'TASK')
  const completedAt=iso(input.completedAt)
  const outputRefs=unique(input.outputRefs)
  if(input.status==='succeeded'&&!outputRefs.length){
    throw new Error('DIRECTOR_POST_RESULT_OUTPUT_REFS_REQUIRED')
  }
  if(input.status==='failed'&&!String(input.errorCode??'').trim()){
    throw new Error('DIRECTOR_POST_RESULT_ERROR_CODE_REQUIRED')
  }

  const {data:context,error:contextError}=await client.from('director_project_business_context')
    .select('owner_user_id,plan')
    .eq('project_id',projectId).eq('owner_user_id',ownerUserId).maybeSingle()
  if(contextError)throw new Error('DIRECTOR_POST_RESULT_CONTEXT_READ_FAILED:'+contextError.message)
  if(!context)throw new Error('DIRECTOR_POST_RESULT_CONTEXT_NOT_FOUND')
  const plan=context.plan as SideHustleDirectorProductionPlan
  if(!plan||plan.directorProjectId!==projectId)throw new Error('DIRECTOR_POST_RESULT_CONTEXT_INVALID')
  if(!workSessionId.startsWith('work:director-post:'+projectId+':'+plan.id+':r')){
    throw new Error('DIRECTOR_POST_RESULT_WORK_SESSION_MISMATCH')
  }

  const taskRepo=new SupabaseWorkSessionTaskRepository(client,ownerUserId)
  const task=await taskRepo.get(workSessionId,taskId)
  if(!task)throw new Error('DIRECTOR_POST_RESULT_TASK_NOT_FOUND')
  if(task.domain!=='director')throw new Error('DIRECTOR_POST_RESULT_TASK_DOMAIN_INVALID')
  if(!CAPABILITIES.has(task.capability as DirectorPostCapability)){
    throw new Error('DIRECTOR_POST_RESULT_CAPABILITY_INVALID:'+task.capability)
  }
  const capability=task.capability as DirectorPostCapability
  taskCanFinish(task,input.status)
  assertCapabilityEvidence(capability,input)

  const {data:existingReceipt,error:receiptReadError}=await client.from('director_post_task_receipts')
    .select('id,project_id,capability,status,output_refs,evidence,error_code,completed_at')
    .eq('owner_user_id',ownerUserId)
    .eq('work_session_id',workSessionId)
    .eq('task_id',taskId)
    .maybeSingle()
  if(receiptReadError)throw new Error('DIRECTOR_POST_RESULT_RECEIPT_READ_FAILED:'+receiptReadError.message)
  if(existingReceipt){
    if(
      existingReceipt.project_id!==projectId||
      existingReceipt.capability!==capability||
      existingReceipt.status!==input.status
    )throw new Error('DIRECTOR_POST_RESULT_IDEMPOTENCY_CONFLICT')
    return Object.freeze({
      projectId,workSessionId,taskId,capability,
      taskStatus:input.status==='succeeded'?'completed':'failed',
      outputRefs:Object.freeze(unique(existingReceipt.output_refs??[])),
      finalQcEvidenceUpdated:false,
      audioPostCompleted:false,
      authority:'DIRECTOR_POST_RESULT_RECONCILIATION',
      canApprove:false,canPublish:false,
    })
  }

  const {error:receiptWriteError}=await client.from('director_post_task_receipts').insert({
    project_id:projectId,
    owner_user_id:ownerUserId,
    work_session_id:workSessionId,
    task_id:taskId,
    capability,
    status:input.status,
    output_refs:outputRefs,
    evidence:input.evidence??{},
    error_code:input.status==='failed'?String(input.errorCode):null,
    completed_at:completedAt,
  })
  if(receiptWriteError)throw new Error('DIRECTOR_POST_RESULT_RECEIPT_WRITE_FAILED:'+receiptWriteError.message)

  if(task.status!==(input.status==='succeeded'?'completed':'failed')){
    const next=evolveWorkSessionTask(task,{
      status:input.status==='succeeded'?'completed':'failed',
      outputRefs,
      blockedReason:undefined,
      updatedAt:completedAt,
    })
    await taskRepo.update(next,task.version)
  }

  const finalQcEvidenceUpdated=await mergeFinalQcEvidence(client,input,capability)
  await reconcileWorkSessionTaskReadiness(taskRepo,workSessionId,completedAt)
  const tasks=await taskRepo.list(workSessionId)
  const allCompleted=tasks.length>0&&tasks.every(item=>item.status==='completed')
  if(allCompleted){
    const {error:audioError}=await client.from('director_audio_post_plans').update({
      status:'completed',
      blockers:[],
      updated_at:completedAt,
    }).eq('project_id',projectId).eq('owner_user_id',ownerUserId)
    if(audioError)throw new Error('DIRECTOR_POST_RESULT_AUDIO_PLAN_COMPLETE_FAILED:'+audioError.message)
  }else if(input.status==='failed'){
    const {error:audioError}=await client.from('director_audio_post_plans').update({
      status:'awaiting_workers',
      updated_at:completedAt,
    }).eq('project_id',projectId).eq('owner_user_id',ownerUserId)
    if(audioError)throw new Error('DIRECTOR_POST_RESULT_AUDIO_PLAN_FAILURE_WRITE_FAILED:'+audioError.message)
  }else{
    const {error:audioError}=await client.from('director_audio_post_plans').update({
      status:'executing',
      updated_at:completedAt,
    }).eq('project_id',projectId).eq('owner_user_id',ownerUserId)
    if(audioError)throw new Error('DIRECTOR_POST_RESULT_AUDIO_PLAN_EXECUTING_FAILED:'+audioError.message)
  }

  return Object.freeze({
    projectId,workSessionId,taskId,capability,
    taskStatus:input.status==='succeeded'?'completed':'failed',
    outputRefs:Object.freeze(outputRefs),
    finalQcEvidenceUpdated,
    audioPostCompleted:allCompleted,
    authority:'DIRECTOR_POST_RESULT_RECONCILIATION',
    canApprove:false,
    canPublish:false,
  })
}
