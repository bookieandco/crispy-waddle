import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'
import { createSupabaseAgentRuntimeRepository } from '@/lib/supabase-agent-runtime-repository'
import { runSourceBoundOpportunityPilot } from '@/lib/opportunities/autonomy-agent-runtime'
import type { ServicePilotInput,OpportunityPilotSourceCheck } from '@jhadina/opportunity-core'

export const dynamic='force-dynamic'
export const runtime='nodejs'

/** One explicit owner review turns existing canonical excerpts into an internal-only report.
 * No crawling, user-supplied invented findings, client delivery or payment events.
 */
export async function POST(request:Request) {
  const supabase=await createClient()
  const {data:{user},error}=await supabase.auth.getUser()
  if(error||!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
  const body=await request.json().catch(()=>null) as {opportunityId?:unknown;kind?:unknown;confirmedSourceReview?:unknown}|null
  if(!body||typeof body.opportunityId!=='string'||body.opportunityId.length>240||
    !['research_report','qualified_leads','seo_audit'].includes(String(body.kind))||
    body.confirmedSourceReview!==true) {
    return NextResponse.json({ok:false,error:'Explicit owner source review, kind and opportunityId are required'},{status:400})
  }
  const service=createServiceRoleClient()
  if(!service)return NextResponse.json({ok:false,error:'Agent persistence unavailable'},{status:503})
  try {
    const stored=await createSupabaseOpportunityRepository().get(body.opportunityId)
    if(!stored||stored.userId!==user.id)return NextResponse.json({ok:false,error:'Opportunity not found'},{status:404})
    const now=new Date().toISOString()
    const evidence=stored.opportunity.evidence.filter(row=>
      ['official','secondary'].includes(row.sourceType)&&
      Boolean(row.excerpt?.trim())&&
      row.sourceUrl.startsWith('https://')&&
      Number.isFinite(Date.parse(row.capturedAt))&&
      Date.parse(row.capturedAt)<=Date.parse(now)
    ).slice(0,50)
    const observations:OpportunityPilotSourceCheck[]=evidence.map((row,index)=>({
      id:'observed:'+index,opportunityId:stored.opportunity.id,
      sourceUrl:row.sourceUrl,evidenceId:row.id,
      excerpt:row.excerpt!,observedAt:row.capturedAt,reviewedByOwner:true,
    }))
    const pilot:ServicePilotInput={
      kind:body.kind as ServicePilotInput['kind'],
      subject:body.kind==='seo_audit'?stored.opportunity.sourceUrl:stored.opportunity.title,
      createdAt:now,
      evidence:observations.map(row=>({
        sourceUrl:row.sourceUrl,observedAt:row.observedAt,finding:row.excerpt,
        subject:body.kind==='qualified_leads'
          ? evidence.find(e=>e.id===row.evidenceId)?.sourceName : undefined,
      })),
    }
    const result=await runSourceBoundOpportunityPilot({
      ownerId:user.id,opportunity:stored.opportunity,pilot,observations,
      repository:createSupabaseAgentRuntimeRepository(service),
    })
    return NextResponse.json({ok:result.accepted,...result,sourceRecordsConsidered:evidence.length,
      independentVerificationCompleted:false,externalActionAuthorized:false},{
      status:result.accepted?201:409,headers:{'cache-control':'no-store'},
    })
  }catch(cause){
    return NextResponse.json({ok:false,error:cause instanceof Error?cause.message:'Pilot blocked'},{status:409,headers:{'cache-control':'no-store'}})
  }
}
