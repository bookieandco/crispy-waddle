import { NextResponse } from 'next/server'
import type { SideHustleExperimentCriterion } from '@jhadina/opportunity-core'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'
import { VentureRuntimeRepository } from '@/lib/opportunities/venture-runtime-repository'
import { createVentureBoundedExperiment } from '@/lib/opportunities/venture-experiment-runtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  hypothesis?: string
  targetCustomer?: string
  offer?: string
  channel?: string
  maxSpend?: number
  currency?: string
  maxHours?: number
  maxDurationDays?: number
  minimumObservations?: number
  successCriteria?: SideHustleExperimentCriterion[]
  killCriteria?: SideHustleExperimentCriterion[]
  evidenceRefs?: string[]
}

export async function POST(
  request: Request,
  context: { params: { id: string } },
) {
  const requestId = crypto.randomUUID()
  try {
    const identity = await requireRequestIdentity()
    const service = createServiceRoleClient()
    if (!service) return NextResponse.json({ ok: false, requestId, error: 'venture_runtime_unavailable' }, { status: 503 })

    const ventureRepository = new VentureRuntimeRepository(service)
    const venture = await ventureRepository.getVenture(identity.userId, context.params.id)
    if (!venture) return NextResponse.json({ ok: false, requestId, error: 'Venture not found' }, { status: 404 })

    const opportunityRepository = createSupabaseOpportunityRepository()
    const stored = await opportunityRepository.get(venture.opportunityId)
    if (!stored) return NextResponse.json({ ok: false, requestId, error: 'Opportunity not found' }, { status: 404 })

    const body = await request.json().catch(() => ({})) as Body
    const result = await createVentureBoundedExperiment({
      venture,
      opportunity: stored.opportunity,
      hypothesis: body.hypothesis ?? '',
      targetCustomer: body.targetCustomer ?? '',
      offer: body.offer ?? '',
      channel: body.channel ?? '',
      maxSpend: body.maxSpend ?? Number.NaN,
      currency: body.currency ?? 'USD',
      maxHours: body.maxHours ?? Number.NaN,
      maxDurationDays: body.maxDurationDays ?? Number.NaN,
      minimumObservations: body.minimumObservations ?? Number.NaN,
      successCriteria: body.successCriteria ?? [],
      killCriteria: body.killCriteria ?? [],
      evidenceRefs: body.evidenceRefs ?? [],
    }, opportunityRepository)

    await ventureRepository.recordReceipt({
      id: `venture-experiment-bridge:${result.experiment.id}`,
      ownerUserId: identity.userId,
      ventureId: venture.id,
      kind: 'experiment_bridge',
      evidenceRefs: result.experiment.evidenceRefs,
      payload: {
        experimentId: result.experiment.id,
        proposal: result.proposal,
        started: false,
        authorizationEffect: 'NONE',
      },
      recordedAt: result.experiment.createdAt,
    })

    return NextResponse.json({
      ok: true,
      requestId,
      ...result,
      externalActionAuthorized: false,
    }, { status: 201, headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'venture_experiment_create_failed'
    const auth = /Authenticated|identity|session/i.test(message)
    return NextResponse.json(
      { ok: false, requestId, error: auth ? 'Authentication required' : message },
      { status: auth ? 401 : 400, headers: { 'cache-control': 'no-store' } },
    )
  }
}
