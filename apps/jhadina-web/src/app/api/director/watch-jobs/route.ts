import {createHmac} from 'node:crypto'
import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'

type Purpose='creative'|'sports'
type SourceKind='local-file'|'hls'|'dash'|'rtsp'|'capture'|'authorized-stream'

const SOURCE_KINDS=new Set<SourceKind>(['local-file','hls','dash','rtsp','capture','authorized-stream'])

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

function assertCloudWatchSource(source:string,kind:SourceKind):void{
  if(kind==='local-file'||kind==='capture'||kind==='rtsp')throw new Error('DIRECTOR_WATCH_SOURCE_REQUIRES_HOMEBASE_WORKER')
  let parsed:URL
  try{parsed=new URL(source)}catch{throw new Error('DIRECTOR_WATCH_SOURCE_URL_INVALID')}
  if(parsed.protocol!=='https:')throw new Error('DIRECTOR_WATCH_SOURCE_HTTPS_REQUIRED')
  if(parsed.username||parsed.password)throw new Error('DIRECTOR_WATCH_SOURCE_CREDENTIALS_FORBIDDEN')
  const host=parsed.hostname.toLowerCase()
  if(
    host==='localhost'||host.endsWith('.local')||host==='169.254.169.254'||
    /^127\./.test(host)||/^10\./.test(host)||/^192\.168\./.test(host)||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)||host==='::1'
  )throw new Error('DIRECTOR_WATCH_SOURCE_PRIVATE_NETWORK_FORBIDDEN')
}

export async function GET(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const purpose=new URL(request.url).searchParams.get('purpose') as Purpose|null
    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_STORE_NOT_CONFIGURED'},{status:503})
    let query=client.from('director_watch_jobs')
      .select('id,purpose,media_id,event_id,subject_id,source_kind,status,provider_id,result_count,error,created_at,updated_at,completed_at')
      .eq('owner_user_id',user.id)
      .order('updated_at',{ascending:false})
      .limit(100)
    if(purpose)query=query.eq('purpose',purpose)
    const {data,error}=await query
    if(error)throw new Error('DIRECTOR_WATCH_JOB_READ_FAILED:'+error.message)
    return NextResponse.json({ok:true,jobs:data??[]})
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'DIRECTOR_WATCH_JOB_READ_FAILED'},{status:500})
  }
}

export async function POST(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const body=await request.json() as {
      purpose?:Purpose
      mediaId?:string
      eventId?:string
      subjectId?:string
      sourceKind?:SourceKind
      sourceLocator?:string
      rightsVerified?:boolean
      sourceAuthorized?:boolean
      sampleEverySeconds?:number
      maxFrames?:number
    }
    if(body.purpose!=='creative'&&body.purpose!=='sports')return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_PURPOSE_INVALID'},{status:400})
    if(!body.sourceKind||!SOURCE_KINDS.has(body.sourceKind))return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_SOURCE_KIND_INVALID'},{status:400})
    if(body.rightsVerified!==true||body.sourceAuthorized!==true)return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_SOURCE_AUTHORIZATION_REQUIRED'},{status:400})

    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_STORE_NOT_CONFIGURED'},{status:503})

    let sourceLocator=body.sourceLocator?.trim()??''
    let mediaId=body.mediaId?.trim()??''
    let eventId=body.eventId?.trim()??''
    let subjectId=body.subjectId?.trim()??''

    if(body.purpose==='creative'){
      if(!mediaId)return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_MEDIA_ID_REQUIRED'},{status:400})
      const {data:media,error:mediaError}=await client.from('jhadina_entertainment_media')
        .select('id,source_uri,provenance').eq('id',mediaId).eq('owner_user_id',user.id).maybeSingle()
      if(mediaError)throw new Error('DIRECTOR_WATCH_MEDIA_READ_FAILED:'+mediaError.message)
      if(!media)return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_MEDIA_NOT_FOUND'},{status:404})
      if((media.provenance as {authorized?:boolean}|null)?.authorized!==true){
        return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_MEDIA_NOT_AUTHORIZED'},{status:400})
      }
      sourceLocator=String(media.source_uri)
      eventId=''
      subjectId=''
    }else{
      if(!eventId||!subjectId||!sourceLocator){
        return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_SPORTS_EVENT_SUBJECT_SOURCE_REQUIRED'},{status:400})
      }
      mediaId=''
    }

    assertCloudWatchSource(sourceLocator,body.sourceKind)

    const sampleEverySeconds=typeof body.sampleEverySeconds==='number'&&Number.isFinite(body.sampleEverySeconds)
      ? Math.max(1,Math.min(120,body.sampleEverySeconds))
      : body.purpose==='sports'?2:8
    const maxFrames=typeof body.maxFrames==='number'&&Number.isInteger(body.maxFrames)
      ? Math.max(1,Math.min(600,body.maxFrames))
      : body.purpose==='sports'?180:120

    const id='watch:'+crypto.randomUUID()
    const config=workerConfig()
    const now=new Date().toISOString()
    const requestPayload={
      jobId:id,
      purpose:body.purpose,
      ...(mediaId?{mediaId}:{}),
      ...(eventId?{eventId}:{}),
      ...(subjectId?{subjectId}:{}),
      sourceKind:body.sourceKind,
      sourceLocator,
      sampleEverySeconds,
      maxFrames,
      rightsVerified:true,
      sourceAuthorized:true,
      callbackUrl:config?.callbackUrl,
    }
    const initialStatus=config?'queued':'blocked'
    const {error:insertError}=await client.from('director_watch_jobs').insert({
      id,
      owner_user_id:user.id,
      purpose:body.purpose,
      media_id:mediaId||null,
      event_id:eventId||null,
      subject_id:subjectId||null,
      source_kind:body.sourceKind,
      source_locator:sourceLocator,
      status:initialStatus,
      provider_id:config?'runpod-watch-worker':null,
      request:requestPayload,
      error:config?null:'DIRECTOR_WATCH_WORKER_NOT_CONFIGURED',
      created_at:now,
      updated_at:now,
    })
    if(insertError)throw new Error('DIRECTOR_WATCH_JOB_WRITE_FAILED:'+insertError.message)

    if(!config){
      return NextResponse.json({
        ok:true,
        job:{id,status:'blocked',error:'DIRECTOR_WATCH_WORKER_NOT_CONFIGURED'},
        nextBoundary:'CONFIGURE_JHADINA_DIRECTOR_WATCH_WORKER_URL',
      },{status:202})
    }

    const response=await fetch(config.url,{
      method:'POST',
      headers:{'content-type':'application/json',authorization:`Bearer ${config.token}`},
      body:JSON.stringify({
        input:{
          ...requestPayload,
          callbackToken:callbackToken(config.callbackSecret,id),
        },
      }),
    })
    if(!response.ok){
      const detail=(await response.text().catch(()=>'' )).slice(0,240)
      await client.from('director_watch_jobs').update({
        status:'blocked',
        error:'DIRECTOR_WATCH_WORKER_DISPATCH_FAILED:'+response.status,
        updated_at:new Date().toISOString(),
      }).eq('id',id)
      return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_WORKER_DISPATCH_FAILED',detail,jobId:id},{status:502})
    }

    await client.from('director_watch_jobs').update({
      status:'submitted',
      updated_at:new Date().toISOString(),
    }).eq('id',id)

    return NextResponse.json({
      ok:true,
      job:{id,status:'submitted',purpose:body.purpose},
      authority:body.purpose==='sports'?'DIRECTOR_INFERENCE_ONLY':'OBSERVATION_ONLY',
      canExecute:false,
    },{status:202})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_WATCH_JOB_FAILED'
    const status=/NOT_FOUND/.test(message)?404:/INVALID|REQUIRED|NOT_AUTHORIZED/.test(message)?400:500
    return NextResponse.json({ok:false,error:message},{status})
  }
}
