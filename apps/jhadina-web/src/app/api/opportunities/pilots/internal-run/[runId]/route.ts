import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createSupabaseAgentRuntimeRepository } from '@/lib/supabase-agent-runtime-repository'
import { assertOwnerScopedPilotRunId } from '@/lib/opportunities/autonomy-agent-runtime'

export const runtime='nodejs'
export const dynamic='force-dynamic'

export async function GET(_request:Request,context:{params:{runId:string}}){
  const supabase=await createClient()
  const {data:{user},error}=await supabase.auth.getUser()
  if(error||!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
  try {assertOwnerScopedPilotRunId(context.params.runId,user.id)} catch {
    return NextResponse.json({ok:false,error:'Pilot run not found'},{status:404})
  }
  const service=createServiceRoleClient()
  if(!service)return NextResponse.json({ok:false,error:'Agent store unavailable'},{status:503})
  const repo=createSupabaseAgentRuntimeRepository(service)
  const run=await repo.getRun(context.params.runId)
  if(!run)return NextResponse.json({ok:false,error:'Pilot run not found'},{status:404})
  const checkpoint=await repo.getLatestCheckpoint(run.id)
  return NextResponse.json({ok:true,run:{id:run.id,status:run.status,version:run.version,updatedAt:run.updatedAt},checkpoint:checkpoint?{reason:checkpoint.reason,createdAt:checkpoint.createdAt,planRevision:checkpoint.planRevision}:null,externalActionAuthorized:false},{headers:{'cache-control':'no-store'}})
}
