import { NextResponse } from 'next/server'
import type { SideHustleMaturityEvidence } from '@jhadina/opportunity-core'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'
import { VentureRuntimeRepository } from '@/lib/opportunities/venture-runtime-repository'
import { runSideHustleLabOutcomeLearningRuntime } from '@/lib/opportunities/side-hustle-lab-runtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Controls = Omit<SideHustleMaturityEvidence, 'validationRecords' | 'outcomes'>

type Body = {
  outcomeId?: string
  controls?: Controls
}

function statusFor(message: string): number {
  if (/Authenticated|identity|session/i.test(message)) return 401
  if (/NOT_FOUND/.test(message)) return 404
  if (/REQUIRES|MISMATCH|NOT_ADMITTED|VALIDATION|OUTCOME_/.test(message)) return 409
  return 400
}

export async function POST(
  request: Request,
  context: { params: { id: string } },
) {
  const requestId = crypto.randomUUID()
  try {
    const identity = await requireRequestIdentity()
    const body = await request.json().catch(() => ({})) as Body
    const outcomeId = body.outcomeId?.trim() ?? ''
    if (!outcomeId) {
      return NextResponse.json(
        { ok: false, requestId, error: 'outcomeId is required' },
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

    const result = await runSideHustleLabOutcomeLearningRuntime({
      ownerUserId: identity.userId,
      ventureId: context.params.id,
      outcomeId,
      assessedAt: new Date().toISOString(),
      controls: body.controls,
    }, {
      opportunities: createSupabaseOpportunityRepository(),
      ventures: new VentureRuntimeRepository(service),
    })

    return NextResponse.json({
      ok: true,
      requestId,
      ...result,
    }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'side_hustle_lab_outcome_learning_failed'
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: statusFor(message), headers: { 'cache-control': 'no-store' } },
    )
  }
}
