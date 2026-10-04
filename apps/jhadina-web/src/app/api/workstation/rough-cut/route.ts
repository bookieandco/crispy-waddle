import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority'
import {
  materializeSideHustleDirectorEditAssembly,
  proposeSideHustleDirectorEditAssembly,
} from '@/lib/opportunities/side-hustle-director-edit-assembler'

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
    const {data,error}=await client.from('director_edit_assembly_proposals')
      .select('id,production_run_id,plan_id,timeline_revision,proposal,selected_asset_ids,required_approval_asset_ids,status,error,created_at,updated_at,materialized_at')
      .eq('project_id',projectId).eq('owner_user_id',user.id)
      .order('updated_at',{ascending:false}).limit(1).maybeSingle()
    if(error)throw new Error('DIRECTOR_ASSEMBLY_PROPOSAL_READ_FAILED:'+error.message)
    return NextResponse.json({ok:true,proposal:data??null})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_ASSEMBLY_READ_FAILED'
    return NextResponse.json({ok:false,error:message},{status:/ACCESS_DENIED|CAPABILITY_DENIED/.test(message)?403:500})
  }
}

export async function POST(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const body=await request.json() as {projectId?:string;action?:'propose'|'materialize'}
    const projectId=body.projectId?.trim()??''
    if(!projectId||!body.action)return NextResponse.json({ok:false,error:'projectId and action are required'},{status:400})
    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})
    await requireDirectorProjectAuthority(client,{
      projectId,userId:user.id,capability:body.action==='materialize'?'edit':'read',
    })
    const result=body.action==='propose'
      ?await proposeSideHustleDirectorEditAssembly({client,userId:user.id,projectId})
      :await materializeSideHustleDirectorEditAssembly({client,userId:user.id,projectId})
    return NextResponse.json({ok:true,result},{status:body.action==='propose'?201:200})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_ASSEMBLY_FAILED'
    const status=/ACCESS_DENIED|CAPABILITY_DENIED/.test(message)
      ?403:/NOT_FOUND/.test(message)
        ?404:/APPROVAL_REQUIRED|REVISION_CHANGED|NOT_EMPTY|NOT_READY/.test(message)
          ?409:400
    return NextResponse.json({ok:false,error:message},{status})
  }
}
