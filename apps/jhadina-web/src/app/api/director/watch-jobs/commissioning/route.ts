import {createHmac} from 'node:crypto'
import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {
  directorWatchHomebaseRuntimeHealth,
  directorWatchRuntimeHealth,
  resolveDirectorWatchRuntimeConfig,
} from '@/lib/director-watch-runtime'

type Purpose='creative'|'sports'|'take-qc'

function callbackToken(secret:string,jobId:string):string{
  return createHmac('sha256',secret).update(jobId).digest('base64url')
}
function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>value.trim()).filter(Boolean))]
}
function storageObjectPath(uri:string):string|undefined{
  const prefix='storage://director-media/'
  return uri.startsWith(prefix)?uri.slice(prefix.length):undefined
}

async function dispatch(
  client:ReturnType<typeof createServiceRoleClient> extends infer T?Exclude<T,null>:never,
  config:NonNullable<Awaited<ReturnType<typeof resolveDirectorWatchRuntimeConfig>>>,
  payload:Record<string,unknown>,
):Promise<void>{
  const jobId=String(payload.jobId)
  try{
    const response=await fetch(config.dispatchUrl,{
      method:'POST',
      headers:{'content-type':'application/json',authorization:'Bearer '+config.authorizationToken},
      body:JSON.stringify({
        input:{
          ...payload,
          callbackUrl:config.callbackUrl,
          callbackToken:callbackToken(config.callbackSecret,jobId),
        },
      }),
    })
    if(!response.ok){
      const detail=(await response.text().catch(()=>'' )).slice(0,240)
      throw new Error('DIRECTOR_WATCH_COMMISSION_DISPATCH_FAILED:'+response.status+':'+detail)
    }
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_WATCH_COMMISSION_DISPATCH_FAILED'
    const {error:updateError}=await client.from('director_watch_jobs').update({
      status:'blocked',
      error:message.slice(0,500),
      updated_at:new Date().toISOString(),
    }).eq('id',jobId)
    if(updateError)throw new Error('DIRECTOR_WATCH_COMMISSION_BLOCK_WRITE_FAILED:'+updateError.message)
    throw error
  }
}

async function latestRealTake(
  client:ReturnType<typeof createServiceRoleClient> extends infer T?Exclude<T,null>:never,
  userId:string,
):Promise<null|Readonly<{
  projectId:string
  generationTaskId:string
  takeGroupId:string
  takeId:string
  assetId:string
  sourceLocator:string
  prompt:string
}>>{
  const {data:contexts,error:contextError}=await client.from('director_project_business_context')
    .select('project_id')
    .eq('owner_user_id',userId)
    .order('updated_at',{ascending:false})
    .limit(25)
  if(contextError)throw new Error('DIRECTOR_WATCH_COMMISSION_CONTEXT_READ_FAILED:'+contextError.message)
  const projectIds=unique((contexts??[]).map(row=>String(row.project_id)))
  if(!projectIds.length)return null

  const {data:tasks,error:taskError}=await client.from('director_generation_tasks')
    .select('id,project_id,request,status,updated_at')
    .in('project_id',projectIds)
    .eq('status','completed')
    .order('updated_at',{ascending:false})
    .limit(50)
  if(taskError)throw new Error('DIRECTOR_WATCH_COMMISSION_TAKE_READ_FAILED:'+taskError.message)

  for(const task of tasks??[]){
    const request=task.request as {prompt?:unknown;parameters?:Record<string,unknown>}|null
    const parameters=request?.parameters??{}
    const takeGroupId=typeof parameters.takeGroupId==='string'?parameters.takeGroupId.trim():''
    const candidateIndex=typeof parameters.candidateIndex==='number'?parameters.candidateIndex:undefined
    if(!takeGroupId||!candidateIndex)continue
    const {data:asset,error:assetError}=await client.from('director_generated_editing_assets')
      .select('id,uri,media_type')
      .eq('project_id',String(task.project_id))
      .eq('generation_job_id',String(task.id))
      .eq('media_type','video')
      .order('created_at',{ascending:false})
      .limit(1)
      .maybeSingle()
    if(assetError)throw new Error('DIRECTOR_WATCH_COMMISSION_TAKE_ASSET_READ_FAILED:'+assetError.message)
    if(!asset)continue

    const uri=String(asset.uri)
    let sourceLocator=uri
    const objectPath=storageObjectPath(uri)
    if(objectPath){
      const {data:signed,error:signedError}=await client.storage.from('director-media').createSignedUrl(objectPath,3600)
      if(signedError||!signed?.signedUrl)throw new Error('DIRECTOR_WATCH_COMMISSION_TAKE_SIGN_FAILED:'+(signedError?.message??'missing'))
      sourceLocator=signed.signedUrl
    }
    if(!sourceLocator.startsWith('https://'))continue

    return Object.freeze({
      projectId:String(task.project_id),
      generationTaskId:String(task.id),
      takeGroupId,
      takeId:takeGroupId+':candidate:'+candidateIndex,
      assetId:String(asset.id),
      sourceLocator,
      prompt:typeof request?.prompt==='string'?request.prompt:'',
    })
  }
  return null
}

export async function GET(){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_STORE_NOT_CONFIGURED'},{status:503})

    const {data,error}=await client.from('director_watch_commissioning_receipts')
      .select('job_id,purpose,provider_id,source_kind,callback_verified,result_count,persisted_result_count,status,error,completed_at')
      .eq('owner_user_id',user.id)
      .order('completed_at',{ascending:false})
      .limit(50)
    if(error)throw new Error('DIRECTOR_WATCH_COMMISSION_READ_FAILED:'+error.message)

    const latestByPurpose=new Map<string,Record<string,unknown>>()
    const latestPassedByPurpose=new Map<string,Record<string,unknown>>()
    for(const row of data??[]){
      const purpose=String(row.purpose)
      if(!latestByPurpose.has(purpose))latestByPurpose.set(purpose,row as Record<string,unknown>)
      if(row.status==='passed'&&row.callback_verified===true&&Number(row.persisted_result_count??0)>0&&!latestPassedByPurpose.has(purpose)){
        latestPassedByPurpose.set(purpose,row as Record<string,unknown>)
      }
    }

    const runtime=await directorWatchRuntimeHealth()
    const purposes=['creative','sports','take-qc'] as const
    const purposeStatus=Object.fromEntries(purposes.map(purpose=>{
      const latest=latestByPurpose.get(purpose)
      const passed=latestPassedByPurpose.get(purpose)
      return [purpose,{
        commissioned:runtime.productionReady===true&&Boolean(passed),
        latestReceipt:latest??null,
        passedReceipt:passed??null,
      }]
    }))

    return NextResponse.json({
      ok:true,
      configured:runtime.configured,
      runtime,
      anyCommissioned:Object.values(purposeStatus).some(value=>value.commissioned),
      allCommissioned:Object.values(purposeStatus).every(value=>value.commissioned),
      purposeStatus,
      authority:'WATCH_COMMISSIONING_EVIDENCE_ONLY',
      canPublish:false,
      canWager:false,
      canSpend:false,
    })
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'DIRECTOR_WATCH_COMMISSION_READ_FAILED'},{status:500})
  }
}

export async function POST(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_STORE_NOT_CONFIGURED'},{status:503})

    const body=await request.json().catch(()=>({})) as {purposes?:Purpose[]}
    const purposes=(body.purposes?.length?body.purposes:['creative','sports','take-qc'])
      .filter((value):value is Purpose=>['creative','sports','take-qc'].includes(value))
    if(!purposes.length)return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_COMMISSION_PURPOSE_REQUIRED'},{status:400})

    const runtime=await directorWatchRuntimeHealth()
    if(!runtime.configured||!runtime.reachable||runtime.productionReady!==true){
      return NextResponse.json({
        ok:false,error:'DIRECTOR_WATCH_RUNTIME_NOT_PRODUCTION_READY',runtime,
      },{status:503})
    }
    const config=await resolveDirectorWatchRuntimeConfig()
    if(!config)return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_RUNTIME_NOT_CONFIGURED'},{status:503})

    const origin=new URL(request.url).origin
    if(!origin.startsWith('https://')){
      return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_COMMISSION_HTTPS_ORIGIN_REQUIRED'},{status:409})
    }
    const fixtureUrl=origin+'/api/internal/director/watch-fixture'
    const submitted:Array<{purpose:Purpose;jobId:string;source:string}>=[]
    const unavailable:Array<{purpose:Purpose;reason:string}>=[]

    if(purposes.includes('creative')){
      const mediaId='watch-commissioning:creative:'+user.id
      const now=new Date().toISOString()
      const {error:mediaError}=await client.from('jhadina_entertainment_media').upsert({
        id:mediaId,
        owner_user_id:user.id,
        media_type:'jhadina_work',
        title:'Director Watch commissioning fixture',
        creator:'Jhadina Director',
        source_uri:fixtureUrl,
        duration_ms:2000,
        provenance:{
          provider:'jhadina-first-party-fixture',
          sourceUri:fixtureUrl,
          authorized:true,
          observedAt:now,
          commissioning:true,
        },
      },{onConflict:'id'})
      if(mediaError)throw new Error('DIRECTOR_WATCH_COMMISSION_MEDIA_WRITE_FAILED:'+mediaError.message)

      const jobId='watch:commission:creative:'+crypto.randomUUID()
      const payload={
        jobId,purpose:'creative',mediaId,
        sourceKind:'authorized-stream',sourceLocator:fixtureUrl,
        sampleEverySeconds:1,maxFrames:4,rightsVerified:true,sourceAuthorized:true,
      }
      const {error}=await client.from('director_watch_jobs').insert({
        id:jobId,owner_user_id:user.id,purpose:'creative',media_id:mediaId,
        source_kind:'authorized-stream',source_locator:fixtureUrl,status:'queued',
        provider_id:'runpod-watch-worker',request:{...payload,callbackUrl:config.callbackUrl},
        created_at:now,updated_at:now,
      })
      if(error)throw new Error('DIRECTOR_WATCH_COMMISSION_JOB_WRITE_FAILED:'+error.message)
      await dispatch(client,config,payload)
      await client.from('director_watch_jobs').update({status:'submitted',updated_at:new Date().toISOString()}).eq('id',jobId)
      submitted.push({purpose:'creative',jobId,source:'first-party-fixture'})
    }

    if(purposes.includes('sports')){
      const jobId='watch:commission:sports:'+crypto.randomUUID()
      const now=new Date().toISOString()
      const eventId='watch-commissioning:event:'+user.id
      const subjectId='watch-commissioning:field'
      const payload={
        jobId,purpose:'sports',eventId,subjectId,
        sourceKind:'authorized-stream',sourceLocator:fixtureUrl,
        sampleEverySeconds:1,maxFrames:4,rightsVerified:true,sourceAuthorized:true,
      }
      const {error}=await client.from('director_watch_jobs').insert({
        id:jobId,owner_user_id:user.id,purpose:'sports',event_id:eventId,subject_id:subjectId,
        source_kind:'authorized-stream',source_locator:fixtureUrl,status:'queued',
        provider_id:'runpod-watch-worker',request:{...payload,callbackUrl:config.callbackUrl},
        created_at:now,updated_at:now,
      })
      if(error)throw new Error('DIRECTOR_WATCH_COMMISSION_JOB_WRITE_FAILED:'+error.message)
      await dispatch(client,config,payload)
      await client.from('director_watch_jobs').update({status:'submitted',updated_at:new Date().toISOString()}).eq('id',jobId)
      submitted.push({purpose:'sports',jobId,source:'first-party-fixture'})
    }

    if(purposes.includes('take-qc')){
      const realTake=await latestRealTake(client,user.id)
      if(!realTake){
        unavailable.push({purpose:'take-qc',reason:'DIRECTOR_WATCH_COMMISSION_REAL_TAKE_REQUIRED'})
      }else{
        const jobId='watch:commission:take-qc:'+crypto.randomUUID()
        const now=new Date().toISOString()
        const payload={
          jobId,purpose:'take-qc',
          projectId:realTake.projectId,
          takeGroupId:realTake.takeGroupId,
          takeId:realTake.takeId,
          generationTaskId:realTake.generationTaskId,
          assetId:realTake.assetId,
          sourceKind:'authorized-stream',
          sourceLocator:realTake.sourceLocator,
          sampleEverySeconds:1,
          maxFrames:12,
          rightsVerified:true,
          sourceAuthorized:true,
          qcContext:[
            'Director Watch commissioning against a real generated take.',
            'Expected take prompt: '+realTake.prompt,
            'This is evidence-only QC and grants no approval.',
          ].join('\\n'),
        }
        const {error}=await client.from('director_watch_jobs').insert({
          id:jobId,owner_user_id:user.id,purpose:'take-qc',
          project_id:realTake.projectId,take_group_id:realTake.takeGroupId,take_id:realTake.takeId,
          generation_task_id:realTake.generationTaskId,asset_id:realTake.assetId,
          source_kind:'authorized-stream',source_locator:realTake.sourceLocator,status:'queued',
          provider_id:'runpod-watch-worker',request:{...payload,callbackUrl:config.callbackUrl},
          created_at:now,updated_at:now,
        })
        if(error)throw new Error('DIRECTOR_WATCH_COMMISSION_JOB_WRITE_FAILED:'+error.message)
        await dispatch(client,config,payload)
        await client.from('director_watch_jobs').update({status:'submitted',updated_at:new Date().toISOString()}).eq('id',jobId)
        submitted.push({purpose:'take-qc',jobId,source:'real-generated-take'})
      }
    }

    return NextResponse.json({
      ok:true,
      submitted,
      unavailable,
      runtime,
      nextBoundary:'WAIT_FOR_AUTHENTICATED_WATCH_CALLBACK_RECEIPTS',
      commissionedNow:false,
      authority:'WATCH_COMMISSIONING_DISPATCH_ONLY',
      canPublish:false,canWager:false,canSpend:false,
    },{status:202})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_WATCH_COMMISSION_FAILED'
    return NextResponse.json({ok:false,error:message},{status:/REQUIRED|INVALID|HTTPS_ORIGIN/.test(message)?409:500})
  }
}
