import { NextResponse } from 'next/server'
import type { SideHustleFamily } from '@jhadina/opportunity-core'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { normalizeDiscoveryPolicy } from '@/lib/opportunities/venture-candidate-adoption-runtime'
import { VentureRuntimeRepository } from '@/lib/opportunities/venture-runtime-repository'

export const dynamic='force-dynamic'
export const runtime='nodejs'

type PolicyBody={
  enabled?:boolean
  autoAdoptCandidates?:boolean
  minimumCandidateScore?:number
  allowedFamilies?:SideHustleFamily[]
  maxAdoptionsPerRun?:number
}

export async function GET(){
  const requestId=crypto.randomUUID()
  try{
    const identity=await requireRequestIdentity()
    const service=createServiceRoleClient()
    if(!service)return NextResponse.json({ok:false,requestId,error:'venture_discovery_policy_unavailable'},{status:503})
    const repository=new VentureRuntimeRepository(service)
    const policy=await repository.getDiscoveryPolicy(identity.userId)
    return NextResponse.json({
      ok:true,
      requestId,
      policy:policy??normalizeDiscoveryPolicy({ownerUserId:identity.userId}),
      externalActionAuthorized:false,
      moneyMovementAuthorized:false,
    },{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'venture_discovery_policy_read_failed'
    const status=/Authenticated|identity|session/i.test(message)?401:502
    return NextResponse.json({ok:false,requestId,error:status===401?'Authentication required':message},{status,headers:{'cache-control':'no-store'}})
  }
}

export async function POST(request:Request){
  const requestId=crypto.randomUUID()
  try{
    const identity=await requireRequestIdentity()
    const body=await request.json().catch(()=>({})) as PolicyBody
    const policy=normalizeDiscoveryPolicy({
      ownerUserId:identity.userId,
      enabled:body.enabled,
      autoAdoptCandidates:body.autoAdoptCandidates,
      minimumCandidateScore:body.minimumCandidateScore,
      allowedFamilies:body.allowedFamilies,
      maxAdoptionsPerRun:body.maxAdoptionsPerRun,
      updatedAt:new Date().toISOString(),
    })
    const service=createServiceRoleClient()
    if(!service)return NextResponse.json({ok:false,requestId,error:'venture_discovery_policy_unavailable'},{status:503})
    const repository=new VentureRuntimeRepository(service)
    const persisted=await repository.upsertDiscoveryPolicy(policy)
    return NextResponse.json({
      ok:true,
      requestId,
      policy:persisted,
      policyEffect:'DISCOVERY_QUEUE_ONLY',
      externalActionAuthorized:false,
      automaticExperimentAuthorized:false,
      ventureLaunchAuthorized:false,
      moneyMovementAuthorized:false,
    },{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'venture_discovery_policy_update_failed'
    const status=/Authenticated|identity|session/i.test(message)?401:400
    return NextResponse.json({ok:false,requestId,error:status===401?'Authentication required':message},{status,headers:{'cache-control':'no-store'}})
  }
}
