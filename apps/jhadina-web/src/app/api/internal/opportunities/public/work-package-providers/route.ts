import { NextRequest,NextResponse } from 'next/server'
import { authorizedSchedulerRequest } from '@/lib/internal-scheduler-auth'
import { discoverPublicWorkPackageProviders } from '@/lib/opportunities/public-work-package-provider-runtime'
import { createSchedulerServiceRoleClient } from '@/lib/supabase/service-role'

export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=300

export async function GET(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false},{status:401})
  const client=createSchedulerServiceRoleClient(request)
  if(!client)return NextResponse.json({ok:false,error:'public_work_package_provider_persistence_unavailable'},{status:503})
  try{
    const result=await discoverPublicWorkPackageProviders(client)
    return NextResponse.json({ok:true,result},{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'public_work_package_provider_discovery_failed'
    return NextResponse.json({ok:false,error:message},{status:502,headers:{'cache-control':'no-store'}})
  }
}
