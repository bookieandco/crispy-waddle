import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority'

export async function GET(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const projectId=new URL(request.url).searchParams.get('projectId')?.trim()??''
    if(!projectId)return NextResponse.json({ok:false,error:'projectId is required'},{status:400})
    const privileged=createServiceRoleClient()
    if(!privileged)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})
    await requireDirectorProjectAuthority(privileged,{projectId,userId:user.id,capability:'read'})
    const {data,error}=await privileged.from('director_project_business_context')
      .select('project_id,opportunity_id,side_hustle_family,production_format,source_ref,plan,created_at,updated_at')
      .eq('project_id',projectId)
      .eq('owner_user_id',user.id)
      .maybeSingle()
    if(error)throw new Error('DIRECTOR_BUSINESS_CONTEXT_READ_FAILED:'+error.message)
    return NextResponse.json({ok:true,context:data??null})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_BUSINESS_CONTEXT_READ_FAILED'
    const status=/ACCESS_DENIED|CAPABILITY_DENIED/.test(message)?403:500
    return NextResponse.json({ok:false,error:message},{status})
  }
}
