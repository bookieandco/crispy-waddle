import { NextResponse } from 'next/server'
import type { SideHustleLabResearchSynthesis } from '@jhadina/opportunity-core'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'
import { VentureRuntimeRepository } from '@/lib/opportunities/venture-runtime-repository'
import { completeSideHustleLabResearchRuntime } from '@/lib/opportunities/side-hustle-lab-runtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  opportunityId?: string
  synthesis?: SideHustleLabResearchSynthesis
}

function statusFor(message: string): number {
  if (/Authenticated|identity|session/i.test(message)) return 401
  if (/NOT_FOUND/.test(message)) return 404
  if (/REQUIRES|MISMATCH|INCOMPLETE|NOT_PERSISTED|NOT_ADMITTED|BLOCKED|SIGNAL_/.test(message)) return 409
  return 400
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  try {
    const identity = await requireRequestIdentity()
    const body = await request.json().catch(() => ({})) as Body
    const opportunityId = body.opportunityId?.trim() ?? ''
    if (!opportunityId || !body.synthesis) {
      return NextResponse.json(
        { ok: false, requestId, error: 'opportunityId and synthesis are required' },
        { status: 400, headers: { 'cache-control': 'no-store' } },
      )
    }

    const service = createServiceRoleClient()
    if (!service) {
      return NextResponse.json(
        { ok: false, requestId, error: 'venture_runtime_unavailable' },
        { status: 503, headers: { 'cache-control': 'no-store' } },
      )
    }

    const result = await completeSideHustleLabResearchRuntime({
      ownerUserId: identity.userId,
      opportunityId,
      synthesis: body.synthesis,
      admittedAt: new Date().toISOString(),
    }, {
      opportunities: createSupabaseOpportunityRepository(),
      ventures: new VentureRuntimeRepository(service),
    })

    return NextResponse.json({
      ok: true,
      requestId,
      ...result,
    }, { status: 201, headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'side_hustle_lab_research_complete_failed'
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: statusFor(message), headers: { 'cache-control': 'no-store' } },
    )
  }
}
