import type {SupabaseClient} from '@supabase/supabase-js'
import type {DirectorVideoJob} from '@jhadina/director-core'
import {createAndSubmitAskVideoJob} from '@/lib/director-video-job-service'
import type {SideHustleDirectorProductionPlan} from './side-hustle-director-bridge'

export type SideHustleDirectorCommissionResult=Readonly<{
  projectId:string
  productionRunId:string
  videoJobId?:string
  status:'running'|'shot_orchestration_ready'|'review'|'blocked'|'failed'
  executionMode:'whole-video'|'shot-orchestration'
  nextBoundary:string
  publicationAuthority:'NONE'
  paidMediaAuthority:'NONE'
}>

const WHOLE_VIDEO_FORMATS=new Set<SideHustleDirectorProductionPlan['format']>([
  'tiktok_short','ugc_ad',
])

function videoStatus(job:DirectorVideoJob):SideHustleDirectorCommissionResult['status']{
  if(job.status==='preview_ready')return'review'
  if(job.status==='blocked')return'blocked'
  if(job.status==='failed'||job.status==='cancelled')return'failed'
  return'running'
}

async function persistCommission(
  client:SupabaseClient,
  input:{
    projectId:string
    productionRunId:string
    videoJobId?:string
    status:string
    error?:string
  },
):Promise<void>{
  const {error}=await client.from('director_project_business_context').update({
    production_run_id:input.productionRunId,
    video_job_id:input.videoJobId??null,
    automation_status:input.status,
    automation_error:input.error??null,
    commissioned_at:new Date().toISOString(),
    updated_at:new Date().toISOString(),
  }).eq('project_id',input.projectId)
  if(error)throw new Error('SIDE_HUSTLE_DIRECTOR_COMMISSION_WRITE_FAILED:'+error.message)
}

async function ensureProductionProject(
  client:SupabaseClient,
  userId:string,
  plan:SideHustleDirectorProductionPlan,
):Promise<void>{
  const {data:existing,error:readError}=await client.from('director_production_projects')
    .select('id,owner_user_id').eq('id',plan.directorProjectId).maybeSingle()
  if(readError)throw new Error('SIDE_HUSTLE_DIRECTOR_PROJECT_READ_FAILED:'+readError.message)
  if(existing){
    if(String(existing.owner_user_id)!==userId)throw new Error('SIDE_HUSTLE_DIRECTOR_PROJECT_OWNER_MISMATCH')
    return
  }
  const now=new Date().toISOString()
  const {error}=await client.from('director_production_projects').insert({
    id:plan.directorProjectId,
    owner_user_id:userId,
    version:1,
    title:plan.activeTask.slice(0,240),
    status:'preproduction',
    snapshot:{
      sourceSystem:'business-factory',
      opportunityId:plan.opportunityId,
      planId:plan.id,
      format:plan.format,
      archetype:plan.archetype,
      aspectRatio:plan.aspectRatio,
      targetRuntimeSeconds:plan.targetRuntimeSeconds,
      takeSet:plan.takeSet,
      approvedCreativePreferences:plan.approvedCreativePreferences,
      assemblyPolicy:{
        editableDelivery:true,
        narration:plan.format==='faceless_youtube',
        bRoll:plan.format==='faceless_youtube'||plan.format==='music_video'||plan.format==='short_film'||plan.format==='feature_film',
        quickCut:plan.format==='faceless_youtube',
        captions:plan.format!=='feature_film',
        foley:plan.format!=='faceless_youtube',
        music:true,
        multipleTakes:true,
      },
      publicationAuthority:'NONE',
      paidMediaAuthority:'NONE',
    },
    evidence_ids:[...plan.evidenceRefs],
    created_at:now,
    updated_at:now,
  })
  if(error)throw new Error('SIDE_HUSTLE_DIRECTOR_PROJECT_WRITE_FAILED:'+error.message)
}

async function createShotOrchestrationRun(
  client:SupabaseClient,
  plan:SideHustleDirectorProductionPlan,
):Promise<string>{
  const runId=`run:business:${plan.id}`
  const {data:existing,error:readError}=await client.from('director_production_runs')
    .select('id,status').eq('id',runId).eq('project_id',plan.directorProjectId).maybeSingle()
  if(readError)throw new Error('SIDE_HUSTLE_DIRECTOR_RUN_READ_FAILED:'+readError.message)
  if(existing)return String(existing.id)

  const now=new Date().toISOString()
  const {error:runError}=await client.from('director_production_runs').insert({
    id:runId,
    project_id:plan.directorProjectId,
    status:'planning',
    shot_ids:[],
    gate_ids:[],
    version:1,
    created_at:now,
    updated_at:now,
  })
  if(runError)throw new Error('SIDE_HUSTLE_DIRECTOR_RUN_WRITE_FAILED:'+runError.message)

  const ids=(kind:string)=>`stage:business:${plan.id}:${kind}`
  const ordered=[
    ['vision',[]],
    ['treatment',['vision']],
    ['storyboard',['treatment']],
    ['shotlist',['storyboard']],
    ['previs',['shotlist']],
    ['rehearsal',['previs']],
    ['generation',['rehearsal']],
    ['edit',['generation']],
    ['review',['edit']],
    ['final',['review']],
  ] as const
  const {error:stageError}=await client.from('director_creative_stages').insert(
    ordered.map(([kind,deps],index)=>({
      id:ids(kind),
      project_id:plan.directorProjectId,
      kind,
      depends_on:deps.map(ids),
      status:index===0?'ready':'planned',
      input_artifact_ids:[],
      output_artifact_ids:[],
      version:1,
      updated_at:now,
    })),
  )
  if(stageError)throw new Error('SIDE_HUSTLE_DIRECTOR_STAGE_WRITE_FAILED:'+stageError.message)
  return runId
}

export async function commissionSideHustleDirectorProduction(input:{
  client:SupabaseClient
  userId:string
  plan:SideHustleDirectorProductionPlan
}):Promise<SideHustleDirectorCommissionResult>{
  const {client,userId,plan}=input
  await ensureProductionProject(client,userId,plan)

  if(WHOLE_VIDEO_FORMATS.has(plan.format)){
    const result=await createAndSubmitAskVideoJob({
      userId,
      source:'business-factory',
      activeTask:plan.activeTask,
      activeProject:plan.directorProjectId,
      clientRequestId:`business-factory:${plan.opportunityId}:${plan.id}`,
      productionQuality:false,
    },{client})
    const status=videoStatus(result.job)
    await persistCommission(client,{
      projectId:plan.directorProjectId,
      productionRunId:result.job.productionRunId,
      videoJobId:result.job.id,
      status,
      error:result.job.error,
    })
    return Object.freeze({
      projectId:plan.directorProjectId,
      productionRunId:result.job.productionRunId,
      videoJobId:result.job.id,
      status,
      executionMode:'whole-video',
      nextBoundary:status==='review'?'DIRECTOR_REVIEW':status==='blocked'?'PROVIDER_CONFIGURATION_OR_RECONCILIATION':'DIRECTOR_VIDEO_JOB_RECONCILER',
      publicationAuthority:'NONE',
      paidMediaAuthority:'NONE',
    })
  }

  const runId=await createShotOrchestrationRun(client,plan)
  await persistCommission(client,{
    projectId:plan.directorProjectId,
    productionRunId:runId,
    status:'shot_orchestration_ready',
  })
  return Object.freeze({
    projectId:plan.directorProjectId,
    productionRunId:runId,
    status:'shot_orchestration_ready',
    executionMode:'shot-orchestration',
    nextBoundary:'DIRECTOR_SHOT_ORCHESTRATOR',
    publicationAuthority:'NONE',
    paidMediaAuthority:'NONE',
  })
}
