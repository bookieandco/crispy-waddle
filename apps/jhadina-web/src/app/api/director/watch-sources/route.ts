import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'

type Purpose='creative'|'sports'
type SourceKind='hls'|'dash'|'authorized-stream'|'homebase-capture'|'local-file'|'rtsp'|'capture'
type ExecutionTarget='cloud'|'homebase'
const SOURCE_KINDS=new Set<SourceKind>(['hls','dash','authorized-stream','homebase-capture','local-file','rtsp','capture'])

function assertCloudSource(value:string):void{
  let parsed:URL
  try{parsed=new URL(value)}catch{throw new Error('DIRECTOR_WATCH_SOURCE_URL_INVALID')}
  if(parsed.protocol!=='https:')throw new Error('DIRECTOR_WATCH_SOURCE_HTTPS_REQUIRED')
  if(parsed.username||parsed.password)throw new Error('DIRECTOR_WATCH_SOURCE_CREDENTIALS_FORBIDDEN')
  const host=parsed.hostname.toLowerCase()
  if(
    host==='localhost'||host.endsWith('.local')||host==='169.254.169.254'||
    /^127\./.test(host)||/^10\./.test(host)||/^192\.168\./.test(host)||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)||host==='::1'
  )throw new Error('DIRECTOR_WATCH_SOURCE_PRIVATE_NETWORK_FORBIDDEN')
}

export async function GET(){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_STORE_NOT_CONFIGURED'},{status:503})
    const {data,error}=await client.from('director_watch_sources')
      .select('id,purpose,label,media_type,media_id,event_id,subject_id,source_kind,source_locator,execution_target,enabled,rights_verified,source_authorized,cadence_minutes,sample_every_seconds,max_frames,priority,next_due_at,last_dispatched_at,last_completed_at,last_job_id,last_error,metadata,created_at,updated_at')
      .eq('owner_user_id',user.id)
      .order('priority',{ascending:false})
      .order('updated_at',{ascending:false})
    if(error)throw new Error('DIRECTOR_WATCH_SOURCE_READ_FAILED:'+error.message)
    return NextResponse.json({ok:true,sources:data??[]})
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'DIRECTOR_WATCH_SOURCE_READ_FAILED'},{status:500})
  }
}

export async function POST(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const body=await request.json() as {
      id?:string
      purpose?:Purpose
      label?:string
      mediaType?:string
      mediaId?:string
      eventId?:string
      subjectId?:string
      sourceKind?:SourceKind
      sourceLocator?:string
      executionTarget?:ExecutionTarget
      enabled?:boolean
      rightsVerified?:boolean
      sourceAuthorized?:boolean
      cadenceMinutes?:number
      sampleEverySeconds?:number
      maxFrames?:number
      priority?:number
      metadata?:Record<string,unknown>
    }
    if(body.purpose!=='creative'&&body.purpose!=='sports')return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_PURPOSE_INVALID'},{status:400})
    if(!body.sourceKind||!SOURCE_KINDS.has(body.sourceKind))return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_SOURCE_KIND_INVALID'},{status:400})
    if(body.rightsVerified!==true||body.sourceAuthorized!==true)return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_SOURCE_AUTHORIZATION_REQUIRED'},{status:400})
    const label=body.label?.trim()??''
    const sourceLocator=body.sourceLocator?.trim()??''
    if(!label||!sourceLocator)return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_LABEL_SOURCE_REQUIRED'},{status:400})

    const executionTarget:ExecutionTarget=body.executionTarget??(
      ['homebase-capture','local-file','rtsp','capture'].includes(body.sourceKind)?'homebase':'cloud'
    )
    if(executionTarget==='cloud'&&!['hls','dash','authorized-stream'].includes(body.sourceKind)){
      return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_CLOUD_SOURCE_KIND_INVALID'},{status:400})
    }
    if(executionTarget==='cloud')assertCloudSource(sourceLocator)
    if(body.purpose==='creative'&&!body.mediaId?.trim())return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_MEDIA_ID_REQUIRED'},{status:400})
    if(body.purpose==='sports'&&(!body.eventId?.trim()||!body.subjectId?.trim())){
      return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_SPORTS_EVENT_SUBJECT_REQUIRED'},{status:400})
    }

    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_STORE_NOT_CONFIGURED'},{status:503})
    const id=body.id?.trim()||'watch-source:'+crypto.randomUUID()
    const now=new Date().toISOString()
    const {data,error}=await client.from('director_watch_sources').upsert({
      id,
      owner_user_id:user.id,
      purpose:body.purpose,
      label,
      media_type:body.mediaType?.trim()||null,
      media_id:body.purpose==='creative'?body.mediaId?.trim()||null:null,
      event_id:body.purpose==='sports'?body.eventId?.trim()||null:null,
      subject_id:body.purpose==='sports'?body.subjectId?.trim()||null:null,
      source_kind:body.sourceKind,
      source_locator:sourceLocator,
      execution_target:executionTarget,
      enabled:body.enabled!==false,
      rights_verified:true,
      source_authorized:true,
      cadence_minutes:Math.max(15,Math.min(10080,Math.round(body.cadenceMinutes??180))),
      sample_every_seconds:Math.max(1,Math.min(120,Number(body.sampleEverySeconds??(body.purpose==='sports'?2:8)))),
      max_frames:Math.max(1,Math.min(600,Math.round(body.maxFrames??(body.purpose==='sports'?180:120)))),
      priority:Math.max(0,Math.min(100,Math.round(body.priority??10))),
      next_due_at:now,
      metadata:body.metadata??{},
      updated_at:now,
    },{onConflict:'id'}).select('*').single()
    if(error)throw new Error('DIRECTOR_WATCH_SOURCE_WRITE_FAILED:'+error.message)
    return NextResponse.json({
      ok:true,
      source:data,
      authority:'BACKGROUND_OBSERVATION_ONLY',
      cloudReady:executionTarget==='cloud',
      homebasePending:executionTarget==='homebase',
      canPublish:false,
      canWager:false,
      canSpend:false,
    },{status:201})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_WATCH_SOURCE_WRITE_FAILED'
    return NextResponse.json({ok:false,error:message},{status:/REQUIRED|INVALID|AUTHORIZATION|SOURCE_|HTTPS_|CREDENTIALS_|PRIVATE_NETWORK_/.test(message)?400:500})
  }
}

export async function PATCH(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const body=await request.json() as {id?:string;enabled?:boolean;cadenceMinutes?:number;priority?:number}
    const id=body.id?.trim()??''
    if(!id)return NextResponse.json({ok:false,error:'id is required'},{status:400})
    const patch:Record<string,unknown>={updated_at:new Date().toISOString()}
    if(typeof body.enabled==='boolean')patch.enabled=body.enabled
    if(typeof body.cadenceMinutes==='number')patch.cadence_minutes=Math.max(15,Math.min(10080,Math.round(body.cadenceMinutes)))
    if(typeof body.priority==='number')patch.priority=Math.max(0,Math.min(100,Math.round(body.priority)))
    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_STORE_NOT_CONFIGURED'},{status:503})
    const {data,error}=await client.from('director_watch_sources').update(patch)
      .eq('id',id).eq('owner_user_id',user.id).select('*').maybeSingle()
    if(error)throw new Error('DIRECTOR_WATCH_SOURCE_UPDATE_FAILED:'+error.message)
    if(!data)return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_SOURCE_NOT_FOUND'},{status:404})
    return NextResponse.json({ok:true,source:data})
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'DIRECTOR_WATCH_SOURCE_UPDATE_FAILED'},{status:500})
  }
}
