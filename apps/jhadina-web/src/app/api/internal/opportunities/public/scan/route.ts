import { NextRequest,NextResponse } from 'next/server'
import { authorizedSchedulerRequest } from '@/lib/internal-scheduler-auth'
import { scanLosAngelesCountyReferenceSource } from '@/lib/opportunities/public-discovery-runtime'
import { createSchedulerServiceRoleClient } from '@/lib/supabase/service-role'

export const dynamic='force-dynamic'
export const runtime='nodejs'

export async function GET(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false},{status:401})
  const client=createSchedulerServiceRoleClient(request)
  if(!client)return NextResponse.json({ok:false,error:'public_opportunity_persistence_unavailable'},{status:503})
  try{
    const result=await scanLosAngelesCountyReferenceSource(client)
    const status=result.status==='failed'?502:200
    return NextResponse.json({ok:status===200,result},{status,headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'public_opportunity_scan_failed'
    return NextResponse.json({ok:false,error:message},{status:502,headers:{'cache-control':'no-store'}})
  }
}
