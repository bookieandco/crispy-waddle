import {createHmac} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'

type SourceRow={
  id:string
  owner_user_id:string
  purpose:'creative'|'sports'
  label:string
  media_id:string|null
  event_id:string|null
  subject_id:string|null
  source_kind:'hls'|'dash'|'authorized-stream'|'homebase-capture'|'local-file'|'rtsp'|'capture'
  source_locator:string
  execution_target:'cloud'|'homebase'
  cadence_minutes:number
  sample_every_seconds:number
  max_frames:number
  priority:number
  next_due_at:string
}

export type DirectorIdleWatchReceipt=Readonly<{
  observedAt:string
  idle:boolean
  dispatched:number
  sourceId?:string
  watchJobId?:string
  reasons:readonly string[]
  authority:'BACKGROUND_OBSERVATION_ONLY'
  canPublish:false
  canWager:false
  canSpend:false
}>

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

function addMinutes(iso:string,minutes:number):string{
  return new Date(Date.parse(iso)+minutes*60_000).toISOString()
}

export async function runDirectorIdleWatchWorker(
  client:SupabaseClient,
  options:{now?:string}={},
):Promise<DirectorIdleWatchReceipt>{
  const observedAt=options.now??new Date().toISOString()
  const reasons:string[]=[]

  const [{data:videoJobs,error:videoError},{data:watchJobs,error:watchError}]=await Promise.all([
    client.from('director_video_jobs').select('id').in('status',['submitted','generating','ingesting']).limit(1),
    client.from('director_watch_jobs').select('id').in('status',['submitted','running']).limit(1),
  ])
  if(videoError)throw new Error('DIRECTOR_IDLE_WATCH_VIDEO_ACTIVITY_READ_FAILED:'+videoError.message)
  if(watchError)throw new Error('DIRECTOR_IDLE_WATCH_ACTIVITY_READ_FAILED:'+watchError.message)
  if((videoJobs??[]).length)reasons.push('DIRECTOR_RENDER_ACTIVE')
  if((watchJobs??[]).length)reasons.push('DIRECTOR_WATCH_ACTIVE')

  const recentCutoff=new Date(Date.parse(observedAt)-20*60_000).toISOString()
  const {data:compute,error:computeError}=await client.from('jhadina_compute_executions')
    .select('submission_id,queue_name,submitted_at')
    .is('result_status',null)
    .gte('submitted_at',recentCutoff)
    .limit(1)
  if(computeError)throw new Error('DIRECTOR_IDLE_WATCH_COMPUTE_READ_FAILED:'+computeError.message)
  if((compute??[]).length)reasons.push('JHADINA_COMPUTE_BUSY')

  if(reasons.length){
    return Object.freeze({
      observedAt,idle:false,dispatched:0,reasons:Object.freeze(reasons),
      authority:'BACKGROUND_OBSERVATION_ONLY',canPublish:false,canWager:false,canSpend:false,
    })
  }

  const {data,error}=await client.from('director_watch_sources')
    .select('id,owner_user_id,purpose,label,media_id,event_id,subject_id,source_kind,source_locator,execution_target,cadence_minutes,sample_every_seconds,max_frames,priority,next_due_at')
    .eq('enabled',true)
    .eq('rights_verified',true)
    .eq('source_authorized',true)
    .lte('next_due_at',observedAt)
    .order('priority',{ascending:false})
    .order('next_due_at',{ascending:true})
    .limit(10)
  if(error)throw new Error('DIRECTOR_IDLE_WATCH_SOURCE_READ_FAILED:'+error.message)

  const source=(data??[]).map(row=>row as SourceRow).find(row=>
    row.execution_target==='cloud'&&['hls','dash','authorized-stream'].includes(row.source_kind)
  )
  if(!source){
    return Object.freeze({
      observedAt,idle:true,dispatched:0,reasons:Object.freeze(['NO_DUE_CLOUD_WATCH_SOURCE']),
      authority:'BACKGROUND_OBSERVATION_ONLY',canPublish:false,canWager:false,canSpend:false,
    })
  }

  const config=workerConfig()
  if(!config){
    await client.from('director_watch_sources').update({
      last_error:'DIRECTOR_WATCH_WORKER_NOT_CONFIGURED',updated_at:observedAt,
    }).eq('id',source.id)
    return Object.freeze({
      observedAt,idle:true,dispatched:0,sourceId:source.id,
      reasons:Object.freeze(['DIRECTOR_WATCH_WORKER_NOT_CONFIGURED']),
      authority:'BACKGROUND_OBSERVATION_ONLY',canPublish:false,canWager:false,canSpend:false,
    })
  }

  const jobId='watch:bg:'+crypto.randomUUID()
  const requestPayload={
    jobId,
    purpose:source.purpose,
    ...(source.media_id?{mediaId:source.media_id}:{}),
    ...(source.event_id?{eventId:source.event_id}:{}),
    ...(source.subject_id?{subjectId:source.subject_id}:{}),
    sourceKind:source.source_kind,
    sourceLocator:source.source_locator,
    sampleEverySeconds:Number(source.sample_every_seconds),
    maxFrames:Number(source.max_frames),
    rightsVerified:true,
    sourceAuthorized:true,
    callbackUrl:config.callbackUrl,
    background:true,
    sourceSubscriptionId:source.id,
  }

  const {error:insertError}=await client.from('director_watch_jobs').insert({
    id:jobId,
    owner_user_id:source.owner_user_id,
    purpose:source.purpose,
    media_id:source.media_id,
    event_id:source.event_id,
    subject_id:source.subject_id,
    source_kind:source.source_kind,
    source_locator:source.source_locator,
    source_subscription_id:source.id,
    low_priority_background:true,
    status:'queued',
    provider_id:'runpod-watch-worker',
    request:requestPayload,
    created_at:observedAt,
    updated_at:observedAt,
  })
  if(insertError)throw new Error('DIRECTOR_IDLE_WATCH_JOB_WRITE_FAILED:'+insertError.message)

  const response=await fetch(config.url,{
    method:'POST',
    headers:{'content-type':'application/json',authorization:`Bearer ${config.token}`},
    body:JSON.stringify({input:{...requestPayload,callbackToken:callbackToken(config.callbackSecret,jobId)}}),
  })
  if(!response.ok){
    const code='DIRECTOR_WATCH_WORKER_DISPATCH_FAILED:'+response.status
    await Promise.all([
      client.from('director_watch_jobs').update({status:'blocked',error:code,updated_at:observedAt}).eq('id',jobId),
      client.from('director_watch_sources').update({last_error:code,updated_at:observedAt}).eq('id',source.id),
    ])
    return Object.freeze({
      observedAt,idle:true,dispatched:0,sourceId:source.id,watchJobId:jobId,
      reasons:Object.freeze([code]),
      authority:'BACKGROUND_OBSERVATION_ONLY',canPublish:false,canWager:false,canSpend:false,
    })
  }

  const nextDueAt=addMinutes(observedAt,Number(source.cadence_minutes))
  await Promise.all([
    client.from('director_watch_jobs').update({status:'submitted',updated_at:observedAt}).eq('id',jobId),
    client.from('director_watch_sources').update({
      last_dispatched_at:observedAt,last_job_id:jobId,last_error:null,next_due_at:nextDueAt,updated_at:observedAt,
    }).eq('id',source.id),
  ])

  return Object.freeze({
    observedAt,idle:true,dispatched:1,sourceId:source.id,watchJobId:jobId,reasons:Object.freeze([]),
    authority:'BACKGROUND_OBSERVATION_ONLY',canPublish:false,canWager:false,canSpend:false,
  })
}
