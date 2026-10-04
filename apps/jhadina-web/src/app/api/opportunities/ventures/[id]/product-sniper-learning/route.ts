import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { recordSearchCommerceProductSniperOutcomeLearning } from '@/lib/opportunities/search-commerce-product-sniper-learning-runtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  candidateId?: string
  productType?: string
  marketMechanic?: string
  targetChannels?: string[]
  outcomeId?: string
  bindingEvidenceRefs?: string[]
  experimentId?: string
}

export async function POST(
  request: Request,
  context: { params: { id: string } },
) {
  const requestId = crypto.randomUUID()
  try {
    const identity = await requireRequestIdentity()
    const body = await request.json().catch(() => ({})) as Body
    const service = createServiceRoleClient()
    if (!service) {
      return NextResponse.json(
        { ok: false, requestId, error: 'venture_runtime_unavailable' },
        { status: 503, headers: { 'cache-control': 'no-store' } },
      )
    }

    const result = await recordSearchCommerceProductSniperOutcomeLearning(service, {
      ownerUserId: identity.userId,
      opportunityId: context.params.id,
      candidateId: body.candidateId?.trim() ?? '',
      productType: body.productType?.trim() ?? '',
      marketMechanic: body.marketMechanic?.trim() ?? '',
      targetChannels: body.targetChannels ?? [],
      outcomeId: body.outcomeId?.trim() ?? '',
      bindingEvidenceRefs: body.bindingEvidenceRefs ?? [],
      experimentId: body.experimentId?.trim() || undefined,
      observedAt: new Date().toISOString(),
    })

    return NextResponse.json(
      { ok: true, requestId, result },
      { status: 201, headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'product_sniper_learning_failed'
    const status = /Authenticated|identity|session/i.test(message)
      ? 401
      : /NOT_FOUND/.test(message)
        ? 404
        : /MISMATCH|REQUIRES|COMPLETED|REQUIRED|SUPPORTED/.test(message)
          ? 409
          : 400
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status, headers: { 'cache-control': 'no-store' } },
    )
  }
}
