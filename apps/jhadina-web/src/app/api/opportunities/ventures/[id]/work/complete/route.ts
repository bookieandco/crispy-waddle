import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { completeSearchCommerceBusinessWork } from '@/lib/opportunities/venture-search-commerce-work-completion'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  workItemId?: string
  evidenceRefs?: string[]
  outputRefs?: string[]
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

    const result = await completeSearchCommerceBusinessWork(service, {
      ownerUserId: identity.userId,
      ventureId: context.params.id,
      workItemId: body.workItemId?.trim() ?? '',
      completedAt: new Date().toISOString(),
      evidenceRefs: body.evidenceRefs ?? [],
      outputRefs: body.outputRefs ?? [],
    })

    return NextResponse.json(
      { ok: true, requestId, result },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'search_commerce_work_complete_failed'
    const status = /Authenticated|identity|session/i.test(message)
      ? 401
      : /NOT_FOUND/.test(message)
        ? 404
        : /MISMATCH|SUPERSEDED|FAILED|COMPLETED|REQUIRED/.test(message)
          ? 409
          : 400
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status, headers: { 'cache-control': 'no-store' } },
    )
  }
}
