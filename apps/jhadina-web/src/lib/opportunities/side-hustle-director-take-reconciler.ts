import {createHmac} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import {
  FACELESS_TAKE_POLICY,
  VISUAL_SHOT_TAKE_POLICY,
  rankMultimodalTakes,
  type MultimodalTakeCandidate,
  type TakeDimensionEvidence,
  type TakeSelectionPolicy,
} from '@jhadina/director-core'
import {createConfiguredDirectorGenerationRuntime} from '@/lib/director-generation-composition'
import type {SideHustleDirectorProductionPlan} from './side-hustle-director-bridge'

type TaskRow={
  id:string
  status:'queued'|'running'|'completed'|'failed'|'cancelled'
  error:string|null
  idempotency_key:string
  request:{
    requestId?:string
    prompt?:string
    parameters?:Record<string,unknown>
  }
}
type AssetRow={
  id:string
  generation_job_id:string
  uri:string
  metadata:Record<string,unknown>|null
}
type QcRow={
  take_group_id:string
  take_id:string
  generation_task_id:string
  asset_id:string
  dimension:TakeDimensionEvidence['dimension']
  score:number
  confidence:number
  evidence_ids:string[]|null
  notes:string[]|null
  hard_failures:string[]|null
  observation_ids:string[]|null
}

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(String).map(value=>value.trim()).filter(Boolean))]
}

function workerConfig(){
  const url=process.env.JHADINA_DIRECTOR_WATCH_WORKER_URL?.trim()??''
  const token=process.env.JHADINA_DIRECTOR_WATCH_WORKER_TOKEN?.trim()??''
  const callbackUrl=process.env.JHADINA_DIRECTOR_WATCH_CALLBACK_URL?.trim()??''
  const callbackSecret=process.env.JHADINA_DIRECTOR_WATCH_CALLBACK_SECRET?.trim()??''
  return url&&token&&callbackUrl&&callbackSecret?{url,token,callbackUrl,callbackSecret}:undefined
}

function callbackToken(secret:string,jobId:string):string{
  return createHmac('sha256',secret).update(jobId).digest('base64url')
}

function storageLocation(uri:string):{bucket:string;path:string}|undefined{
  const prefix='storage://'
  if(!uri.startsWith(prefix))return undefined
  const rest=uri.slice(prefix.length)
  const slash=rest.indexOf('/')
  if(slash<=0||slash===rest.length-1)return undefined
  return {bucket:rest.slice(0,slash),path:rest.slice(slash+1)}
}

function takeIdentity(task:TaskRow){
  const parameters=task.request?.parameters??{}
  const takeGroupId=typeof parameters.takeGroupId==='string'?parameters.takeGroupId:''
  const candidateIndex=typeof parameters.candidateIndex==='number'&&Number.isInteger(parameters.candidateIndex)
    ? parameters.candidateIndex
    : undefined
  const marker=':take:'
  const takeId=task.idempotency_key.includes(marker)
    ? task.idempotency_key.slice(task.idempotency_key.indexOf(marker)+marker.length)
    : ''
  return {takeGroupId,takeId,candidateIndex}
}

async function dispatchQc(input:{
  client:SupabaseClient
  ownerUserId:string
  projectId:string
  task:TaskRow
  asset:AssetRow
}):Promise<string|undefined>{
  const {client,ownerUserId,projectId,task,asset}=input
  const identity=takeIdentity(task)
  if(!identity.takeGroupId||!identity.takeId)return undefined

  const {data:existing,error:existingError}=await client.from('director_watch_jobs')
    .select('id,status')
    .eq('purpose','take-qc')
    .eq('project_id',projectId)
    .eq('asset_id',asset.id)
    .in('status',['queued','submitted','running','completed'])
    .order('created_at',{ascending:false})
    .limit(1)
    .maybeSingle()
  if(existingError)throw new Error('DIRECTOR_TAKE_QC_JOB_READ_FAILED:'+existingError.message)
  if(existing)return String(existing.id)

  const location=storageLocation(asset.uri)
  if(!location)throw new Error('DIRECTOR_TAKE_QC_STORAGE_URI_REQUIRED:'+asset.id)
  const {data:signed,error:signedError}=await client.storage.from(location.bucket).createSignedUrl(location.path,15*60)
  if(signedError||!signed?.signedUrl)throw new Error('DIRECTOR_TAKE_QC_SIGNED_URL_FAILED:'+(signedError?.message??asset.id))

  const config=workerConfig()
  if(!config)return undefined
  const jobId='watch:take-qc:'+crypto.randomUUID()
  const requestPayload={
    jobId,
    purpose:'take-qc',
    sourceKind:'authorized-stream',
    sourceLocator:signed.signedUrl,
    sampleEverySeconds:1.5,
    maxFrames:24,
    rightsVerified:true,
    sourceAuthorized:true,
    callbackUrl:config.callbackUrl,
    projectId,
    takeGroupId:identity.takeGroupId,
    takeId:identity.takeId,
    generationTaskId:task.id,
    assetId:asset.id,
    qcContext:typeof task.request.prompt==='string'?task.request.prompt:'',
  }

  const now=new Date().toISOString()
  const {error:insertError}=await client.from('director_watch_jobs').insert({
    id:jobId,
    owner_user_id:ownerUserId,
    purpose:'take-qc',
    source_kind:'authorized-stream',
    source_locator:asset.uri,
    status:'queued',
    provider_id:'runpod-watch-worker',
    request:{...requestPayload,sourceLocator:'SIGNED_URL_REDACTED'},
    project_id:projectId,
    take_group_id:identity.takeGroupId,
    take_id:identity.takeId,
    generation_task_id:task.id,
    asset_id:asset.id,
    low_priority_background:false,
    created_at:now,
    updated_at:now,
  })
  if(insertError)throw new Error('DIRECTOR_TAKE_QC_JOB_WRITE_FAILED:'+insertError.message)

  const response=await fetch(config.url,{
    method:'POST',
    headers:{'content-type':'application/json',authorization:'Bearer '+config.token},
    body:JSON.stringify({
      input:{
        ...requestPayload,
        callbackToken:callbackToken(config.callbackSecret,jobId),
      },
    }),
  })
  if(!response.ok){
    const code='DIRECTOR_TAKE_QC_DISPATCH_FAILED:'+response.status
    await client.from('director_watch_jobs').update({
      status:'blocked',error:code,updated_at:new Date().toISOString(),
    }).eq('id',jobId)
    return undefined
  }
  await client.from('director_watch_jobs').update({
    status:'submitted',updated_at:new Date().toISOString(),
  }).eq('id',jobId)
  return jobId
}

function policyFor(plan:SideHustleDirectorProductionPlan):TakeSelectionPolicy{
  return plan.format==='faceless_youtube'?FACELESS_TAKE_POLICY:VISUAL_SHOT_TAKE_POLICY
}

export async function reconcileSideHustleDirectorTakeSets(input:{
  client:SupabaseClient
  userId:string
  projectId:string
  refreshLimit?:number
  qcDispatchLimit?:number
}):Promise<Readonly<{
  projectId:string
  refreshed:number
  completedTasks:number
  qcDispatched:number
  selectedGroups:number
  blockedGroups:number
  waitingForQcGroups:number
  generationComplete:boolean
  nextBoundary:'DIRECTOR_TAKE_RECONCILIATION'|'DIRECTOR_EDIT_ASSEMBLY'
  publicationAuthority:'NONE'
  paidMediaAuthority:'NONE'
}>>{
  const {client,userId,projectId}=input
  const refreshLimit=Math.max(1,Math.min(12,input.refreshLimit??6))
  const qcDispatchLimit=Math.max(1,Math.min(6,input.qcDispatchLimit??3))
  const {data:context,error:contextError}=await client.from('director_project_business_context')
    .select('owner_user_id,production_run_id,plan').eq('project_id',projectId).eq('owner_user_id',userId).maybeSingle()
  if(contextError)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_READ_FAILED:'+contextError.message)
  if(!context)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_NOT_FOUND')
  const plan=context.plan as SideHustleDirectorProductionPlan
  if(!plan||plan.directorProjectId!==projectId)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_INVALID')

  const prefix='director:'+projectId+':take:take-group:'+plan.id+':'
  const {data:initial,error:taskError}=await client.from('director_generation_tasks')
    .select('id,status,error,idempotency_key,request')
    .eq('project_id',projectId)
    .like('idempotency_key',prefix+'%')
    .order('created_at',{ascending:true})
  if(taskError)throw new Error('SIDE_HUSTLE_DIRECTOR_GENERATION_TASK_READ_FAILED:'+taskError.message)
  const initialTasks=(initial??[]) as TaskRow[]

  let refreshed=0
  const active=initialTasks.filter(task=>task.status==='queued'||task.status==='running').slice(0,refreshLimit)
  if(active.length){
    const runtime=await createConfiguredDirectorGenerationRuntime(client)
    for(const task of active){
      try{
        await runtime.refreshGenerationJob(task.id)
        refreshed+=1
      }catch(error){
        const message=error instanceof Error?error.message:String(error)
        if(!/not found/i.test(message))throw error
      }
    }
  }

  const {data:after,error:afterError}=await client.from('director_generation_tasks')
    .select('id,status,error,idempotency_key,request')
    .eq('project_id',projectId)
    .like('idempotency_key',prefix+'%')
    .order('created_at',{ascending:true})
  if(afterError)throw new Error('SIDE_HUSTLE_DIRECTOR_GENERATION_TASK_REFRESH_READ_FAILED:'+afterError.message)
  const tasks=(after??[]) as TaskRow[]
  const completed=tasks.filter(task=>task.status==='completed')
  const completedIds=completed.map(task=>task.id)
  const assetQuery=completedIds.length
    ? await client.from('director_generated_editing_assets')
        .select('id,generation_job_id,uri,metadata')
        .eq('project_id',projectId)
        .in('generation_job_id',completedIds)
    : {data:[],error:null}
  if(assetQuery.error)throw new Error('SIDE_HUSTLE_DIRECTOR_GENERATED_ASSET_READ_FAILED:'+assetQuery.error.message)
  const assets=(assetQuery.data??[]) as AssetRow[]
  const assetByGeneration=new Map(assets.map(asset=>[asset.generation_job_id,asset]))

  let qcDispatched=0
  const config=workerConfig()
  for(const task of completed){
    if(qcDispatched>=qcDispatchLimit)break
    const asset=assetByGeneration.get(task.id)
    if(!asset)continue
    const identity=takeIdentity(task)
    const {data:evidence,error:evidenceError}=await client.from('director_take_qc_evidence')
      .select('id').eq('project_id',projectId).eq('take_id',identity.takeId).limit(1)
    if(evidenceError)throw new Error('DIRECTOR_TAKE_QC_EVIDENCE_READ_FAILED:'+evidenceError.message)
    if((evidence??[]).length)continue
    if(!config)break
    const jobId=await dispatchQc({client,ownerUserId:userId,projectId,task,asset})
    if(jobId)qcDispatched+=1
  }

  if(plan.format==='faceless_youtube'&&plan.rightsEvidenceRefs.length){
    for(const task of completed){
      const asset=assetByGeneration.get(task.id)
      if(!asset)continue
      const identity=takeIdentity(task)
      if(!identity.takeGroupId||!identity.takeId)continue
      const {error}=await client.from('director_take_qc_evidence').upsert({
        id:identity.takeId+':qc:rights-confidence:business-rights-v1',
        project_id:projectId,
        owner_user_id:userId,
        take_group_id:identity.takeGroupId,
        take_id:identity.takeId,
        generation_task_id:task.id,
        asset_id:asset.id,
        dimension:'rights-confidence',
        score:1,
        confidence:1,
        evidence_ids:[...plan.rightsEvidenceRefs],
        notes:['Business Factory supplied explicit rights/provenance evidence for the production source set.'],
        hard_failures:[],
        observation_ids:[],
        source:'business-rights:v1',
      },{onConflict:'project_id,take_id,dimension,source'})
      if(error)throw new Error('DIRECTOR_TAKE_RIGHTS_EVIDENCE_WRITE_FAILED:'+error.message)
    }
  }

  const {data:qcRaw,error:qcError}=await client.from('director_take_qc_evidence')
    .select('take_group_id,take_id,generation_task_id,asset_id,dimension,score,confidence,evidence_ids,notes,hard_failures,observation_ids')
    .eq('project_id',projectId)
    .order('created_at',{ascending:true})
  if(qcError)throw new Error('DIRECTOR_TAKE_QC_READ_FAILED:'+qcError.message)
  const qc=(qcRaw??[]) as QcRow[]

  const tasksByGroup=new Map<string,TaskRow[]>()
  for(const task of tasks){
    const identity=takeIdentity(task)
    if(!identity.takeGroupId)continue
    const current=tasksByGroup.get(identity.takeGroupId)??[]
    current.push(task)
    tasksByGroup.set(identity.takeGroupId,current)
  }

  let selectedGroups=0
  let blockedGroups=0
  let waitingForQcGroups=0
  const policy=policyFor(plan)
  for(const [takeGroupId,groupTasks] of tasksByGroup){
    if(groupTasks.length<plan.takeSet.candidateCount)continue
    if(groupTasks.some(task=>task.status==='queued'||task.status==='running')){
      waitingForQcGroups+=1
      continue
    }
    const candidates:MultimodalTakeCandidate[]=[]
    for(const task of groupTasks){
      if(task.status!=='completed')continue
      const asset=assetByGeneration.get(task.id)
      if(!asset)continue
      const identity=takeIdentity(task)
      const rows=qc.filter(row=>row.take_group_id===takeGroupId&&row.take_id===identity.takeId&&row.asset_id===asset.id)
      if(!rows.length)continue
      candidates.push({
        takeId:identity.takeId,
        assetId:asset.id,
        dimensions:rows.map(row=>({
          dimension:row.dimension,
          score:Number(row.score),
          confidence:Number(row.confidence),
          evidenceIds:unique(row.evidence_ids??[]),
          notes:unique(row.notes??[]),
        })),
        hardFailures:unique(rows.flatMap(row=>row.hard_failures??[])),
        observationIds:unique(rows.flatMap(row=>row.observation_ids??[])),
      })
    }

    if(candidates.length<groupTasks.filter(task=>task.status==='completed').length){
      waitingForQcGroups+=1
      continue
    }
    const result=rankMultimodalTakes(candidates,policy)
    const selected=result.selectedTakeId
    const selectedCandidate=selected?candidates.find(candidate=>candidate.takeId===selected):undefined
    const selectionEvidence=unique(result.ranked.flatMap(item=>item.evidenceIds))
    const now=new Date().toISOString()
    const {error:selectionError}=await client.from('director_take_selections').upsert({
      id:'take-selection:'+takeGroupId,
      project_id:projectId,
      owner_user_id:userId,
      take_group_id:takeGroupId,
      policy_id:policy.id,
      selected_take_id:selected??null,
      selected_asset_id:selectedCandidate?.assetId??null,
      alternate_take_ids:[...result.alternates],
      ranked:result.ranked,
      status:selected?'selected':'blocked',
      evidence_ids:selectionEvidence,
      updated_at:now,
    },{onConflict:'project_id,take_group_id'})
    if(selectionError)throw new Error('DIRECTOR_TAKE_SELECTION_WRITE_FAILED:'+selectionError.message)

    if(selected&&selectedCandidate){
      selectedGroups+=1
      const boardId=takeGroupId.slice(('take-group:'+plan.id+':').length)
      const {error:boardError}=await client.from('director_storyboard_boards').update({
        status:'approved',updated_at:now,
      }).eq('id',boardId).eq('project_id',projectId)
      if(boardError)throw new Error('DIRECTOR_SELECTED_BOARD_WRITE_FAILED:'+boardError.message)
      const {data:stage,error:stageReadError}=await client.from('director_creative_stages')
        .select('output_artifact_ids').eq('id','stage:business:'+plan.id+':generation').eq('project_id',projectId).maybeSingle()
      if(stageReadError)throw new Error('DIRECTOR_GENERATION_STAGE_READ_FAILED:'+stageReadError.message)
      const outputs=Array.isArray(stage?.output_artifact_ids)?stage.output_artifact_ids.map(String):[]
      const {error:stageWriteError}=await client.from('director_creative_stages').update({
        output_artifact_ids:unique([...outputs,selectedCandidate.assetId]),
        updated_at:now,
      }).eq('id','stage:business:'+plan.id+':generation').eq('project_id',projectId)
      if(stageWriteError)throw new Error('DIRECTOR_GENERATION_STAGE_OUTPUT_WRITE_FAILED:'+stageWriteError.message)
    }else{
      blockedGroups+=1
    }
  }

  const {data:boards,error:boardsError}=await client.from('director_storyboard_boards')
    .select('id,status').eq('project_id',projectId)
  if(boardsError)throw new Error('DIRECTOR_STORYBOARD_COMPLETION_READ_FAILED:'+boardsError.message)
  const boardRows=boards??[]
  const generationComplete=boardRows.length>0&&boardRows.every(row=>row.status==='approved')
  if(generationComplete){
    const now=new Date().toISOString()
    const {error:generationError}=await client.from('director_creative_stages').update({
      status:'approved',approved_at:now,approved_by:'director-multimodal-take-selection',updated_at:now,
    }).eq('id','stage:business:'+plan.id+':generation').eq('project_id',projectId)
    if(generationError)throw new Error('DIRECTOR_GENERATION_COMPLETE_WRITE_FAILED:'+generationError.message)
    const {error:editError}=await client.from('director_creative_stages').update({
      status:'ready',updated_at:now,
    }).eq('id','stage:business:'+plan.id+':edit').eq('project_id',projectId)
    if(editError)throw new Error('DIRECTOR_EDIT_READY_WRITE_FAILED:'+editError.message)
  }

  return Object.freeze({
    projectId,
    refreshed,
    completedTasks:completed.length,
    qcDispatched,
    selectedGroups,
    blockedGroups,
    waitingForQcGroups,
    generationComplete,
    nextBoundary:generationComplete?'DIRECTOR_EDIT_ASSEMBLY':'DIRECTOR_TAKE_RECONCILIATION',
    publicationAuthority:'NONE',
    paidMediaAuthority:'NONE',
  })
}
