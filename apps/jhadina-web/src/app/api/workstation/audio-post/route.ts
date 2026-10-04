import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority'
import {compileSideHustleDirectorAudioPostPlan} from '@/lib/opportunities/side-hustle-director-audio-post'
import {ensureSideHustleDirectorPostWorkSession} from '@/lib/opportunities/side-hustle-director-post-work-session'

export async function GET(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const projectId=new URL(request.url).searchParams.get('projectId')?.trim()??''
    if(!projectId)return NextResponse.json({ok:false,error:'projectId is required'},{status:400})
    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})
    await requireDirectorProjectAuthority(client,{projectId,userId:user.id,capability:'read'})
    const {data,error}=await client.from('director_audio_post_plans')
      .select('id,production_run_id,plan_id,timeline_revision,format,post_plan,required_worker_profiles,ready_worker_profiles,blockers,status,created_at,updated_at')
      .eq('project_id',projectId).eq('owner_user_id',user.id)
      .order('updated_at',{ascending:false}).limit(1).maybeSingle()
    if(error)throw new Error('DIRECTOR_AUDIO_POST_READ_FAILED:'+error.message)
    if(!data)return NextResponse.json({ok:true,plan:null,postRuntime:null})
    const workSessionId='work:director-post:'+projectId+':'+String(data.plan_id)+':r'+String(data.timeline_revision)
    const {data:tasks,error:taskError}=await client.from('jhadina_work_session_tasks')
      .select('id,capability,status,attempt,max_attempts,blocked_reason,output_refs,updated_at')
      .eq('work_session_id',workSessionId)
      .eq('owner_user_id',user.id)
      .order('created_at',{ascending:true})
    if(taskError)throw new Error('DIRECTOR_AUDIO_POST_TASK_READ_FAILED:'+taskError.message)
    const normalizedTasks=(tasks??[]).map(task=>({
      id:String(task.id),
      capability:String(task.capability),
      status:String(task.status),
      attempt:Number(task.attempt),
      maxAttempts:Number(task.max_attempts),
      blockedReason:task.blocked_reason?String(task.blocked_reason):null,
      outputRefs:Array.isArray(task.output_refs)?task.output_refs.map(String):[],
      updatedAt:String(task.updated_at),
    }))
    const allComplete=normalizedTasks.length>0&&normalizedTasks.every(task=>task.status==='completed')
    const blocked=normalizedTasks.find(task=>task.status==='blocked'||(task.status==='failed'&&task.attempt>=task.maxAttempts))
    const running=normalizedTasks.find(task=>task.status==='running')
    const ready=normalizedTasks.find(task=>task.status==='ready'||task.status==='retrying')
    const executionBoundary=allComplete
      ?'POST_PRODUCTION_COMPLETE'
      :blocked
        ?'POST_TASK_BLOCKED'
        :running
          ?'POST_TASK_RESULTS_REQUIRED'
          :ready
            ?'COMPUTE_RUNTIME_BINDING_REQUIRED'
            :'POST_TASK_DEPENDENCIES_PENDING'
    return NextResponse.json({
      ok:true,
      plan:data,
      postRuntime:{
        workSessionId,
        tasks:normalizedTasks,
        executionBoundary,
        sourceComplete:true,
        liveComputeConfigured:false,
      },
    })
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_AUDIO_POST_READ_FAILED'
    return NextResponse.json({ok:false,error:message},{status:/ACCESS_DENIED|CAPABILITY_DENIED/.test(message)?403:500})
  }
}

export async function POST(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const body=await request.json() as {projectId?:string;action?:'compile'|'prepare-execution'}
    const projectId=body.projectId?.trim()??''
    const action=body.action??'compile'
    if(!projectId)return NextResponse.json({ok:false,error:'projectId is required'},{status:400})
    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})
    await requireDirectorProjectAuthority(client,{projectId,userId:user.id,capability:'edit'})
    const result=action==='prepare-execution'
      ?await ensureSideHustleDirectorPostWorkSession({
        client,userId:user.id,projectId,allowCloudBurst:false,
      })
      :await compileSideHustleDirectorAudioPostPlan({client,userId:user.id,projectId})
    return NextResponse.json({ok:true,action,result},{status:201})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_AUDIO_POST_FAILED'
    return NextResponse.json({ok:false,error:message},{status:/ACCESS_DENIED|CAPABILITY_DENIED/.test(message)?403:/REQUIRED|INVALID|NOT_READY/.test(message)?409:400})
  }
}
