import { NextResponse } from 'next/server'
import type { SideHustleExperimentCriterion } from '@jhadina/opportunity-core'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'
import { VentureRuntimeRepository } from '@/lib/opportunities/venture-runtime-repository'
import { createVentureBoundedExperiment } from '@/lib/opportunities/venture-experiment-runtime'
import { requireEligibleSideHustleLabValidationAdmission } from '@/lib/opportunities/side-hustle-lab-runtime'

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
    if (stored.opportunity.status !== 'ready') {
      return NextResponse.json({ ok: false, requestId, error: 'SIDE_HUSTLE_LAB_VALIDATION_REQUIRES_READY_OPPORTUNITY' }, { status: 409 })
    }
    if (venture.lifecycle !== 'researched') {
      return NextResponse.json({ ok: false, requestId, error: 'SIDE_HUSTLE_LAB_VALIDATION_REQUIRES_RESEARCHED_VENTURE' }, { status: 409 })
    }

    const persistedAdmission = await requireEligibleSideHustleLabValidationAdmission({
      ownerUserId: identity.userId,
      ventureId: venture.id,
      opportunityId: stored.opportunity.id,
    }, ventureRepository)
    const admittedProposal = persistedAdmission.admission.proposal!

    const body = await request.json().catch(() => ({})) as Body
    const maxSpend = body.maxSpend ?? admittedProposal.maxSpend
    const maxHours = body.maxHours ?? admittedProposal.maxHours
    const maxDurationDays = body.maxDurationDays ?? admittedProposal.maxDurationDays
    const minimumObservations = body.minimumObservations ?? admittedProposal.minimumObservations
    if (maxSpend > admittedProposal.maxSpend) throw new Error('SIDE_HUSTLE_LAB_EXPERIMENT_SPEND_EXCEEDS_ADMITTED_BOUND')
    if (maxHours > admittedProposal.maxHours) throw new Error('SIDE_HUSTLE_LAB_EXPERIMENT_HOURS_EXCEED_ADMITTED_BOUND')
    if (maxDurationDays > admittedProposal.maxDurationDays) throw new Error('SIDE_HUSTLE_LAB_EXPERIMENT_DURATION_EXCEEDS_ADMITTED_BOUND')
    if (minimumObservations < admittedProposal.minimumObservations) throw new Error('SIDE_HUSTLE_LAB_EXPERIMENT_OBSERVATIONS_BELOW_ADMITTED_BOUND')

    const result = await createVentureBoundedExperiment({
      venture,
      opportunity: stored.opportunity,
      hypothesis: body.hypothesis?.trim() || admittedProposal.hypothesis,
      targetCustomer: body.targetCustomer?.trim() || admittedProposal.targetCustomer,
      offer: body.offer?.trim() || admittedProposal.offer,
      channel: body.channel?.trim() || admittedProposal.channel,
      maxSpend,
      currency: body.currency?.trim() || admittedProposal.currency,
      maxHours,
      maxDurationDays,
      minimumObservations,
      successCriteria: body.successCriteria?.length ? body.successCriteria : admittedProposal.successCriteria,
      killCriteria: body.killCriteria ?? admittedProposal.killCriteria,
      evidenceRefs: [...new Set([
        ...admittedProposal.evidenceRefs,
        ...(body.evidenceRefs ?? []),
      ])],
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
        validationAdmissionReceiptId: persistedAdmission.receipt.id,
        validationAdmission: persistedAdmission.admission,
        started: false,
        externalActionAuthorized: false,
        moneyMovementAuthorized: false,
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
