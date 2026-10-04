import type {SupabaseClient} from '@supabase/supabase-js'
import {
  annotationImportToVisualEvidence,
  type MediaTimebase,
  type ProtectedVisualRegionKind,
  type VisualAnnotationProviderLabel,
  type VisualAnnotationScope,
} from '@jhadina/director-core'
import {createConfiguredCvatVisualAnnotationProvider} from './director-cvat-annotation-provider'

type AnnotationTaskRow={
  id:string
  owner_user_id:string
  scope:VisualAnnotationScope
  project_id:string|null
  event_id:string|null
  asset_id:string|null
  title:string
  source_uri:string
  provider:string
  provider_task_id:string|null
  provider_request_id:string|null
  provider_web_url:string|null
  provider_status:string
  label_schema:VisualAnnotationProviderLabel[]|null
  timebase:MediaTimebase
  rights_verified:boolean
  source_authorized:boolean
  evidence_refs:string[]|null
  provider_state:Record<string,unknown>|null
  error:string|null
  created_at:string
  updated_at:string
  completed_at:string|null
}

const DEFAULT_LABELS:readonly VisualAnnotationProviderLabel[]=Object.freeze([
  Object.freeze({name:'face',protectedRegionKind:'face'}),
  Object.freeze({name:'person',protectedRegionKind:'person'}),
  Object.freeze({name:'product',protectedRegionKind:'product'}),
  Object.freeze({name:'logo',protectedRegionKind:'logo'}),
  Object.freeze({name:'subtitle',protectedRegionKind:'subtitle'}),
  Object.freeze({name:'text',protectedRegionKind:'text'}),
  Object.freeze({name:'ui',protectedRegionKind:'ui'}),
  Object.freeze({name:'critical-object',protectedRegionKind:'critical-object'}),
])

const SPORTS_LABELS:readonly VisualAnnotationProviderLabel[]=Object.freeze([
  Object.freeze({name:'player'}),
  Object.freeze({name:'ball'}),
  Object.freeze({name:'referee'}),
  Object.freeze({name:'goal-rim-net'}),
  Object.freeze({name:'field-court-ring'}),
  Object.freeze({name:'scoreboard',protectedRegionKind:'ui'}),
  Object.freeze({name:'formation'}),
  Object.freeze({name:'matchup'}),
  Object.freeze({name:'substitution'}),
  Object.freeze({name:'tactical-adjustment'}),
])

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>String(value).trim()).filter(Boolean))]
}
function validTimebase(value:MediaTimebase):MediaTimebase{
  if(
    !Number.isFinite(value.fps)||value.fps<=0||
    !Number.isFinite(value.durationSeconds)||value.durationSeconds<=0||
    !Number.isFinite(value.width)||value.width<=0||
    !Number.isFinite(value.height)||value.height<=0
  )throw new Error('DIRECTOR_CVAT_TIMEBASE_INVALID')
  return Object.freeze({...value})
}
function labelKinds(labels:readonly VisualAnnotationProviderLabel[]):Record<string,ProtectedVisualRegionKind|undefined>{
  return Object.fromEntries(labels.map(label=>[label.name.toLowerCase(),label.protectedRegionKind]))
}

async function resolveHttpsSource(client:SupabaseClient,uri:string):Promise<string>{
  if(uri.startsWith('https://'))return uri
  const prefix='storage://director-media/'
  if(!uri.startsWith(prefix))throw new Error('DIRECTOR_CVAT_HTTPS_OR_DIRECTOR_STORAGE_SOURCE_REQUIRED')
  const objectPath=uri.slice(prefix.length)
  const {data,error}=await client.storage.from('director-media').createSignedUrl(objectPath,4*60*60)
  if(error||!data?.signedUrl)throw new Error('DIRECTOR_CVAT_SOURCE_SIGN_FAILED:'+(error?.message??'missing'))
  return data.signedUrl
}

async function persistProviderTask(
  client:SupabaseClient,
  row:AnnotationTaskRow,
  providerTask:{
    providerTaskId:string
    providerRequestId?:string
    webUrl?:string
    status:string
    evidenceRefs:readonly string[]
  },
):Promise<void>{
  const now=new Date().toISOString()
  const {error}=await client.from('director_visual_annotation_tasks').update({
    provider_task_id:providerTask.providerTaskId,
    provider_request_id:providerTask.providerRequestId??null,
    provider_web_url:providerTask.webUrl??null,
    provider_status:providerTask.status,
    evidence_refs:unique([...(row.evidence_refs??[]),...providerTask.evidenceRefs]),
    provider_state:{
      providerTaskId:providerTask.providerTaskId,
      providerRequestId:providerTask.providerRequestId??null,
      status:providerTask.status,
    },
    error:null,
    updated_at:now,
    ...(providerTask.status==='completed'?{completed_at:now}:{}),
  }).eq('id',row.id).eq('owner_user_id',row.owner_user_id)
  if(error)throw new Error('DIRECTOR_CVAT_TASK_UPDATE_FAILED:'+error.message)
}

export async function createDirectorCvatAnnotationTask(input:{
  client:SupabaseClient
  userId:string
  scope:VisualAnnotationScope
  title:string
  sourceUri:string
  projectId?:string
  eventId?:string
  assetId?:string
  timebase:MediaTimebase
  labels?:readonly VisualAnnotationProviderLabel[]
  evidenceRefs?:readonly string[]
  rightsVerified:true
  sourceAuthorized:true
}){
  const provider=createConfiguredCvatVisualAnnotationProvider()
  if(!provider)throw new Error('DIRECTOR_CVAT_NOT_CONFIGURED')
  if(input.rightsVerified!==true||input.sourceAuthorized!==true){
    throw new Error('DIRECTOR_CVAT_SOURCE_AUTHORIZATION_REQUIRED')
  }
  if(input.scope==='director'&&(!input.projectId?.trim()||!input.assetId?.trim())){
    throw new Error('DIRECTOR_CVAT_DIRECTOR_BINDING_REQUIRED')
  }
  if(input.scope==='sports'&&!input.eventId?.trim()){
    throw new Error('DIRECTOR_CVAT_SPORTS_EVENT_REQUIRED')
  }
  const taskId='annotation:cvat:'+crypto.randomUUID()
  const timebase=validTimebase(input.timebase)
  const labels=[...(input.labels?.length?input.labels:input.scope==='sports'?SPORTS_LABELS:DEFAULT_LABELS)]
  const sourceUri=await resolveHttpsSource(input.client,input.sourceUri)
  const now=new Date().toISOString()
  const row:AnnotationTaskRow={
    id:taskId,
    owner_user_id:input.userId,
    scope:input.scope,
    project_id:input.projectId?.trim()||null,
    event_id:input.eventId?.trim()||null,
    asset_id:input.assetId?.trim()||null,
    title:input.title.trim(),
    source_uri:input.sourceUri,
    provider:'cvat',
    provider_task_id:null,
    provider_request_id:null,
    provider_web_url:null,
    provider_status:'planned',
    label_schema:labels,
    timebase,
    rights_verified:true,
    source_authorized:true,
    evidence_refs:unique(input.evidenceRefs??[]),
    provider_state:{},
    error:null,
    created_at:now,
    updated_at:now,
    completed_at:null,
  }
  const {error:insertError}=await input.client.from('director_visual_annotation_tasks').insert(row)
  if(insertError)throw new Error('DIRECTOR_CVAT_TASK_WRITE_FAILED:'+insertError.message)

  try{
    const providerTask=await provider.createTask({
      taskId,
      scope:input.scope,
      ...(row.project_id?{projectId:row.project_id}:{}),
      ...(row.event_id?{eventId:row.event_id}:{}),
      ...(row.asset_id?{assetId:row.asset_id}:{}),
      sourceUri,
      title:row.title,
      timebase,
      labels,
      rightsVerified:true,
      sourceAuthorized:true,
      evidenceRefs:Object.freeze(row.evidence_refs??[]),
    })
    await persistProviderTask(input.client,row,providerTask)
    return Object.freeze({
      taskId,
      providerTaskId:providerTask.providerTaskId,
      providerRequestId:providerTask.providerRequestId??null,
      webUrl:providerTask.webUrl??null,
      status:providerTask.status,
      authority:'ANNOTATION_PROVIDER_ONLY',
      canEdit:false,
      canPublish:false,
      canEstablishSportsReality:false,
    })
  }catch(error){
    const message=error instanceof Error?error.message:String(error)
    await input.client.from('director_visual_annotation_tasks').update({
      provider_status:'failed',error:message.slice(0,1000),updated_at:new Date().toISOString(),
    }).eq('id',taskId).eq('owner_user_id',input.userId)
    throw error
  }
}

export async function refreshDirectorCvatAnnotationTask(input:{
  client:SupabaseClient
  userId:string
  taskId:string
}){
  const {data,error}=await input.client.from('director_visual_annotation_tasks')
    .select('*').eq('id',input.taskId).eq('owner_user_id',input.userId).maybeSingle()
  if(error)throw new Error('DIRECTOR_CVAT_TASK_READ_FAILED:'+error.message)
  if(!data)throw new Error('DIRECTOR_CVAT_TASK_NOT_FOUND')
  const row=data as AnnotationTaskRow
  if(!row.provider_task_id)throw new Error('DIRECTOR_CVAT_PROVIDER_TASK_REQUIRED')
  const provider=createConfiguredCvatVisualAnnotationProvider()
  if(!provider)throw new Error('DIRECTOR_CVAT_NOT_CONFIGURED')
  const state=await provider.refreshTask(row.provider_task_id)
  await persistProviderTask(input.client,row,state)
  return state
}

export async function importDirectorCvatAnnotations(input:{
  client:SupabaseClient
  userId:string
  taskId:string
}){
  const {data,error}=await input.client.from('director_visual_annotation_tasks')
    .select('*').eq('id',input.taskId).eq('owner_user_id',input.userId).maybeSingle()
  if(error)throw new Error('DIRECTOR_CVAT_TASK_READ_FAILED:'+error.message)
  if(!data)throw new Error('DIRECTOR_CVAT_TASK_NOT_FOUND')
  const row=data as AnnotationTaskRow
  if(!row.provider_task_id)throw new Error('DIRECTOR_CVAT_PROVIDER_TASK_REQUIRED')
  const provider=createConfiguredCvatVisualAnnotationProvider()
  if(!provider)throw new Error('DIRECTOR_CVAT_NOT_CONFIGURED')
  const imported=await provider.importAnnotations(row.provider_task_id)
  const importId='annotation-import:cvat:'+row.id+':'+imported.sourceDigest
  const labels=row.label_schema??[]
  const evidenceRows:Record<string,unknown>[]=[]

  if(row.scope==='director'){
    if(!row.project_id||!row.asset_id)throw new Error('DIRECTOR_CVAT_DIRECTOR_BINDING_REQUIRED')
    const converted=annotationImportToVisualEvidence({
      projectId:row.project_id,
      assetId:row.asset_id,
      taskId:row.id,
      imported,
      timebase:validTimebase(row.timebase),
      labelKinds:labelKinds(labels),
    })
    for(const evidence of converted){
      evidenceRows.push({
        id:evidence.id,
        annotation_import_id:importId,
        annotation_task_id:row.id,
        owner_user_id:input.userId,
        project_id:row.project_id,
        event_id:null,
        asset_id:row.asset_id,
        provider:'cvat',
        annotation_kind:evidence.annotationKind,
        frame_start:evidence.frameStart,
        frame_end:evidence.frameEnd,
        confidence:evidence.confidence,
        evidence_refs:evidence.evidenceRefs,
        limitations:evidence.limitations,
        protected_regions:evidence.protectedRegions,
        raw_annotation_ids:[evidence.id.replace('visual-evidence:'+row.id+':','')],
        accepted:false,
      })
    }
  }else{
    for(const shape of imported.shapes){
      const evidenceId='visual-evidence:'+row.id+':'+shape.annotationId
      evidenceRows.push({
        id:evidenceId,
        annotation_import_id:importId,
        annotation_task_id:row.id,
        owner_user_id:input.userId,
        project_id:row.project_id,
        event_id:row.event_id,
        asset_id:row.asset_id,
        provider:'cvat',
        annotation_kind:shape.kind,
        frame_start:shape.frameStart,
        frame_end:shape.frameEnd,
        confidence:shape.confidence,
        evidence_refs:unique([
          ...imported.evidenceRefs,
          ...shape.evidenceRefs,
          'annotation-task:'+row.id,
          'annotation-import-digest:'+imported.sourceDigest,
        ]),
        limitations:[
          row.scope==='sports'
            ?'Human-reviewed sports annotation candidate is context/training evidence only and cannot establish official score, clock, possession, result, or wager authority.'
            :'Human-reviewed Watch annotation candidate requires explicit acceptance before learning use.',
        ],
        protected_regions:[],
        raw_annotation_ids:[shape.annotationId],
        accepted:false,
      })
    }
  }

  const {error:importError}=await input.client.from('director_visual_annotation_imports').upsert({
    id:importId,
    annotation_task_id:row.id,
    owner_user_id:input.userId,
    provider:'cvat',
    provider_task_id:row.provider_task_id,
    source_digest:imported.sourceDigest,
    imported_at:imported.importedAt,
    shape_count:imported.shapes.length,
    candidate_evidence_ids:evidenceRows.map(item=>String(item.id)),
    raw_summary:{
      shapeCount:imported.shapes.length,
      labels:unique(imported.shapes.map(shape=>shape.label)),
      annotationKinds:unique(imported.shapes.map(shape=>shape.kind)),
      scope:row.scope,
    },
    review_status:'pending',
  },{onConflict:'annotation_task_id,source_digest'})
  if(importError)throw new Error('DIRECTOR_CVAT_IMPORT_WRITE_FAILED:'+importError.message)

  if(evidenceRows.length){
    const {error:evidenceError}=await input.client.from('director_visual_annotation_evidence')
      .upsert(evidenceRows,{onConflict:'id'})
    if(evidenceError)throw new Error('DIRECTOR_CVAT_EVIDENCE_WRITE_FAILED:'+evidenceError.message)
  }

  await input.client.from('director_visual_annotation_tasks').update({
    provider_status:'review-ready',
    provider_state:{
      ...(row.provider_state??{}),
      latestImportId:importId,
      latestImportDigest:imported.sourceDigest,
      latestShapeCount:imported.shapes.length,
    },
    updated_at:new Date().toISOString(),
  }).eq('id',row.id).eq('owner_user_id',input.userId)

  return Object.freeze({
    taskId:row.id,
    importId,
    providerTaskId:row.provider_task_id,
    shapeCount:imported.shapes.length,
    evidenceIds:Object.freeze(evidenceRows.map(item=>String(item.id))),
    reviewStatus:'pending' as const,
    authority:'GROUND_TRUTH_CANDIDATE_ONLY' as const,
    canEdit:false,
    canPublish:false,
    canEstablishSportsReality:false,
  })
}

export async function reviewDirectorCvatAnnotationImport(input:{
  client:SupabaseClient
  userId:string
  importId:string
  decision:'accepted'|'rejected'
  note?:string
}){
  const {data:row,error}=await input.client.from('director_visual_annotation_imports')
    .select('id,annotation_task_id,review_status,candidate_evidence_ids')
    .eq('id',input.importId).eq('owner_user_id',input.userId).maybeSingle()
  if(error)throw new Error('DIRECTOR_CVAT_IMPORT_READ_FAILED:'+error.message)
  if(!row)throw new Error('DIRECTOR_CVAT_IMPORT_NOT_FOUND')
  const now=new Date().toISOString()
  const {error:updateError}=await input.client.from('director_visual_annotation_imports').update({
    review_status:input.decision,
    reviewed_at:now,
    reviewed_by_user_id:input.userId,
    review_note:input.note?.trim()||null,
  }).eq('id',input.importId).eq('owner_user_id',input.userId)
  if(updateError)throw new Error('DIRECTOR_CVAT_IMPORT_REVIEW_WRITE_FAILED:'+updateError.message)

  const evidenceIds=Array.isArray(row.candidate_evidence_ids)?row.candidate_evidence_ids.map(String):[]
  if(evidenceIds.length){
    const {error:evidenceError}=await input.client.from('director_visual_annotation_evidence').update({
      accepted:input.decision==='accepted',
      accepted_at:input.decision==='accepted'?now:null,
      accepted_by_user_id:input.decision==='accepted'?input.userId:null,
    }).in('id',evidenceIds).eq('owner_user_id',input.userId)
    if(evidenceError)throw new Error('DIRECTOR_CVAT_EVIDENCE_REVIEW_WRITE_FAILED:'+evidenceError.message)
  }

  return Object.freeze({
    importId:input.importId,
    taskId:String(row.annotation_task_id),
    decision:input.decision,
    evidenceIds:Object.freeze(evidenceIds),
    authority:'HUMAN_GROUND_TRUTH_REVIEW_ONLY' as const,
    canEdit:false,
    canPublish:false,
    canEstablishSportsReality:false,
  })
}

export async function listDirectorCvatAnnotationTasks(input:{
  client:SupabaseClient
  userId:string
  projectId?:string
  eventId?:string
}){
  let query=input.client.from('director_visual_annotation_tasks')
    .select('id,scope,project_id,event_id,asset_id,title,provider,provider_task_id,provider_request_id,provider_web_url,provider_status,label_schema,timebase,evidence_refs,provider_state,error,created_at,updated_at,completed_at')
    .eq('owner_user_id',input.userId)
    .order('updated_at',{ascending:false})
    .limit(100)
  if(input.projectId)query=query.eq('project_id',input.projectId)
  if(input.eventId)query=query.eq('event_id',input.eventId)
  const {data,error}=await query
  if(error)throw new Error('DIRECTOR_CVAT_TASK_LIST_FAILED:'+error.message)

  const taskIds=(data??[]).map(row=>String(row.id))
  const imports=taskIds.length
    ?await input.client.from('director_visual_annotation_imports')
      .select('id,annotation_task_id,provider_task_id,source_digest,imported_at,shape_count,candidate_evidence_ids,raw_summary,review_status,reviewed_at,review_note')
      .eq('owner_user_id',input.userId).in('annotation_task_id',taskIds).order('imported_at',{ascending:false})
    :{data:[],error:null}
  if(imports.error)throw new Error('DIRECTOR_CVAT_IMPORT_LIST_FAILED:'+imports.error.message)
  const byTask=new Map<string,unknown[]>()
  for(const item of imports.data??[]){
    const id=String(item.annotation_task_id)
    const current=byTask.get(id)??[]
    current.push(item)
    byTask.set(id,current)
  }
  return (data??[]).map(row=>({...row,imports:byTask.get(String(row.id))??[]}))
}
