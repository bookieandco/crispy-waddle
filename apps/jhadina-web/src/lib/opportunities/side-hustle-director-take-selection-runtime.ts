import {createHmac} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import {
  rankMultimodalTakes,
  type MultimodalTakeCandidate,
  type TakeDimensionEvidence,
  type TakeSelectionPolicy,
} from '@jhadina/director-core'
import {createConfiguredDirectorGenerationRuntime} from '@/lib/director-generation-composition'
import type {SideHustleDirectorProductionPlan} from './side-hustle-director-bridge'

type TaskRow={
  id:string
  status:string
  request:{
    prompt?:string
    parameters?:Record<string,unknown>
  }
}
type AssetRow={
  id:string
  generation_job_id:string
  uri:string
  media_type:string
}
type EvidenceRow={
  take_group_id:string
  take_id:string
  generation_task_id:string
  asset_id:string
  dimension:TakeDimensionEvidence['dimension']
  score:number
  confidence:number
  evidence_ids:string[]
  notes:string[]
  hard_failures:string[]
  observation_ids:string[]
}
type WatchJobRow={take_id:string|null;status:string}

const WATCH_PROVIDER_ID='runpod-watch-worker'

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>String(value).trim()).filter(Boolean))]
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
function storageObjectPath(uri:string):string|undefined{
  const prefix='storage://director-media/'
  return uri.startsWith(prefix)?uri.slice(prefix.length):undefined
}
function preassemblyPolicy(plan:SideHustleDirectorProductionPlan):TakeSelectionPolicy{
  const faceless=plan.format==='faceless_youtube'
  return Object.freeze({
    id:faceless?'business-faceless-preassembly:v1':'business-visual-preassembly:v1',
    requiredDimensions:Object.freeze(
      faceless
        ? ['technical','visual-readability','story-function','source-relevance','rights-confidence'] as const
        : ['technical','visual-readability','story-function'] as const
    ),
    weights:Object.freeze(faceless?{
      technical:1,
      'visual-readability':1.2,
      'story-function':1.5,
      'source-relevance':1.6,
      'rights-confidence':1.3,
      motion:0.5,
      performance:0.6,
    }:{
      technical:1,
      'visual-readability':1.25,
      'story-function':1.6,
      motion:0.75,
      performance:0.8,
      continuity:0.7,
    }),
    minimumDimensionConfidence:0.5,
    minimumOverallScore:0.58,
    preserveAlternates:Math.max(1,Math.min(3,plan.takeSet.preserveAlternates)),
  })
}
function requestParameters(task:TaskRow):Record<string,unknown>{
  return task.request?.parameters&&typeof task.request.parameters==='object'?task.request.parameters:{}
}
function takeIdentity(task:TaskRow){
  const parameters=requestParameters(task)
  const takeGroupId=typeof parameters.takeGroupId==='string'?parameters.takeGroupId.trim():''
  const candidateIndex=typeof parameters.candidateIndex==='number'?parameters.candidateIndex:undefined
  if(!takeGroupId||!candidateIndex)return undefined
  const takeId=takeGroupId+':candidate:'+candidateIndex
  return {takeGroupId,takeId,candidateIndex}
}

async function ensureRightsEvidence(
  client:SupabaseClient,
  input:{userId:string;projectId:string;plan:SideHustleDirectorProductionPlan;task:TaskRow;asset:AssetRow},
):Promise<void>{
  const identity=takeIdentity(input.task)
  if(!identity||!input.plan.rightsRefs.length)return
  const {error}=await client.from('director_take_qc_evidence').upsert({
    id:identity.takeId+':qc:rights-confidence:business-lineage-v1',
    project_id:input.projectId,
    owner_user_id:input.userId,
    take_group_id:identity.takeGroupId,
    take_id:identity.takeId,
    generation_task_id:input.task.id,
    asset_id:input.asset.id,
    dimension:'rights-confidence',
    score:1,
    confidence:1,
    evidence_ids:unique(input.plan.rightsRefs),
    notes:['Business Factory production plan carries explicit rights evidence for this production.'],
    hard_failures:[],
    observation_ids:[],
    source:'business-rights-lineage:v1',
  },{onConflict:'project_id,take_id,dimension,source'})
  if(error)throw new Error('SIDE_HUSTLE_DIRECTOR_RIGHTS_QC_WRITE_FAILED:'+error.message)
}

async function dispatchTakeQc(
  client:SupabaseClient,
  input:{
    userId:string
    projectId:string
    task:TaskRow
    asset:AssetRow
    qcContext:string
  },
):Promise<'submitted'|'already-active'|'blocked'>{
  const identity=takeIdentity(input.task)
  if(!identity)throw new Error('SIDE_HUSTLE_DIRECTOR_TAKE_IDENTITY_MISSING:'+input.task.id)
  const {data:existing,error:existingError}=await client.from('director_watch_jobs')
    .select('id,status,take_id')
    .eq('purpose','take-qc')
    .eq('project_id',input.projectId)
    .eq('take_id',identity.takeId)
    .order('created_at',{ascending:false})
    .limit(1)
  if(existingError)throw new Error('SIDE_HUSTLE_DIRECTOR_TAKE_QC_JOB_READ_FAILED:'+existingError.message)
  const prior=(existing??[])[0] as {id:string;status:string}|undefined
  if(prior&&['queued','submitted','running','completed'].includes(prior.status))return 'already-active'

  const config=workerConfig()
  if(!config)return 'blocked'
  const objectPath=storageObjectPath(input.asset.uri)
  if(!objectPath)throw new Error('SIDE_HUSTLE_DIRECTOR_TAKE_ASSET_STORAGE_URI_REQUIRED:'+input.asset.id)
  const {data:signed,error:signedError}=await client.storage.from('director-media').createSignedUrl(objectPath,3600)
  if(signedError||!signed?.signedUrl)throw new Error('SIDE_HUSTLE_DIRECTOR_TAKE_ASSET_SIGN_FAILED:'+(signedError?.message??'missing'))

  const jobId='watch:take-qc:'+crypto.randomUUID()
  const payload={
    jobId,
    purpose:'take-qc',
    projectId:input.projectId,
    takeGroupId:identity.takeGroupId,
    takeId:identity.takeId,
    generationTaskId:input.task.id,
    assetId:input.asset.id,
    sourceKind:'authorized-stream',
    sourceLocator:signed.signedUrl,
    sampleEverySeconds:1.5,
    maxFrames:24,
    rightsVerified:true,
    sourceAuthorized:true,
    qcContext:input.qcContext.slice(0,6000),
    callbackUrl:config.callbackUrl,
  }
  const now=new Date().toISOString()
  const {error:insertError}=await client.from('director_watch_jobs').insert({
    id:jobId,
    owner_user_id:input.userId,
    purpose:'take-qc',
    project_id:input.projectId,
    take_group_id:identity.takeGroupId,
    take_id:identity.takeId,
    generation_task_id:input.task.id,
    asset_id:input.asset.id,
    source_kind:'authorized-stream',
    source_locator:signed.signedUrl,
    status:'queued',
    provider_id:WATCH_PROVIDER_ID,
    request:payload,
    created_at:now,
    updated_at:now,
  })
  if(insertError)throw new Error('SIDE_HUSTLE_DIRECTOR_TAKE_QC_JOB_WRITE_FAILED:'+insertError.message)

  const response=await fetch(config.url,{
    method:'POST',
    headers:{'content-type':'application/json',authorization:'Bearer '+config.token},
    body:JSON.stringify({input:{...payload,callbackToken:callbackToken(config.callbackSecret,jobId)}}),
  })
  if(!response.ok){
    await client.from('director_watch_jobs').update({
      status:'blocked',
      error:'DIRECTOR_WATCH_WORKER_DISPATCH_FAILED:'+response.status,
      updated_at:now,
    }).eq('id',jobId)
    return 'blocked'
  }
  await client.from('director_watch_jobs').update({status:'submitted',updated_at:now}).eq('id',jobId)
  return 'submitted'
}

function candidatesForGroup(rows:EvidenceRow[]):MultimodalTakeCandidate[]{
  const byTake=new Map<string,EvidenceRow[]>()
  for(const row of rows){
    const current=byTake.get(row.take_id)??[]
    current.push(row)
    byTake.set(row.take_id,current)
  }
  return [...byTake.entries()].map(([takeId,items])=>{
    const first=items[0]!
    const hardFailures=unique(items.flatMap(item=>item.hard_failures??[]))
    const observationIds=unique(items.flatMap(item=>item.observation_ids??[]))
    const dimensions:TakeDimensionEvidence[]=items.map(item=>({
      dimension:item.dimension,
      score:Number(item.score),
      confidence:Number(item.confidence),
      evidenceIds:Object.freeze(unique(item.evidence_ids??[])),
      notes:Object.freeze(unique(item.notes??[])),
    }))
    return Object.freeze({
      takeId,
      assetId:first.asset_id,
      dimensions:Object.freeze(dimensions),
      hardFailures:Object.freeze(hardFailures),
      observationIds:Object.freeze(observationIds),
    })
  })
}

export async function reconcileSideHustleDirectorTakeSelection(input:{
  client:SupabaseClient
  userId:string
  projectId:string
  refreshLimit?:number
}):Promise<Readonly<{
  projectId:string
  refreshed:number
  qcSubmitted:number
  qcBlocked:number
  waitingGroups:readonly string[]
  selectedGroups:readonly Readonly<{
    takeGroupId:string
    selectedTakeId:string
    selectedAssetId:string
    alternateTakeIds:readonly string[]
    score:number
  }>[]
  status:'waiting_generation'|'waiting_qc'|'selected'
  nextBoundary:'DIRECTOR_TAKE_QC'|'DIRECTOR_AUTO_ASSEMBLY'
  publicationAuthority:'NONE'
  paidMediaAuthority:'NONE'
}>>{
  const {client,userId,projectId}=input
  const {data:context,error:contextError}=await client.from('director_project_business_context')
    .select('plan').eq('project_id',projectId).eq('owner_user_id',userId).maybeSingle()
  if(contextError)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_READ_FAILED:'+contextError.message)
  if(!context)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_NOT_FOUND')
  const plan=context.plan as SideHustleDirectorProductionPlan
  if(!plan||plan.directorProjectId!==projectId)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_INVALID')
  const policy=preassemblyPolicy(plan)

  const {data:tasksRaw,error:tasksError}=await client.from('director_generation_tasks')
    .select('id,status,request').eq('project_id',projectId).order('created_at',{ascending:true})
  if(tasksError)throw new Error('SIDE_HUSTLE_DIRECTOR_GENERATION_TASK_READ_FAILED:'+tasksError.message)
  const tasks=(tasksRaw??[] as TaskRow[]).filter(task=>Boolean(takeIdentity(task)))
  if(!tasks.length){
    return Object.freeze({
      projectId,refreshed:0,qcSubmitted:0,qcBlocked:0,waitingGroups:Object.freeze([]),
      selectedGroups:Object.freeze([]),status:'waiting_generation',nextBoundary:'DIRECTOR_TAKE_QC',
      publicationAuthority:'NONE',paidMediaAuthority:'NONE',
    })
  }

  const runtime=await createConfiguredDirectorGenerationRuntime(client)
  let refreshed=0
  for(const task of tasks.filter(item=>item.status==='queued'||item.status==='running').slice(0,Math.max(1,Math.min(12,input.refreshLimit??6)))){
    try{
      await runtime.refreshGenerationJob(task.id)
      refreshed+=1
    }catch(error){
      const message=error instanceof Error?error.message:String(error)
      if(!/not found|provider job/i.test(message))throw error
    }
  }

  const {data:latestTasksRaw,error:latestTaskError}=await client.from('director_generation_tasks')
    .select('id,status,request').eq('project_id',projectId).order('created_at',{ascending:true})
  if(latestTaskError)throw new Error('SIDE_HUSTLE_DIRECTOR_GENERATION_TASK_REFRESH_READ_FAILED:'+latestTaskError.message)
  const latestTasks=(latestTasksRaw??[] as TaskRow[]).filter(task=>Boolean(takeIdentity(task)))

  const completed=latestTasks.filter(task=>task.status==='completed')
  const taskIds=completed.map(task=>task.id)
  const assetQuery=taskIds.length
    ? await client.from('director_generated_editing_assets')
        .select('id,generation_job_id,uri,media_type')
        .eq('project_id',projectId).in('generation_job_id',taskIds)
    : {data:[],error:null}
  if(assetQuery.error)throw new Error('SIDE_HUSTLE_DIRECTOR_TAKE_ASSET_READ_FAILED:'+assetQuery.error.message)
  const assets=(assetQuery.data??[]) as AssetRow[]
  const assetByTask=new Map(assets.filter(asset=>asset.media_type==='video').map(asset=>[asset.generation_job_id,asset]))

  let qcSubmitted=0,qcBlocked=0
  for(const task of completed){
    const asset=assetByTask.get(task.id)
    if(!asset)continue
    await ensureRightsEvidence(client,{userId,projectId,plan,task,asset})
    const result=await dispatchTakeQc(client,{
      userId,projectId,task,asset,
      qcContext:[
        'Production intent: '+plan.activeTask,
        'Generated take prompt: '+String(task.request?.prompt??''),
        'Evaluate only this candidate for pre-assembly ranking. Final production QC remains separate.',
      ].join('\n'),
    })
    if(result==='submitted')qcSubmitted+=1
    if(result==='blocked')qcBlocked+=1
  }

  const groups=unique(latestTasks.map(task=>takeIdentity(task)?.takeGroupId??''))
  const {data:evidenceRaw,error:evidenceError}=await client.from('director_take_qc_evidence')
    .select('take_group_id,take_id,generation_task_id,asset_id,dimension,score,confidence,evidence_ids,notes,hard_failures,observation_ids')
    .eq('project_id',projectId).eq('owner_user_id',userId).in('take_group_id',groups.length?groups:['__none__'])
  if(evidenceError)throw new Error('SIDE_HUSTLE_DIRECTOR_TAKE_QC_READ_FAILED:'+evidenceError.message)
  const evidence=(evidenceRaw??[]) as EvidenceRow[]

  const waitingGroups:string[]=[]
  const selectedGroups:Array<Readonly<{takeGroupId:string;selectedTakeId:string;selectedAssetId:string;alternateTakeIds:readonly string[];score:number}>>=[]
  for(const takeGroupId of groups){
    const groupTasks=latestTasks.filter(task=>takeIdentity(task)?.takeGroupId===takeGroupId)
    if(groupTasks.some(task=>task.status==='queued'||task.status==='running')){
      waitingGroups.push(takeGroupId)
      continue
    }
    const groupRows=evidence.filter(row=>row.take_group_id===takeGroupId)
    const candidates=candidatesForGroup(groupRows)
    if(candidates.length<groupTasks.filter(task=>task.status==='completed').length){
      waitingGroups.push(takeGroupId)
      continue
    }
    const result=rankMultimodalTakes(candidates,policy)
    if(!result.selectedTakeId){
      waitingGroups.push(takeGroupId)
      const {error}=await client.from('director_take_selections').upsert({
        id:'take-selection:'+takeGroupId,
        project_id:projectId,
        owner_user_id:userId,
        take_group_id:takeGroupId,
        policy_id:policy.id,
        selected_take_id:null,
        selected_asset_id:null,
        alternate_take_ids:[],
        ranked:result.ranked,
        status:'blocked',
        evidence_ids:unique(result.ranked.flatMap(item=>item.evidenceIds)),
        updated_at:new Date().toISOString(),
      },{onConflict:'project_id,take_group_id'})
      if(error)throw new Error('SIDE_HUSTLE_DIRECTOR_TAKE_SELECTION_WRITE_FAILED:'+error.message)
      continue
    }
    const winner=result.ranked.find(item=>item.takeId===result.selectedTakeId)!
    const {error}=await client.from('director_take_selections').upsert({
      id:'take-selection:'+takeGroupId,
      project_id:projectId,
      owner_user_id:userId,
      take_group_id:takeGroupId,
      policy_id:policy.id,
      selected_take_id:winner.takeId,
      selected_asset_id:winner.assetId,
      alternate_take_ids:[...result.alternates],
      ranked:result.ranked,
      status:'selected',
      evidence_ids:unique(result.ranked.flatMap(item=>item.evidenceIds)),
      updated_at:new Date().toISOString(),
    },{onConflict:'project_id,take_group_id'})
    if(error)throw new Error('SIDE_HUSTLE_DIRECTOR_TAKE_SELECTION_WRITE_FAILED:'+error.message)
    selectedGroups.push(Object.freeze({
      takeGroupId,
      selectedTakeId:winner.takeId,
      selectedAssetId:winner.assetId,
      alternateTakeIds:Object.freeze([...result.alternates]),
      score:winner.score,
    }))
  }

  const unresolvedGeneration=latestTasks.some(task=>task.status==='queued'||task.status==='running')
  const status=unresolvedGeneration?'waiting_generation':waitingGroups.length?'waiting_qc':'selected'
  return Object.freeze({
    projectId,refreshed,qcSubmitted,qcBlocked,
    waitingGroups:Object.freeze(waitingGroups),
    selectedGroups:Object.freeze(selectedGroups),
    status,
    nextBoundary:status==='selected'?'DIRECTOR_AUTO_ASSEMBLY':'DIRECTOR_TAKE_QC',
    publicationAuthority:'NONE',paidMediaAuthority:'NONE',
  })
}
