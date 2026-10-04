import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { VentureRuntimeRepository } from '@/lib/opportunities/venture-runtime-repository'
import { captureSearchCommerceProductPublicationRuntime } from '@/lib/opportunities/search-commerce-product-publication-runtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  candidateId?: string
  productRef?: string
  outboxId?: string
}

export async function POST(request: Request, context: { params: { id: string } }) {
  const requestId = crypto.randomUUID()
  try {
    const identity = await requireRequestIdentity()
    const body = await request.json().catch(() => ({})) as Body
    const service = createServiceRoleClient()
    if (!service) {
      return NextResponse.json({ ok: false, requestId, error: 'venture_runtime_unavailable' }, { status: 503 })
    }

    const ventures = new VentureRuntimeRepository(service)
    const venture = await ventures.getVenture(identity.userId, context.params.id)
    if (!venture) {
      return NextResponse.json({ ok: false, requestId, error: 'Venture not found' }, { status: 404 })
    }

    const result = await captureSearchCommerceProductPublicationRuntime(service, {
      ownerUserId: identity.userId,
      opportunityId: venture.opportunityId,
      candidateId: body.candidateId?.trim() ?? '',
      productRef: body.productRef?.trim() ?? '',
      outboxId: body.outboxId?.trim() ?? '',
      observedAt: new Date().toISOString(),
    })

    return NextResponse.json(
      { ok: true, requestId, result },
      { status: 201, headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'product_publication_capture_failed'
    const status = /Authenticated|identity|session/i.test(message)
      ? 401
      : /NOT_FOUND/.test(message)
        ? 404
        : /MISMATCH|SUPPORTED|REQUIRED|NOT_DELIVERED/.test(message)
          ? 409
          : 400

    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status, headers: { 'cache-control': 'no-store' } },
    )
  }
}
