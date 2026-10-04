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
    return NextResponse.json({ok:true,plan:data??null})
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
