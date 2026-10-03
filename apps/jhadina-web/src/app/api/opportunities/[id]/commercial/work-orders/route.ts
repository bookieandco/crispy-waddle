import { NextResponse } from 'next/server'
import type {
  CommercialWorkOrderAcceptanceCriterion,
  CommercialWorkOrderPriceCadence,
  CommercialWorkOrderScopeItem,
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
  scopeItems?: CommercialWorkOrderScopeItem[]
  acceptanceCriteria?: CommercialWorkOrderAcceptanceCriterion[]
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
  if (/NOT_FOUND/.test(message)) return 404
  if (/requires|Capability-only|eligible|invalid|mismatch/i.test(message)) return 409
  return 400
}

export async function GET(
  _request: Request,
  context: { params: { id: string } },
) {
  const requestId = crypto.randomUUID()
  try {
    await requireRequestIdentity()
    const repository = createSupabaseOpportunityRepository()
    const opportunity = await repository.get(context.params.id)
    if (!opportunity) {
      return NextResponse.json(
        { ok: false, requestId, error: 'Opportunity not found' },
        { status: 404, headers: { 'cache-control': 'no-store' } },
      )
    }
    const workOrders = await repository.listSideHustleCommercialWorkOrders(context.params.id)
    return NextResponse.json(
      { ok: true, requestId, workOrders },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to list commercial work orders'
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: statusFor(message), headers: { 'cache-control': 'no-store' } },
    )
  }
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
      !body.title?.trim() ||
      !body.outcomePromise?.trim() ||
      !body.scopeItems?.length ||
      !body.acceptanceCriteria?.length ||
      !body.price ||
      !body.evidenceRefs?.length
    ) {
      return NextResponse.json(
        { ok: false, requestId, error: 'Commercial work order fields are incomplete' },
        { status: 400, headers: { 'cache-control': 'no-store' } },
      )
    }

    const workOrder = await createSideHustleCommercialWorkOrderRuntime({
      opportunityId: context.params.id,
      id: body.id,
      ventureId: body.ventureId,
      customerRef: body.customerRef,
      title: body.title,
      outcomePromise: body.outcomePromise,
      scopeItems: body.scopeItems,
      acceptanceCriteria: body.acceptanceCriteria,
      price: body.price,
      evidenceRefs: body.evidenceRefs,
      createdAt: body.createdAt,
    }, createSupabaseOpportunityRepository())

    return NextResponse.json(
      {
        ok: true,
        requestId,
        workOrder,
        externalActionAuthorized: false,
        paymentAuthorized: false,
        signatureAuthorized: false,
      },
      { status: 201, headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create commercial work order'
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: statusFor(message), headers: { 'cache-control': 'no-store' } },
    )
  }
}
