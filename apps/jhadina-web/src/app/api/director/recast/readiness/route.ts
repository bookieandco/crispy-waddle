import {NextResponse} from 'next/server'
import {evaluateRecastRuntimePrerequisites} from '@jhadina/director-core'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority'
import {diagnoseRecastSchema} from '@/lib/recast-schema-diagnostics'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const headers={'Cache-Control':'private, no-store'}
const denied=(error:string,status:number)=>NextResponse.json({ok:false,error},{status,headers})

/** Authenticated, project-scoped schema availability only. No insert, RPC,
 * migration, render, signed URL, or approval receipt is produced. */
export async function GET(request:Request){
  const projectId=new URL(request.url).searchParams.get('projectId')?.trim()??''
  if(!projectId||projectId.length>200)return denied('DIRECTOR_RECAST_PROJECT_REQUIRED',400)
  const auth=await createClient()
  const {data:{user}}=await auth.auth.getUser()
  if(!user)return denied('AUTHENTICATION_REQUIRED',401)
  const db=createServiceRoleClient()
  if(!db)return denied('DIRECTOR_RECAST_STORAGE_UNAVAILABLE',503)
  try{
    await requireDirectorProjectAuthority(db,{projectId,userId:user.id,capability:'edit'})
  }catch(error){
    const message=error instanceof Error?error.message:''
    if(/ACCESS_DENIED|CAPABILITY_DENIED/.test(message))
      return denied('DIRECTOR_PROJECT_ACCESS_DENIED',403)
    return denied('DIRECTOR_RECAST_AUTHORITY_UNAVAILABLE',503)
  }
  try{
    const [inputs,receipts,artifacts,casts]=await Promise.all([
      db.from('director_project_inputs').select('id')
        .eq('project_id',projectId).eq('owner_user_id',user.id).limit(1),
      db.from('director_recast_review_receipts').select('id')
        .eq('project_id',projectId).eq('owner_user_id',user.id).limit(1),
      db.from('jhadina_artifacts').select('id')
        .eq('owner_user_id',user.id).limit(1),
      db.from('director_cast_characters').select('id')
        .eq('project_id',projectId).limit(1),
    ])
    const diagnosis=diagnoseRecastSchema({
      projectInputs:inputs.error,reviewReceipts:receipts.error,
      artifactStore:artifacts.error,castStore:casts.error,
    })
    const status=evaluateRecastRuntimePrerequisites({
      projectInputsReadable:!inputs.error,
      reviewReceiptsReadable:!receipts.error,
      scannedArtifactStoreReadable:!artifacts.error,
      approvedCastStoreReadable:!casts.error,
      decodedMediaProbeAvailable:false,
      independentReviewWriterCommissioned:false,
      actionExecutorCommissioned:false,
      previewWorkerCommissioned:false,
      physicalIPhoneAccepted:false,
    })
    return NextResponse.json({
      ok:true,projectId,
      ...status,
      ...diagnosis,
      blockers:[...diagnosis.blockers,...status.blockers],
      nextBlockingGate:diagnosis.blockers[0]??status.nextBlockingGate,
      sourceUploadReady:status.sourceUploadReady&&diagnosis.sourceBindingAvailable,
      tableReadabilityOnly:true,
      noMutationPerformed:true,
    },{headers})
  }catch{
    return denied('DIRECTOR_RECAST_SCHEMA_READINESS_UNAVAILABLE',503)
  }
}
