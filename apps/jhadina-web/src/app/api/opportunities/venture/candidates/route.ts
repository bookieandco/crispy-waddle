import { NextRequest, NextResponse } from 'next/server'
import type { SideHustleFamily, VentureDiscoveryCandidate } from '@jhadina/opportunity-core'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { VentureRuntimeRepository } from '@/lib/opportunities/venture-runtime-repository'

export const dynamic='force-dynamic'
export const runtime='nodejs'

const RECOMMENDATIONS=new Set<VentureDiscoveryCandidate['recommendation']>(['research','hold','reject'])

export async function GET(request:NextRequest){
  const requestId=crypto.randomUUID()
  try{
    await requireRequestIdentity()
    const service=createServiceRoleClient()
    if(!service)return NextResponse.json({ok:false,requestId,error:'venture_candidate_runtime_unavailable'},{status:503})
    const repository=new VentureRuntimeRepository(service)
    const recommendationParam=request.nextUrl.searchParams.get('recommendation')
    const recommendation=recommendationParam&&RECOMMENDATIONS.has(recommendationParam as VentureDiscoveryCandidate['recommendation'])
      ? recommendationParam as VentureDiscoveryCandidate['recommendation']
      : undefined
    const family=request.nextUrl.searchParams.get('family')?.trim() as SideHustleFamily|undefined
    const minimumScoreParam=request.nextUrl.searchParams.get('minimumScore')
    const minimumScore=minimumScoreParam===null?undefined:Number(minimumScoreParam)
    if(minimumScore!==undefined&&(!Number.isFinite(minimumScore)||minimumScore<0||minimumScore>100)){
      return NextResponse.json({ok:false,requestId,error:'minimumScore must be between 0 and 100'},{status:400})
    }
    const candidates=await repository.listCandidates({family,recommendation,minimumScore,limit:100})
    return NextResponse.json({
      ok:true,
      requestId,
      candidates,
      externalActionAuthorized:false,
      automaticExperimentAuthorized:false,
      moneyMovementAuthorized:false,
    },{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'venture_candidate_list_failed'
    const status=/Authenticated|identity|session/i.test(message)?401:502
    return NextResponse.json({ok:false,requestId,error:status===401?'Authentication required':message},{status,headers:{'cache-control':'no-store'}})
  }
}
