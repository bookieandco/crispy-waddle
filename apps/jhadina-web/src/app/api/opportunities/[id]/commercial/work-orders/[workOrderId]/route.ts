import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'
import {
  buildSideHustleCommercialRoutingRuntime,
  linkSideHustleCommercialOutcomeRuntime,
  lockSideHustleCommercialScopeRuntime,
  recordSideHustleCommercialAcceptanceRuntime,
  recordSideHustleCommercialDeliveryRuntime,
  recordSideHustleCommercialDeliveryStartRuntime,
} from '@/lib/opportunities/side-hustle-commercial-runtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  action?: 'lock_scope' | 'routing' | 'delivery_start' | 'delivery' | 'acceptance' | 'link_outcome'
  evidenceRefs?: string[]
  recordedAt?: string

  ownerAssignments?: Array<{
    executionOwner: string
    scopeItemIds: string[]
    evidenceRefs: string[]
    role?: 'lead' | 'support'
  }>

  receiptId?: string
  executionOwner?: string
  executionRef?: string
  startReceiptId?: string
  deliveryReceiptId?: string
  deliveryRef?: string
  deliverableRefs?: string[]
  customerRef?: string
  decision?: 'accepted' | 'revision_required' | 'rejected'
  criteriaMet?: string[]
  criteriaMissed?: string[]
  note?: string
  acceptanceReceiptId?: string
  outcomeId?: string
}

function statusFor(message: string): number {
  if (/Authenticated|identity|session/i.test(message)) return 401
  if (/NOT_FOUND/.test(message)) return 404
  if (/mismatch|requires|only|cannot|unknown|invalid|not registered/i.test(message)) return 409
  return 400
}

export async function GET(
  _request: Request,
  context: { params: { id: string; workOrderId: string } },
) {
  const requestId = crypto.randomUUID()
  try {
    await requireRequestIdentity()
    const repository = createSupabaseOpportunityRepository()
    const workOrder = await repository.getSideHustleCommercialWorkOrder(context.params.workOrderId)
    if (!workOrder || workOrder.opportunityId !== context.params.id) {
      return NextResponse.json(
        { ok: false, requestId, error: 'Commercial work order not found' },
        { status: 404, headers: { 'cache-control': 'no-store' } },
      )
    }
    const receipts = await repository.listSideHustleCommercialReceipts({
      workOrderId: workOrder.id,
    })
    return NextResponse.json(
      { ok: true, requestId, workOrder, receipts },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load commercial work order'
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: statusFor(message), headers: { 'cache-control': 'no-store' } },
    )
  }
}

export async function POST(
  request: Request,
  context: { params: { id: string; workOrderId: string } },
) {
  const requestId = crypto.randomUUID()
  try {
    await requireRequestIdentity()
    const body = await request.json().catch(() => ({})) as Body
    if (!body.action) {
      return NextResponse.json(
        { ok: false, requestId, error: 'action is required' },
        { status: 400, headers: { 'cache-control': 'no-store' } },
      )
    }

    const repository = createSupabaseOpportunityRepository()
    const existing = await repository.getSideHustleCommercialWorkOrder(context.params.workOrderId)
    if (!existing || existing.opportunityId !== context.params.id) {
      return NextResponse.json(
        { ok: false, requestId, error: 'Commercial work order not found' },
        { status: 404, headers: { 'cache-control': 'no-store' } },
      )
    }

    let result: unknown
    switch (body.action) {
      case 'lock_scope':
        result = await lockSideHustleCommercialScopeRuntime({
          workOrderId: existing.id,
          evidenceRefs: body.evidenceRefs ?? [],
          lockedAt: body.recordedAt,
        }, repository)
        break

      case 'routing':
        result = await buildSideHustleCommercialRoutingRuntime({
          workOrderId: existing.id,
          ownerAssignments: body.ownerAssignments,
          evidenceRefs: body.evidenceRefs ?? [],
          createdAt: body.recordedAt,
        }, repository)
        break

      case 'delivery_start':
        result = await recordSideHustleCommercialDeliveryStartRuntime({
          workOrderId: existing.id,
          receiptId: body.receiptId ?? '',
          executionOwner: body.executionOwner ?? '',
          executionRef: body.executionRef ?? '',
          evidenceRefs: body.evidenceRefs ?? [],
          startedAt: body.recordedAt,
        }, repository)
        break

      case 'delivery':
        result = await recordSideHustleCommercialDeliveryRuntime({
          workOrderId: existing.id,
          startReceiptId: body.startReceiptId ?? '',
          receiptId: body.receiptId ?? '',
          deliveryRef: body.deliveryRef ?? '',
          deliverableRefs: body.deliverableRefs ?? [],
          evidenceRefs: body.evidenceRefs ?? [],
          deliveredAt: body.recordedAt,
        }, repository)
        break

      case 'acceptance':
        result = await recordSideHustleCommercialAcceptanceRuntime({
          workOrderId: existing.id,
          deliveryReceiptId: body.deliveryReceiptId ?? '',
          receiptId: body.receiptId ?? '',
          customerRef: body.customerRef ?? '',
          decision: body.decision ?? 'rejected',
          criteriaMet: body.criteriaMet ?? [],
          criteriaMissed: body.criteriaMissed ?? [],
          evidenceRefs: body.evidenceRefs ?? [],
          note: body.note,
          observedAt: body.recordedAt,
        }, repository)
        break

      case 'link_outcome':
        result = await linkSideHustleCommercialOutcomeRuntime({
          workOrderId: existing.id,
          acceptanceReceiptId: body.acceptanceReceiptId ?? '',
          outcomeId: body.outcomeId ?? '',
          receiptId: body.receiptId,
          recordedAt: body.recordedAt,
        }, repository)
        break
    }

    return NextResponse.json(
      {
        ok: true,
        requestId,
        action: body.action,
        result,
        externalActionAuthorized: false,
        moneyMovementAuthorized: false,
        automaticMaturityPromotionAuthorized: false,
      },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update commercial work order'
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: statusFor(message), headers: { 'cache-control': 'no-store' } },
    )
  }
}
