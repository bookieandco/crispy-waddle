import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { VentureRuntimeRepository } from '@/lib/opportunities/venture-runtime-repository'
import { projectSideHustleLabPortfolioRuntime } from '@/lib/opportunities/side-hustle-lab-runtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  const requestId = crypto.randomUUID()
  try {
    const identity = await requireRequestIdentity()
    const service = createServiceRoleClient()
    if (!service) {
      return NextResponse.json(
        { ok: false, requestId, error: 'venture_runtime_unavailable' },
        { status: 503, headers: { 'cache-control': 'no-store' } },
      )
    }

    const projection = await projectSideHustleLabPortfolioRuntime({
      ownerUserId: identity.userId,
      generatedAt: new Date().toISOString(),
    }, new VentureRuntimeRepository(service))

    return NextResponse.json({
      ok: true,
      requestId,
      projection,
      externalActionAuthorized: false,
      moneyMovementAuthorized: false,
    }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'side_hustle_lab_projection_failed'
    const auth = /Authenticated|identity|session/i.test(message)
    return NextResponse.json(
      { ok: false, requestId, error: auth ? 'Authentication required' : message },
      { status: auth ? 401 : 400, headers: { 'cache-control': 'no-store' } },
    )
  }
}
