import { NextRequest,NextResponse } from 'next/server'
import { authorizedSchedulerRequest } from '@/lib/internal-scheduler-auth'
import { commissionPublicComplianceSourceBatch } from '@/lib/opportunities/public-compliance-source-runtime'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=300

export async function GET(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false},{status:401})
  const client=createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'public_compliance_source_persistence_unavailable'},{status:503})
  try{
    const result=await commissionPublicComplianceSourceBatch(client)
    return NextResponse.json({ok:true,result},{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'public_compliance_source_commissioning_failed'
    const status=message==='PUBLIC_COMPLIANCE_SEARCH_NOT_CONFIGURED'?503:502
    return NextResponse.json({ok:false,error:message},{status,headers:{'cache-control':'no-store'}})
  }
}
