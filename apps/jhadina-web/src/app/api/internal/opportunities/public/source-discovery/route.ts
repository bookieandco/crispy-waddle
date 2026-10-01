import { NextRequest,NextResponse } from 'next/server'
import { authorizedSchedulerRequest } from '@/lib/internal-scheduler-auth'
import { commissionPublicProcurementSourceBatch } from '@/lib/opportunities/public-source-commissioning-runtime'
import { refreshNationalPublicJurisdictions } from '@/lib/opportunities/public-discovery-runtime'
import { createSchedulerServiceRoleClient } from '@/lib/supabase/service-role'

export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=300

export async function GET(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false},{status:401})
  const client=createSchedulerServiceRoleClient(request)
  if(!client)return NextResponse.json({ok:false,error:'public_source_commissioning_persistence_unavailable'},{status:503})
  try{
    const {count,error:countError}=await client
      .from('jhadina_public_jurisdictions')
      .select('id',{count:'exact',head:true})
    if(countError)throw new Error(`public_jurisdiction_bootstrap_count_failed:${countError.message}`)

    if((count??0)===0){
      const bootstrap=await refreshNationalPublicJurisdictions(client)
      return NextResponse.json({
        ok:true,
        bootstrap,
        result:{
          status:'BOOTSTRAPPED',
          processed:0,
          verifiedSources:0,
          retryableErrors:0,
          results:[],
          automaticAdapterActivationAuthorized:false,
          externalContactAuthorized:false,
        },
      },{headers:{'cache-control':'no-store'}})
    }

    const result=await commissionPublicProcurementSourceBatch(client)
    return NextResponse.json({ok:true,result},{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'public_source_commissioning_failed'
    const status=message==='PUBLIC_SOURCE_SEARCH_NOT_CONFIGURED'?503:502
    return NextResponse.json({ok:false,error:message},{status,headers:{'cache-control':'no-store'}})
  }
}
