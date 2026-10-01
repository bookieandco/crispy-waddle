import { NextRequest,NextResponse } from 'next/server'
import { authorizedSchedulerRequest } from '@/lib/internal-scheduler-auth'
import { commissionPublicProcurementSourceBatch } from '@/lib/opportunities/public-source-commissioning-runtime'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=300

export async function GET(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false},{status:401})
  const client=createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'public_source_commissioning_persistence_unavailable'},{status:503})
  try{
    const result=await commissionPublicProcurementSourceBatch(client)
    return NextResponse.json({ok:true,result},{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'public_source_commissioning_failed'
    const status=message==='PUBLIC_SOURCE_SEARCH_NOT_CONFIGURED'?503:502
    return NextResponse.json({ok:false,error:message},{status,headers:{'cache-control':'no-store'}})
  }
}
