import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { buildVentureHqProjection } from '@/lib/opportunities/venture-hq-runtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const requestId = crypto.randomUUID()
  try {
    const identity = await requireRequestIdentity()
    const service = createServiceRoleClient()
    if (!service) return NextResponse.json({ ok: false, requestId, error: 'venture_runtime_unavailable' }, { status: 503 })
    const result = await buildVentureHqProjection(service, identity.userId)
    return NextResponse.json({
      ok: true,
      requestId,
      ...result,
      visualRenderingImplemented: false,
    }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'venture_hq_projection_failed'
    const auth = /Authenticated|identity|session/i.test(message)
    return NextResponse.json(
      { ok: false, requestId, error: auth ? 'Authentication required' : message },
      { status: auth ? 401 : 502, headers: { 'cache-control': 'no-store' } },
    )
  }
}
