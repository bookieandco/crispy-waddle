import type {SupabaseClient} from '@supabase/supabase-js'
import {reconcileDirectorVideoJobs} from '@/lib/director-video-job-reconciler'
import {advanceSideHustleDirectorShotOrchestration,advanceSideHustleDirectorAfterStoryboardApproval,advanceSideHustleDirectorAfterRehearsal} from './side-hustle-director-shot-orchestrator'
import {submitSideHustleDirectorTakeBatch} from './side-hustle-director-take-runtime'
import {reconcileSideHustleDirectorTakeSets} from './side-hustle-director-take-reconciler'
import {materializeSideHustleDirectorEditAssembly,proposeSideHustleDirectorEditAssembly} from './side-hustle-director-edit-assembler'
import {compileSideHustleDirectorAudioPostPlan} from './side-hustle-director-audio-post'
import type {SideHustleDirectorProductionPlan} from './side-hustle-director-bridge'

type ContextRow={
  project_id:string
  owner_user_id:string
  production_run_id:string|null
  video_job_id:string|null
  automation_status:string
  automation_error:string|null
  plan:SideHustleDirectorProductionPlan
  updated_at:string
}
type ReceiptStatus='advanced'|'waiting'|'blocked'|'failed'|'noop'
type ProjectReceipt=Readonly<{
  projectId:string
  action:string
  status:ReceiptStatus
  boundary:string
  details:Readonly<Record<string,unknown>>
  error?:string
}>

export type SideHustleDirectorAutopilotWorkerReceipt=Readonly<{
  ranAt:string
  scanned:number
  advanced:number
  waiting:number
  blocked:number
  failed:number
  projects:readonly ProjectReceipt[]
  authority:'DIRECTOR_ORCHESTRATION_ONLY'
  canApproveCreative:false
  canPublish:false
  canSpendPaidMedia:false
}>

const expectedWaiting=[
  'SCREENPLAY_BLUEPRINT_REQUIRED',
  'FACELESS_SCRIPT_BLUEPRINT_REQUIRED',
  'MUSIC_VIDEO_TREATMENT_OR_SCRIPT_REQUIRED',
  'STORYBOARD_APPROVAL_REQUIRED',
  'GENERATION_APPROVAL_REQUIRED',
  'PREVIS_APPROVAL_REQUIRED',
  'PREVIS_EVIDENCE_REQUIRED',
  'REHEARSAL_APPROVAL_REQUIRED',
  'REHEARSAL_EVIDENCE_REQUIRED',
  'SELECTED_ASSET_APPROVAL_REQUIRED',
  'AUDIO_WORKER_COMMISSIONING',
  'WORKER_REQUIRED',
  'RUNTIME_REQUIRED',
  'NOT_CONFIGURED',
  'ARTIFACT_DEPLOYMENT',
] as const

function expectedWait(message:string):boolean{
  return expectedWaiting.some(code=>message.includes(code))
}
function stageId(projectId:string,planId:string,kind:string){
  return 'stage:business:'+projectId+':'+planId+':'+kind
}
function gateId(projectId:string,planId:string,kind:string){
  return 'gate:business:'+projectId+':'+planId+':'+kind
}
function details(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{value}
}

async function appendReceipt(
  client:SupabaseClient,
  row:ContextRow,
  receipt:ProjectReceipt,
):Promise<void>{
  const {error}=await client.from('director_business_autopilot_receipts').insert({
    project_id:row.project_id,
    owner_user_id:row.owner_user_id,
    production_run_id:row.production_run_id,
    plan_id:row.plan.id,
    action:receipt.action,
    status:receipt.status,
    boundary:receipt.boundary,
    details:receipt.details,
    error:receipt.error??null,
    observed_at:new Date().toISOString(),
  })
  if(error)throw new Error('DIRECTOR_AUTOPILOT_RECEIPT_WRITE_FAILED:'+error.message)
}

async function patchContext(
  client:SupabaseClient,
  row:ContextRow,
  patch:Record<string,unknown>,
):Promise<void>{
  const {error}=await client.from('director_project_business_context').update({
    ...patch,
    updated_at:new Date().toISOString(),
  }).eq('project_id',row.project_id).eq('owner_user_id',row.owner_user_id)
  if(error)throw new Error('DIRECTOR_AUTOPILOT_CONTEXT_WRITE_FAILED:'+error.message)
}

async function currentStageState(client:SupabaseClient,row:ContextRow){
  const plan=row.plan
  const ids=['storyboard','shotlist','previs','rehearsal','generation','edit','review','final']
    .map(kind=>stageId(row.project_id,plan.id,kind))
  const {data,error}=await client.from('director_creative_stages')
    .select('id,kind,status,output_artifact_ids,approved_at,approved_by')
    .eq('project_id',row.project_id).in('id',ids)
  if(error)throw new Error('DIRECTOR_AUTOPILOT_STAGE_READ_FAILED:'+error.message)
  return new Map((data??[]).map(stage=>[String(stage.kind),stage]))
}

async function currentGateState(client:SupabaseClient,row:ContextRow){
  const ids=['storyboard','shotlist','generation'].map(kind=>gateId(row.project_id,row.plan.id,kind))
  const {data,error}=await client.from('director_creative_gates')
    .select('id,kind,decision,decided_at,decided_by,evidence_ids')
    .eq('project_id',row.project_id)
    .eq('run_id',row.production_run_id??'')
    .in('id',ids)
  if(error)throw new Error('DIRECTOR_AUTOPILOT_GATE_READ_FAILED:'+error.message)
  return new Map((data??[]).map(gate=>[String(gate.kind),gate]))
}

async function wholeVideoStep(client:SupabaseClient,row:ContextRow):Promise<ProjectReceipt>{
  await reconcileDirectorVideoJobs(client,{limit:5,userId:row.owner_user_id})
  const {data:job,error}=await client.from('director_video_jobs')
    .select('id,status,error,preview_asset_id,current_phase')
    .eq('id',row.video_job_id??'').eq('user_id',row.owner_user_id).maybeSingle()
  if(error)throw new Error('DIRECTOR_AUTOPILOT_VIDEO_JOB_READ_FAILED:'+error.message)
  if(!job)throw new Error('DIRECTOR_AUTOPILOT_VIDEO_JOB_NOT_FOUND')
  const status=String(job.status)
  if(status==='preview_ready'){
    await patchContext(client,row,{automation_status:'review',automation_error:null})
    return Object.freeze({
      projectId:row.project_id,action:'reconcile-whole-video',status:'waiting',
      boundary:'DIRECTOR_REVIEW_AND_ASSET_APPROVAL',
      details:Object.freeze({videoJobId:job.id,previewAssetId:job.preview_asset_id,currentPhase:job.current_phase}),
    })
  }
  if(status==='blocked'||status==='failed'||status==='cancelled'){
    await patchContext(client,row,{automation_status:status==='failed'?'failed':'blocked',automation_error:job.error??status})
    return Object.freeze({
      projectId:row.project_id,action:'reconcile-whole-video',status:'blocked',
      boundary:'DIRECTOR_PROVIDER_OR_REVIEW_RECOVERY',
      details:Object.freeze({videoJobId:job.id,status,currentPhase:job.current_phase}),
      error:String(job.error??status),
    })
  }
  return Object.freeze({
    projectId:row.project_id,action:'reconcile-whole-video',status:'waiting',
    boundary:'DIRECTOR_VIDEO_JOB_RECONCILIATION',
    details:Object.freeze({videoJobId:job.id,status,currentPhase:job.current_phase}),
  })
}

async function shotOrchestrationStep(client:SupabaseClient,row:ContextRow):Promise<ProjectReceipt>{
  const plan=row.plan
  if(row.automation_status==='shot_orchestration_ready'){
    const result=await advanceSideHustleDirectorShotOrchestration({
      client,userId:row.owner_user_id,projectId:row.project_id,
    })
    return Object.freeze({
      projectId:row.project_id,action:'storyboard-shotlist-proposal',status:'advanced',
      boundary:result.nextBoundary,details:Object.freeze(details(result)),
    })
  }

  let [stages,gates]=await Promise.all([
    currentStageState(client,row),
    currentGateState(client,row),
  ])
  const storyboardGate=gates.get('storyboard')
  const shotlistGate=gates.get('shotlist')
  if(!storyboardGate||!shotlistGate){
    const result=await advanceSideHustleDirectorShotOrchestration({
      client,userId:row.owner_user_id,projectId:row.project_id,
    })
    return Object.freeze({
      projectId:row.project_id,action:'storyboard-shotlist-proposal',status:'advanced',
      boundary:result.nextBoundary,details:Object.freeze(details(result)),
    })
  }

  if([storyboardGate,shotlistGate].some(gate=>gate.decision==='rejected'||gate.decision==='changes_requested')){
    return Object.freeze({
      projectId:row.project_id,action:'storyboard-shotlist-gate',status:'blocked',
      boundary:'STORYBOARD_REVIEW_REQUIRED',
      details:Object.freeze({
        storyboardDecision:storyboardGate.decision,
        shotlistDecision:shotlistGate.decision,
      }),
      error:'DIRECTOR_STORYBOARD_OR_SHOTLIST_NOT_APPROVED',
    })
  }
  if([storyboardGate,shotlistGate].some(gate=>gate.decision!=='approved')){
    return Object.freeze({
      projectId:row.project_id,action:'storyboard-shotlist-gate',status:'waiting',
      boundary:'STORYBOARD_AND_SHOTLIST_APPROVAL_REQUIRED',
      details:Object.freeze({
        storyboardDecision:storyboardGate.decision,
        shotlistDecision:shotlistGate.decision,
      }),
    })
  }

  const storyboardStage=stages.get('storyboard')
  const shotlistStage=stages.get('shotlist')
  if(storyboardStage?.status!=='approved'||shotlistStage?.status!=='approved'){
    const result=await advanceSideHustleDirectorAfterStoryboardApproval({
      client,userId:row.owner_user_id,projectId:row.project_id,
    })
    return Object.freeze({
      projectId:row.project_id,action:'approve-storyboard-shotlist-stages',status:'advanced',
      boundary:result.nextBoundary,details:Object.freeze(details(result)),
    })
  }

  ;[stages,gates]=await Promise.all([currentStageState(client,row),currentGateState(client,row)])
  const generationGate=gates.get('generation')
  const previs=stages.get('previs')
  const rehearsal=stages.get('rehearsal')
  const generation=stages.get('generation')

  if(!generationGate||generationGate.decision!=='approved'){
    return Object.freeze({
      projectId:row.project_id,action:'generation-gate',status:'waiting',
      boundary:'GENERATION_APPROVAL_REQUIRED',
      details:Object.freeze({
        generationDecision:generationGate?.decision??'missing',
        previsStatus:previs?.status??'missing',
        rehearsalStatus:rehearsal?.status??'missing',
      }),
    })
  }

  const rehearsalReady=
    previs?.status==='approved'&&
    rehearsal?.status==='approved'&&
    Array.isArray(previs.output_artifact_ids)&&previs.output_artifact_ids.length>0&&
    Array.isArray(rehearsal.output_artifact_ids)&&rehearsal.output_artifact_ids.length>0

  if(!rehearsalReady){
    return Object.freeze({
      projectId:row.project_id,action:'previs-rehearsal',status:'waiting',
      boundary:'PREVIS_REHEARSAL_REQUIRED',
      details:Object.freeze({
        previsStatus:previs?.status??'missing',
        previsEvidence:Array.isArray(previs?.output_artifact_ids)?previs.output_artifact_ids.length:0,
        rehearsalStatus:rehearsal?.status??'missing',
        rehearsalEvidence:Array.isArray(rehearsal?.output_artifact_ids)?rehearsal.output_artifact_ids.length:0,
      }),
    })
  }

  if(generation?.status==='planned'){
    const result=await advanceSideHustleDirectorAfterRehearsal({
      client,userId:row.owner_user_id,projectId:row.project_id,
    })
    return Object.freeze({
      projectId:row.project_id,action:'generation-ready',status:'advanced',
      boundary:result.nextBoundary,details:Object.freeze(details(result)),
    })
  }

  const reconciliation=await reconcileSideHustleDirectorTakeSets({
    client,userId:row.owner_user_id,projectId:row.project_id,refreshLimit:4,qcDispatchLimit:2,
  })
  if(reconciliation.blockedGroups>0){
    return Object.freeze({
      projectId:row.project_id,action:'take-reconciliation',status:'blocked',
      boundary:'DIRECTOR_TAKE_REPAIR_OR_REVIEW_REQUIRED',
      details:Object.freeze(details(reconciliation)),
      error:'DIRECTOR_TAKE_SET_HAS_NO_ADMISSIBLE_WINNER',
    })
  }
  if(reconciliation.generationComplete){
    const proposal=await proposeSideHustleDirectorEditAssembly({
      client,userId:row.owner_user_id,projectId:row.project_id,
    })
    if(proposal.requiredApprovalAssetIds.length){
      return Object.freeze({
        projectId:row.project_id,action:'rough-cut-proposal',status:'waiting',
        boundary:'DIRECTOR_SELECTED_ASSET_APPROVAL',
        details:Object.freeze(details(proposal)),
      })
    }
    const materialized=await materializeSideHustleDirectorEditAssembly({
      client,userId:row.owner_user_id,projectId:row.project_id,
    })
    const audio=await compileSideHustleDirectorAudioPostPlan({
      client,userId:row.owner_user_id,projectId:row.project_id,
    })
    return Object.freeze({
      projectId:row.project_id,action:'rough-cut-audio-plan',status:'advanced',
      boundary:String(audio.nextBoundary),
      details:Object.freeze({
        assembly:details(materialized),
        audio:details(audio),
      }),
    })
  }

  if(
    reconciliation.qcDispatched>0||
    reconciliation.waitingForQcGroups>0||
    reconciliation.refreshed>0
  ){
    return Object.freeze({
      projectId:row.project_id,action:'take-reconciliation',status:'waiting',
      boundary:'DIRECTOR_TAKE_RECONCILIATION',
      details:Object.freeze(details(reconciliation)),
    })
  }

  const {data:active,error:activeError}=await client.from('director_generation_tasks')
    .select('id,status')
    .eq('project_id',row.project_id)
    .in('status',['queued','running'])
    .limit(1)
  if(activeError)throw new Error('DIRECTOR_AUTOPILOT_ACTIVE_TAKE_READ_FAILED:'+activeError.message)
  if((active??[]).length){
    return Object.freeze({
      projectId:row.project_id,action:'take-batch',status:'waiting',
      boundary:'DIRECTOR_TAKE_RECONCILIATION',
      details:Object.freeze({activeGenerationTaskId:String(active![0]!.id)}),
    })
  }

  const submitted=await submitSideHustleDirectorTakeBatch({
    client,userId:row.owner_user_id,projectId:row.project_id,maxBoards:1,
  })
  return Object.freeze({
    projectId:row.project_id,action:'take-batch',status:submitted.submitted.length?'advanced':'waiting',
    boundary:submitted.nextBoundary,details:Object.freeze(details(submitted)),
  })
}

async function runProject(client:SupabaseClient,row:ContextRow):Promise<ProjectReceipt>{
  try{
    const receipt=row.video_job_id
      ?await wholeVideoStep(client,row)
      :await shotOrchestrationStep(client,row)
    await appendReceipt(client,row,receipt)
    return receipt
  }catch(error){
    const message=error instanceof Error?error.message:String(error)
    const waiting=expectedWait(message)
    const receipt:ProjectReceipt=Object.freeze({
      projectId:row.project_id,
      action:'director-autopilot',
      status:waiting?'waiting':'failed',
      boundary:waiting?'DIRECTOR_EXTERNAL_OR_APPROVAL_BOUNDARY':'DIRECTOR_AUTOPILOT_REPAIR_REQUIRED',
      details:Object.freeze({automationStatus:row.automation_status}),
      error:message,
    })
    await appendReceipt(client,row,receipt)
    if(!waiting){
      await patchContext(client,row,{automation_error:message})
    }
    return receipt
  }
}

export async function runSideHustleDirectorAutopilotWorker(
  client:SupabaseClient,
  options:{limit?:number;now?:Date}={},
):Promise<SideHustleDirectorAutopilotWorkerReceipt>{
  const now=options.now??new Date()
  const limit=Math.max(1,Math.min(20,Math.floor(options.limit??5)))
  const {data,error}=await client.from('director_project_business_context')
    .select('project_id,owner_user_id,production_run_id,video_job_id,automation_status,automation_error,plan,updated_at')
    .in('automation_status',['shot_orchestration_ready','running','review'])
    .not('production_run_id','is',null)
    .order('updated_at',{ascending:true})
    .limit(limit)
  if(error)throw new Error('DIRECTOR_AUTOPILOT_SCAN_FAILED:'+error.message)
  const rows=(data??[]) as ContextRow[]
  const projects:ProjectReceipt[]=[]
  for(const row of rows){
    if(!row.plan||row.plan.directorProjectId!==row.project_id){
      const receipt:ProjectReceipt=Object.freeze({
        projectId:row.project_id,action:'director-autopilot',status:'failed',
        boundary:'DIRECTOR_CONTEXT_REPAIR_REQUIRED',
        details:Object.freeze({}),
        error:'DIRECTOR_AUTOPILOT_CONTEXT_INVALID',
      })
      await appendReceipt(client,row,receipt)
      projects.push(receipt)
      continue
    }
    projects.push(await runProject(client,row))
  }

  return Object.freeze({
    ranAt:now.toISOString(),
    scanned:rows.length,
    advanced:projects.filter(item=>item.status==='advanced').length,
    waiting:projects.filter(item=>item.status==='waiting'||item.status==='noop').length,
    blocked:projects.filter(item=>item.status==='blocked').length,
    failed:projects.filter(item=>item.status==='failed').length,
    projects:Object.freeze(projects),
    authority:'DIRECTOR_ORCHESTRATION_ONLY',
    canApproveCreative:false,
    canPublish:false,
    canSpendPaidMedia:false,
  })
}
