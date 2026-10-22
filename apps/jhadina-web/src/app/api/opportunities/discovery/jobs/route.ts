import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'
import { discoverPublicBoard, type PublicBoardSource } from '@/lib/opportunities/public-job-board'
import { assessAutonomyCapability } from '@jhadina/opportunity-core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Owner-triggered discovery only. Import published listings; never apply or message a company. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ ok:false, error:'Authentication required' },{ status:401 })
  const body = await request.json().catch(() => null) as { source?: PublicBoardSource; board?: string } | null
  if (!body || !['greenhouse','lever'].includes(body.source ?? '') || typeof body.board !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,49}$/i.test(body.board)) {
    return NextResponse.json({ ok:false,error:'Use a valid Greenhouse or Lever company board token' },{ status:400 })
  }
  try {
    const discovery = await discoverPublicBoard({ source:body.source!,board:body.board,limit:25 })
    const repository = createSupabaseOpportunityRepository()
    const stored = []
    for (const opportunity of discovery.opportunities) {
      // Canonical owner-scoped RPC handles stable ID and replay. Never force triage/approval.
      stored.push(await repository.upsert(user.id, opportunity))
    }
    const decision = assessAutonomyCapability({
      capability:'job_application',
      executor:'unverified',
      providerPermission:'unknown',
      evidenceRefs:[discovery.sourceUrl],
    })
    return NextResponse.json({
      ok:true, imported:stored.length, discovered:discovery.opportunities.length,
      sourceUrl:discovery.sourceUrl,capturedAt:discovery.capturedAt,
      ids:stored.map(x=>x.opportunity.id), action:'RESEARCH_ONLY',
      applicationAuthorized:decision.canPerformExternalAction,
      limits:['Public jobs are not verified employer offers','Eligibility and AI-use rules require independent review','No job applications are submitted'],
    },{ headers:{ 'cache-control':'no-store' } })
  } catch (cause) {
    return NextResponse.json({
      ok:false,error:cause instanceof Error ? cause.message : 'Public board import unavailable',
      outcome:'FAIL_CLOSED_NO_APPLICATION',
    },{ status:502,headers:{ 'cache-control':'no-store' } })
  }
}
