import {NextResponse} from 'next/server'
import {proposeScreenplayBlueprint} from '@jhadina/director-core'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {CleanArtifactContextResolver} from '@/lib/artifacts/clean-artifact-context-resolver'
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
    const {data,error}=await privileged.from('director_screenplay_ingest_proposals')
      .select('id,artifact_id,proposal,status,created_at,updated_at')
      .eq('project_id',projectId).eq('owner_user_id',user.id)
      .order('created_at',{ascending:false})
    if(error)throw new Error('DIRECTOR_SCREENPLAY_PROPOSAL_READ_FAILED:'+error.message)
    return NextResponse.json({ok:true,proposals:data??[]})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_SCREENPLAY_PROPOSAL_READ_FAILED'
    return NextResponse.json({ok:false,error:message},{status:/ACCESS_DENIED|CAPABILITY_DENIED/.test(message)?403:500})
  }
}

export async function POST(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const body=await request.json() as {projectId?:string;artifactId?:string;title?:string}
    const projectId=body.projectId?.trim()??''
    const artifactId=body.artifactId?.trim()??''
    if(!projectId||!artifactId)return NextResponse.json({ok:false,error:'projectId and artifactId are required'},{status:400})

    const privileged=createServiceRoleClient()
    if(!privileged)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})
    await requireDirectorProjectAuthority(privileged,{projectId,userId:user.id,capability:'edit'})

    const {data:binding,error:bindingError}=await privileged.from('director_project_inputs')
      .select('artifact_id,role,label').eq('project_id',projectId).eq('owner_user_id',user.id)
      .eq('artifact_id',artifactId).eq('role','script').maybeSingle()
    if(bindingError)throw new Error('DIRECTOR_SCREENPLAY_INPUT_READ_FAILED:'+bindingError.message)
    if(!binding)throw new Error('DIRECTOR_SCREENPLAY_SCRIPT_INPUT_REQUIRED')

    const contexts=await new CleanArtifactContextResolver(privileged,user.id).resolve([{id:artifactId}])
    const context=contexts.find(item=>item.id===artifactId)
    if(!context||context.kind!=='text'||!context.text?.trim())throw new Error('DIRECTOR_SCREENPLAY_TEXT_CONTEXT_REQUIRED')

    const proposal=proposeScreenplayBlueprint({
      projectId,
      title:body.title?.trim()||String(binding.label??context.name??'Untitled screenplay'),
      text:context.text,
      evidenceIds:[`artifact:${artifactId}`,`project-input:${artifactId}:script`],
    })
    const {data,error}=await privileged.from('director_screenplay_ingest_proposals').upsert({
      project_id:projectId,
      owner_user_id:user.id,
      artifact_id:artifactId,
      proposal,
      status:'proposed',
      updated_at:new Date().toISOString(),
    },{onConflict:'project_id,artifact_id,status'}).select('id,artifact_id,proposal,status,created_at,updated_at').single()
    if(error)throw new Error('DIRECTOR_SCREENPLAY_PROPOSAL_WRITE_FAILED:'+error.message)
    return NextResponse.json({ok:true,proposalRecord:data},{status:201})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_SCREENPLAY_INGEST_FAILED'
    const status=/ACCESS_DENIED|CAPABILITY_DENIED/.test(message)?403:/REQUIRED|NOT_CLEAN|UNAVAILABLE|TOO_LARGE/.test(message)?400:500
    return NextResponse.json({ok:false,error:message},{status})
  }
}
