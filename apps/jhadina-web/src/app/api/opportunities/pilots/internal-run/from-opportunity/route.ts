import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createRuntimeServiceRoleClient } from '@/lib/supabase/service-role'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'
import { createSupabaseAgentRuntimeRepository } from '@/lib/supabase-agent-runtime-repository'
import { runSourceBoundOpportunityPilot } from '@/lib/opportunities/autonomy-agent-runtime'
import { verifyCanonicalPublicExcerpts } from '@/lib/opportunities/public-source-verifier'
import type { ServicePilotInput } from '@jhadina/opportunity-core'

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
  const service=await createRuntimeServiceRoleClient()
  if(!service)return NextResponse.json({ok:false,error:'Agent persistence unavailable'},{status:503})
  try {
    const stored=await createSupabaseOpportunityRepository().get(body.opportunityId)
    if(!stored||stored.userId!==user.id)return NextResponse.json({ok:false,error:'Opportunity not found'},{status:404})
    const now=new Date().toISOString()
    const verified=await verifyCanonicalPublicExcerpts({
      opportunity:stored.opportunity,
      allowedHosts:(process.env.OCE_RESEARCH_ALLOWED_HOSTS??'').split(','),
      now,
    })
    if(verified.blockers.length || verified.observations.length<2) {
      return NextResponse.json({
        ok:false,
        blockers:[...verified.blockers,
          ...(verified.observations.length<2?['At least two actual attributable public source matches required']:[])],
        externalActionAuthorized:false,
      },{status:409,headers:{'cache-control':'no-store'}})
    }
    const observations=verified.observations
    const evidence=stored.opportunity.evidence
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
      sourceReceipts:verified.sourceReceipts,
      repository:createSupabaseAgentRuntimeRepository(service),
    })
    return NextResponse.json({ok:result.accepted,...result,sourceRecordsConsidered:observations.length,
      actualSourceMatchReceipts:verified.sourceReceipts,
      persistedReportSha256:result.accepted ? result.reportSha256 : null,
      independentVerificationCompleted:false,externalActionAuthorized:false},{
      status:result.accepted?201:409,headers:{'cache-control':'no-store'},
    })
  }catch(cause){
    return NextResponse.json({ok:false,error:cause instanceof Error?cause.message:'Pilot blocked'},{status:409,headers:{'cache-control':'no-store'}})
  }
}
