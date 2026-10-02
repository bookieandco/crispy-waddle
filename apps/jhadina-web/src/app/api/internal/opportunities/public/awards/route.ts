import { NextRequest,NextResponse } from 'next/server'
import { authorizedSchedulerRequest } from '@/lib/internal-scheduler-auth'
import { minePublicAwardPrimeBatch } from '@/lib/opportunities/public-award-prime-runtime'
import { createSchedulerServiceRoleClient } from '@/lib/supabase/service-role'

export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=300

function boundedBatch(raw:string|null){
  const value=Number(raw)
  return Number.isInteger(value)&&value>=1&&value<=500?value:100
}

export async function GET(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false},{status:401})
  const client=createSchedulerServiceRoleClient(request)
  if(!client)return NextResponse.json({ok:false,error:'public_award_prime_persistence_unavailable'},{status:503})
  try{
    const result=await minePublicAwardPrimeBatch(client,{batchSize:boundedBatch(request.nextUrl.searchParams.get('batchSize'))})
    return NextResponse.json({ok:true,result},{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'public_award_prime_mining_failed'
    return NextResponse.json({ok:false,error:message},{status:502,headers:{'cache-control':'no-store'}})
  }
}
