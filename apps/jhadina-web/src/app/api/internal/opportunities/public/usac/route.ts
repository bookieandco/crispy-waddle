import { NextRequest,NextResponse } from 'next/server'
import { authorizedSchedulerRequest } from '@/lib/internal-scheduler-auth'
import { refreshUsacPublicVerticalFeeds } from '@/lib/opportunities/public-usac-vertical-runtime'
import { createSchedulerServiceRoleClient } from '@/lib/supabase/service-role'

export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=300

function bounded(raw:string|null,fallback:number,min:number,max:number){
  const value=Number(raw)
  return Number.isInteger(value)&&value>=min&&value<=max?value:fallback
}

export async function GET(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false},{status:401})
  const client=createSchedulerServiceRoleClient(request)
  if(!client)return NextResponse.json({ok:false,error:'usac_public_vertical_persistence_unavailable'},{status:503})
  try{
    const result=await refreshUsacPublicVerticalFeeds(client,{
      pageSize:bounded(request.nextUrl.searchParams.get('pageSize'),500,25,2000),
      fundingYear:bounded(request.nextUrl.searchParams.get('fundingYear'),new Date().getUTCFullYear(),2016,new Date().getUTCFullYear()+1),
    })
    return NextResponse.json({ok:result.status==='PASS',result},{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'usac_public_vertical_refresh_failed'
    return NextResponse.json({ok:false,error:message},{status:502,headers:{'cache-control':'no-store'}})
  }
}
