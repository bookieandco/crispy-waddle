import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createRuntimeServiceRoleClient} from '@/lib/supabase/service-role'
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority'
import {certifyDirectorAutoFinal,inspectDirectorAutoFinal} from '@/lib/opportunities/side-hustle-director-auto-final'

function statusFor(message:string):number{
  if(/ACCESS_DENIED|CAPABILITY_DENIED/.test(message))return 403
  if(/NOT_FOUND/.test(message))return 404
  if(/REQUIRED|INVALID|MISMATCH/.test(message))return 409
  return 500
}

export async function GET(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const projectId=new URL(request.url).searchParams.get('projectId')?.trim()??''
    if(!projectId)return NextResponse.json({ok:false,error:'projectId is required'},{status:400})
    const client=await createRuntimeServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})
    await requireDirectorProjectAuthority(client,{projectId,userId:user.id,capability:'read'})
    const receipt=await inspectDirectorAutoFinal({client,userId:user.id,projectId})
    return NextResponse.json({ok:true,receipt})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_AUTO_FINAL_READ_FAILED'
    return NextResponse.json({ok:false,error:message},{status:statusFor(message)})
  }
}

export async function POST(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const body=await request.json() as {projectId?:string}
    const projectId=body.projectId?.trim()??''
    if(!projectId)return NextResponse.json({ok:false,error:'projectId is required'},{status:400})
    const client=await createRuntimeServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})
    await requireDirectorProjectAuthority(client,{projectId,userId:user.id,capability:'approve'})
    const receipt=await certifyDirectorAutoFinal({client,userId:user.id,projectId})
    return NextResponse.json({ok:true,receipt},{status:201})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_AUTO_FINAL_CERTIFICATION_FAILED'
    return NextResponse.json({ok:false,error:message},{status:statusFor(message)})
  }
}
