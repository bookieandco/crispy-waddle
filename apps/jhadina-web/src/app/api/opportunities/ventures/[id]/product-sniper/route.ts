import { NextResponse } from 'next/server'
import type { SearchCommerceProductSniperCandidateInput } from '@jhadina/opportunity-core'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { VentureRuntimeRepository } from '@/lib/opportunities/venture-runtime-repository'
import { runSearchCommerceProductSniperRuntime } from '@/lib/opportunities/search-commerce-product-sniper-runtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type CandidateInput = Omit<
  SearchCommerceProductSniperCandidateInput,
  'ventureId' | 'family' | 'evaluatedAt' | 'learningSnapshot'
>

type Body = {
  candidates?: CandidateInput[]
}

export async function POST(
  request: Request,
  context: { params: { id: string } },
) {
  const requestId = crypto.randomUUID()
  try {
    const identity = await requireRequestIdentity()
    const body = await request.json().catch(() => ({})) as Body
    if (!Array.isArray(body.candidates) || body.candidates.length === 0) {
      return NextResponse.json(
        { ok: false, requestId, error: 'candidates are required' },
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

    const result = await runSearchCommerceProductSniperRuntime(service, {
      ownerUserId: identity.userId,
      opportunityId: venture.opportunityId,
      candidates: body.candidates,
      evaluatedAt: new Date().toISOString(),
    })

    return NextResponse.json(
      { ok: true, requestId, result },
      { status: 201, headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'product_sniper_failed'
    const status = /Authenticated|identity|session/i.test(message)
      ? 401
      : /NOT_FOUND/.test(message)
        ? 404
        : /MISMATCH|BLOCK|SUPPORTED|REQUIRED/.test(message)
          ? 409
          : 400
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status, headers: { 'cache-control': 'no-store' } },
    )
  }
}
