import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createRuntimeServiceRoleClient} from '@/lib/supabase/service-role'
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority'
import {inspectDirectorDurableStoreReadiness} from '@/lib/director-schema-recovery'

export const runtime='nodejs'
export const dynamic='force-dynamic'

/**
 * A read-only owner/project-scoped answer for missing Director schema.
 * Exposes no SQL, provider secrets or cross-project state.
 */
export async function GET(request:Request){
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
  const projectId=new URL(request.url).searchParams.get('projectId')?.trim()??''
  if(!projectId)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_ID_REQUIRED'},{status:400})

  const client=await createRuntimeServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503})
  try{
    await requireDirectorProjectAuthority(client,{projectId,userId:user.id,capability:'read'})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_PROJECT_ACCESS_DENIED'
    return NextResponse.json({ok:false,error:/ACCESS_DENIED|CAPABILITY_DENIED/.test(message)
      ?'DIRECTOR_PROJECT_ACCESS_DENIED':'DIRECTOR_PROJECT_AUTHORITY_UNAVAILABLE'},{status:/ACCESS_DENIED|CAPABILITY_DENIED/.test(message)?403:503})
  }
  const readiness=await inspectDirectorDurableStoreReadiness(client)
  return NextResponse.json({
    ok:readiness.schemaReadable,
    projectId,
    ...readiness,
    canEditProduction:false,
    canDispatchWatch:false,
    nextBoundary:readiness.schemaReadable?'DURABLE_WRITE_AND_RESTORE_CERT_REQUIRED':'DIRECTOR_SCHEMA_RECONCILIATION_REQUIRED',
  },{status:readiness.schemaReadable?200:503,headers:{'cache-control':'no-store, private'}})
}
