import { NextResponse } from 'next/server'
import type { buildSearchCommerceProductTruthSnapshot } from '@jhadina/opportunity-core'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { VentureRuntimeRepository } from '@/lib/opportunities/venture-runtime-repository'
import { recordSearchCommerceProductTruthRuntime } from '@/lib/opportunities/search-commerce-product-truth-runtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ProductTruthInput = Omit<
  Parameters<typeof buildSearchCommerceProductTruthSnapshot>[0],
  'ventureId' | 'opportunityId' | 'family'
>

type Body = {
  productTruth?: ProductTruthInput
}

export async function POST(
  request: Request,
  context: { params: { id: string } },
) {
  const requestId = crypto.randomUUID()
  try {
    const identity = await requireRequestIdentity()
    const body = await request.json().catch(() => ({})) as Body
    if (!body.productTruth) {
      return NextResponse.json(
        { ok: false, requestId, error: 'productTruth is required' },
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

    const ventureRepository = new VentureRuntimeRepository(service)
    const venture = await ventureRepository.getVenture(identity.userId, context.params.id)
    if (!venture) {
      return NextResponse.json(
        { ok: false, requestId, error: 'Venture not found' },
        { status: 404, headers: { 'cache-control': 'no-store' } },
      )
    }

    const result = await recordSearchCommerceProductTruthRuntime(service, {
      ownerUserId: identity.userId,
      opportunityId: venture.opportunityId,
      productTruth: body.productTruth,
    })

    return NextResponse.json(
      { ok: true, requestId, result },
      { status: 201, headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'product_truth_failed'
    const status = /Authenticated|identity|session/i.test(message)
      ? 401
      : /NOT_FOUND/.test(message)
        ? 404
        : /MISMATCH|SUPPORTED|REQUIRED/.test(message)
          ? 409
          : 400
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status, headers: { 'cache-control': 'no-store' } },
    )
  }
}
