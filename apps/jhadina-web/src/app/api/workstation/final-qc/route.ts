import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createRuntimeServiceRoleClient} from '@/lib/supabase/service-role'
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority'
import {evaluateSideHustleDirectorFinalQcReadiness} from '@/lib/opportunities/side-hustle-director-final-qc'


async function postReceipts(client:ReturnType<typeof createRuntimeServiceRoleClient> extends infer T?Exclude<T,null>:never,projectId:string,userId:string){
  const {data,error}=await client.from('director_post_task_receipts')
    .select('task_id,capability,status,output_refs,error_code,completed_at')
    .eq('project_id',projectId)
    .eq('owner_user_id',userId)
    .order('completed_at',{ascending:true})
  if(error)throw new Error('DIRECTOR_PROJECT_FINAL_QC_POST_RECEIPT_READ_FAILED:'+error.message)
  return (data??[]).map(row=>({
    taskId:String(row.task_id),
    capability:String(row.capability),
    status:String(row.status),
    outputRefs:Array.isArray(row.output_refs)?row.output_refs.map(String):[],
    errorCode:row.error_code?String(row.error_code):null,
    completedAt:String(row.completed_at),
  }))
}

function statusFor(message:string):number{
  if(/ACCESS_DENIED|CAPABILITY_DENIED/.test(message))return 403
  if(/NOT_FOUND/.test(message))return 404
  if(/REQUIRED|INVALID|MISMATCH|FORMAT/.test(message))return 409
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
    const [readiness,receipts]=await Promise.all([
      evaluateSideHustleDirectorFinalQcReadiness({client,userId:user.id,projectId}),
      postReceipts(client,projectId,user.id),
    ])
    return NextResponse.json({ok:true,readiness,postReceipts:receipts})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_PROJECT_FINAL_QC_READ_FAILED'
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
    const [readiness,receipts]=await Promise.all([
      evaluateSideHustleDirectorFinalQcReadiness({client,userId:user.id,projectId,persistReceipt:true}),
      postReceipts(client,projectId,user.id),
    ])
    if(!readiness.readyForEvaluation){
      return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_FINAL_QC_NOT_READY',readiness,postReceipts:receipts},{status:409})
    }
    return NextResponse.json({ok:true,readiness,postReceipts:receipts})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_PROJECT_FINAL_QC_EVALUATION_FAILED'
    return NextResponse.json({ok:false,error:message},{status:statusFor(message)})
  }
}