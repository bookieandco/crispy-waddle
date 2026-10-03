import { NextResponse } from 'next/server'
import {
  buildSideHustleServiceWorkOrderDraft,
  type CommercialWorkOrderPriceCadence,
} from '@jhadina/opportunity-core'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'
import { createSideHustleCommercialWorkOrderRuntime } from '@/lib/opportunities/side-hustle-commercial-runtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type CreateBody = {
  id?: string
  ventureId?: string
  customerRef?: string
  title?: string
  outcomePromise?: string
  price?: {
    amount: number
    currency: string
    cadence: CommercialWorkOrderPriceCadence
  }
  evidenceRefs?: string[]
  createdAt?: string
}

function statusFor(message: string): number {
  if (/Authenticated|identity|session/i.test(message)) return 401
  if (/not found|NOT_FOUND/i.test(message)) return 404
  if (/does not use|requires|Capability-only|eligible|invalid|mismatch/i.test(message)) return 409
  return 400
}

export async function POST(
  request: Request,
  context: { params: { id: string } },
) {
  const requestId = crypto.randomUUID()
  try {
    await requireRequestIdentity()
    const body = await request.json().catch(() => ({})) as CreateBody
    if (
      !body.id?.trim() ||
      !body.customerRef?.trim() ||
      !body.price ||
      !body.evidenceRefs?.length
    ) {
      return NextResponse.json(
        { ok: false, requestId, error: 'Templated commercial work order fields are incomplete' },
        { status: 400, headers: { 'cache-control': 'no-store' } },
      )
    }

    const repository = createSupabaseOpportunityRepository()
    const stored = await repository.get(context.params.id)
    if (!stored) {
      return NextResponse.json(
        { ok: false, requestId, error: 'Opportunity not found' },
        { status: 404, headers: { 'cache-control': 'no-store' } },
      )
    }

    const draft = buildSideHustleServiceWorkOrderDraft({
      opportunity: stored.opportunity,
      id: body.id,
      ventureId: body.ventureId,
      customerRef: body.customerRef,
      title: body.title,
      outcomePromise: body.outcomePromise,
      price: body.price,
      evidenceRefs: body.evidenceRefs,
      createdAt: body.createdAt,
    })

    const workOrder = await createSideHustleCommercialWorkOrderRuntime({
      opportunityId: context.params.id,
      id: draft.id,
      ventureId: draft.ventureId,
      customerRef: draft.customerRef,
      title: draft.title,
      outcomePromise: draft.outcomePromise,
      scopeItems: draft.scopeItems,
      acceptanceCriteria: draft.acceptanceCriteria,
      price: draft.price,
      evidenceRefs: draft.evidenceRefs,
      createdAt: draft.createdAt,
    }, repository)

    return NextResponse.json(
      {
        ok: true,
        requestId,
        workOrder,
        templateApplied: true,
        externalActionAuthorized: false,
        paymentAuthorized: false,
        signatureAuthorized: false,
      },
      { status: 201, headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create templated commercial work order'
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: statusFor(message), headers: { 'cache-control': 'no-store' } },
    )
  }
}
