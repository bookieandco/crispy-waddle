import {NextResponse} from 'next/server'
import type {
  MediaTimebase,
  VisualAnnotationProviderLabel,
  VisualAnnotationScope,
} from '@jhadina/director-core'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority'
import {
  createDirectorCvatAnnotationTask,
  importDirectorCvatAnnotations,
  listDirectorCvatAnnotationTasks,
  refreshDirectorCvatAnnotationTask,
  reviewDirectorCvatAnnotationImport,
} from '@/lib/director-cvat-annotation-service'

type Action='create'|'refresh'|'import'|'review'

function statusFor(message:string):number{
  if(/ACCESS_DENIED|CAPABILITY_DENIED/.test(message))return 403
  if(/NOT_FOUND/.test(message))return 404
  if(/REQUIRED|INVALID|AUTHORIZATION|HTTPS|MISMATCH/.test(message))return 400
  if(/NOT_CONFIGURED/.test(message))return 503
  return 500
}

async function taskBinding(client:ReturnType<typeof createServiceRoleClient> extends infer T?Exclude<T,null>:never,userId:string,taskId:string){
  const {data,error}=await client.from('director_visual_annotation_tasks')
    .select('id,scope,project_id,event_id')
    .eq('id',taskId).eq('owner_user_id',userId).maybeSingle()
  if(error)throw new Error('DIRECTOR_ANNOTATION_TASK_READ_FAILED:'+error.message)
  if(!data)throw new Error('DIRECTOR_ANNOTATION_TASK_NOT_FOUND')
  return data
}

export async function GET(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const url=new URL(request.url)
    const projectId=url.searchParams.get('projectId')?.trim()||undefined
    const eventId=url.searchParams.get('eventId')?.trim()||undefined
    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})
    if(projectId)await requireDirectorProjectAuthority(client,{projectId,userId:user.id,capability:'read'})
    const tasks=await listDirectorCvatAnnotationTasks({client,userId:user.id,projectId,eventId})
    return NextResponse.json({ok:true,tasks})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_ANNOTATION_TASK_LIST_FAILED'
    return NextResponse.json({ok:false,error:message},{status:statusFor(message)})
  }
}

export async function POST(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const body=await request.json() as {
      action?:Action
      taskId?:string
      importId?:string
      decision?:'accepted'|'rejected'
      note?:string
      scope?:VisualAnnotationScope
      title?:string
      sourceUri?:string
      projectId?:string
      eventId?:string
      assetId?:string
      timebase?:MediaTimebase
      labels?:VisualAnnotationProviderLabel[]
      evidenceRefs?:string[]
      rightsVerified?:boolean
      sourceAuthorized?:boolean
    }
    const action=body.action
    if(!action)return NextResponse.json({ok:false,error:'action is required'},{status:400})
    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})

    if(action==='create'){
      if(!body.scope||!body.title?.trim()||!body.sourceUri?.trim()||!body.timebase){
        return NextResponse.json({ok:false,error:'scope, title, sourceUri and timebase are required'},{status:400})
      }
      if(body.rightsVerified!==true||body.sourceAuthorized!==true){
        return NextResponse.json({ok:false,error:'DIRECTOR_CVAT_SOURCE_AUTHORIZATION_REQUIRED'},{status:400})
      }
      if(body.scope==='director'){
        const projectId=body.projectId?.trim()??''
        if(!projectId)return NextResponse.json({ok:false,error:'projectId is required for Director scope'},{status:400})
        await requireDirectorProjectAuthority(client,{projectId,userId:user.id,capability:'edit'})
      }
      const result=await createDirectorCvatAnnotationTask({
        client,
        userId:user.id,
        scope:body.scope,
        title:body.title,
        sourceUri:body.sourceUri,
        ...(body.projectId?.trim()?{projectId:body.projectId.trim()}:{}),
        ...(body.eventId?.trim()?{eventId:body.eventId.trim()}:{}),
        ...(body.assetId?.trim()?{assetId:body.assetId.trim()}:{}),
        timebase:body.timebase,
        ...(body.labels?.length?{labels:body.labels}:{}),
        evidenceRefs:body.evidenceRefs??[],
        rightsVerified:true,
        sourceAuthorized:true,
      })
      return NextResponse.json({ok:true,result},{status:201})
    }

    const taskId=body.taskId?.trim()??''
    if(!taskId&&action!=='review')return NextResponse.json({ok:false,error:'taskId is required'},{status:400})
    if(action==='review'){
      const importId=body.importId?.trim()??''
      if(!importId||!body.decision)return NextResponse.json({ok:false,error:'importId and decision are required'},{status:400})
      const {data:importRow,error:importError}=await client.from('director_visual_annotation_imports')
        .select('annotation_task_id').eq('id',importId).eq('owner_user_id',user.id).maybeSingle()
      if(importError)throw new Error('DIRECTOR_CVAT_IMPORT_READ_FAILED:'+importError.message)
      if(!importRow)throw new Error('DIRECTOR_CVAT_IMPORT_NOT_FOUND')
      const binding=await taskBinding(client,user.id,String(importRow.annotation_task_id))
      if(binding.scope==='director'&&binding.project_id){
        await requireDirectorProjectAuthority(client,{projectId:String(binding.project_id),userId:user.id,capability:'approve'})
      }
      const result=await reviewDirectorCvatAnnotationImport({
        client,
        userId:user.id,
        importId,
        decision:body.decision,
        ...(body.note?.trim()?{note:body.note.trim()}:{}),
      })
      return NextResponse.json({ok:true,result})
    }

    const binding=await taskBinding(client,user.id,taskId)
    if(binding.scope==='director'&&binding.project_id){
      await requireDirectorProjectAuthority(client,{
        projectId:String(binding.project_id),
        userId:user.id,
        capability:action==='import'?'edit':'read',
      })
    }
    if(action==='refresh'){
      const result=await refreshDirectorCvatAnnotationTask({client,userId:user.id,taskId})
      return NextResponse.json({ok:true,result})
    }
    if(action==='import'){
      const result=await importDirectorCvatAnnotations({client,userId:user.id,taskId})
      return NextResponse.json({ok:true,result})
    }
    return NextResponse.json({ok:false,error:'Unsupported annotation action'},{status:400})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_ANNOTATION_ACTION_FAILED'
    return NextResponse.json({ok:false,error:message},{status:statusFor(message)})
  }
}
