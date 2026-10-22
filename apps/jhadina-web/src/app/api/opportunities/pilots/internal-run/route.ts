import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createSupabaseAgentRuntimeRepository } from '@/lib/supabase-agent-runtime-repository'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'
import { runSourceBoundOpportunityPilot } from '@/lib/opportunities/autonomy-agent-runtime'
import type { ServicePilotInput, OpportunityPilotSourceCheck } from '@jhadina/opportunity-core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Internal-only governed agent run. Uses canonical opportunity + service-only agent persistence. */
export async function POST(request:Request) {
  const supabase = await createClient()
  const { data:{ user },error }=await supabase.auth.getUser()
  if(error || !user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
  const body=await request.json().catch(()=>null) as {
    opportunityId?:unknown
    pilot?:ServicePilotInput
    observations?:OpportunityPilotSourceCheck[]
  }|null
  if(!body || typeof body.opportunityId!=='string' || body.opportunityId.length>240 ||
    !body.pilot || !Array.isArray(body.observations) || body.observations.length>50 ||
    !Array.isArray(body.pilot.evidence) || body.pilot.evidence.length>50) {
    return NextResponse.json({ok:false,error:'Invalid source-bound pilot input'},{status:400})
  }
  const service=createServiceRoleClient()
  if(!service)return NextResponse.json({ok:false,error:'Durable agent repository unavailable'},{status:503})
  try {
    const stored=await createSupabaseOpportunityRepository().get(body.opportunityId)
    if(!stored || stored.userId!==user.id)return NextResponse.json({ok:false,error:'Opportunity not found'},{status:404})
    const result=await runSourceBoundOpportunityPilot({
      ownerId:user.id,opportunity:stored.opportunity,
      pilot:body.pilot,observations:body.observations,
      repository:createSupabaseAgentRuntimeRepository(service),
    })
    return NextResponse.json({ok:result.accepted,...result,commercialDeliveryAuthorized:false},{status:result.accepted?201:409,headers:{'cache-control':'no-store'}})
  }catch(cause){
    return NextResponse.json({ok:false,error:cause instanceof Error?cause.message:'Internal pilot failed closed'},{status:409,headers:{'cache-control':'no-store'}})
  }
}
