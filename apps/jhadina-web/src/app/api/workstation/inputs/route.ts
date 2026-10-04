import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority'

const ROLES=new Set(['script','reference','footage','audio','b_roll','notes'] as const)
type InputRole='script'|'reference'|'footage'|'audio'|'b_roll'|'notes'

function statusFor(message:string):number{
  if(/ACCESS_DENIED|CAPABILITY_DENIED/.test(message))return 403
  if(/NOT_FOUND/.test(message))return 404
  if(/REQUIRED|INVALID|NOT_CLEAN|OWNER_MISMATCH/.test(message))return 400
  return 500
}

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

    const {data:bindings,error}=await privileged.from('director_project_inputs')
      .select('id,project_id,artifact_id,role,label,metadata,created_at')
      .eq('project_id',projectId)
      .eq('owner_user_id',user.id)
      .order('created_at',{ascending:true})
    if(error)throw new Error('DIRECTOR_PROJECT_INPUT_READ_FAILED:'+error.message)

    const ids=[...new Set((bindings??[]).map(row=>String(row.artifact_id)))]
    const artifacts=new Map<string,Record<string,unknown>>()
    if(ids.length){
      const {data,error:artifactError}=await privileged.from('jhadina_artifacts')
        .select('id,original_name,detected_mime_type,size_bytes,status,extracted_text_ref,derivative_refs,created_at')
        .eq('owner_user_id',user.id)
        .in('id',ids)
      if(artifactError)throw new Error('DIRECTOR_PROJECT_INPUT_ARTIFACT_READ_FAILED:'+artifactError.message)
      for(const row of data??[])artifacts.set(String(row.id),row as Record<string,unknown>)
    }

    return NextResponse.json({ok:true,inputs:(bindings??[]).map(row=>({
      id:String(row.id),
      projectId:String(row.project_id),
      artifactId:String(row.artifact_id),
      role:row.role,
      label:row.label,
      metadata:row.metadata??{},
      createdAt:row.created_at,
      artifact:artifacts.get(String(row.artifact_id))??null,
    }))})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_PROJECT_INPUT_READ_FAILED'
    return NextResponse.json({ok:false,error:message},{status:statusFor(message)})
  }
}

export async function POST(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const body=await request.json() as {projectId?:string;artifactId?:string;role?:InputRole;label?:string;metadata?:Record<string,unknown>}
    const projectId=body.projectId?.trim()??''
    const artifactId=body.artifactId?.trim()??''
    if(!projectId||!artifactId||!body.role)return NextResponse.json({ok:false,error:'projectId, artifactId and role are required'},{status:400})
    if(!ROLES.has(body.role))return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_INPUT_ROLE_INVALID'},{status:400})

    const privileged=createServiceRoleClient()
    if(!privileged)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})
    await requireDirectorProjectAuthority(privileged,{projectId,userId:user.id,capability:'edit'})

    const {data:artifact,error:artifactError}=await privileged.from('jhadina_artifacts')
      .select('id,owner_user_id,original_name,detected_mime_type,status,sha256,extracted_text_ref,derivative_refs')
      .eq('id',artifactId)
      .eq('owner_user_id',user.id)
      .maybeSingle()
    if(artifactError)throw new Error('DIRECTOR_PROJECT_INPUT_ARTIFACT_READ_FAILED:'+artifactError.message)
    if(!artifact)throw new Error('DIRECTOR_PROJECT_INPUT_ARTIFACT_NOT_FOUND')
    if(String(artifact.owner_user_id)!==user.id)throw new Error('DIRECTOR_PROJECT_INPUT_OWNER_MISMATCH')
    if(artifact.status!=='clean')throw new Error('DIRECTOR_PROJECT_INPUT_ARTIFACT_NOT_CLEAN')

    const {data,error}=await privileged.from('director_project_inputs').upsert({
      project_id:projectId,
      artifact_id:artifactId,
      owner_user_id:user.id,
      role:body.role,
      label:body.label?.trim()||artifact.original_name,
      metadata:{
        ...(body.metadata??{}),
        sha256:artifact.sha256,
        mimeType:artifact.detected_mime_type,
        extractedTextRef:artifact.extracted_text_ref,
        derivativeRefs:artifact.derivative_refs??[],
        authority:'REFERENCE_INPUT_ONLY',
      },
    },{onConflict:'project_id,artifact_id,role'}).select('id,project_id,artifact_id,role,label,metadata,created_at').single()
    if(error)throw new Error('DIRECTOR_PROJECT_INPUT_WRITE_FAILED:'+error.message)

    return NextResponse.json({ok:true,input:{
      id:String(data.id),projectId:String(data.project_id),artifactId:String(data.artifact_id),
      role:data.role,label:data.label,metadata:data.metadata??{},createdAt:data.created_at,
    }},{status:201})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_PROJECT_INPUT_WRITE_FAILED'
    return NextResponse.json({ok:false,error:message},{status:statusFor(message)})
  }
}
