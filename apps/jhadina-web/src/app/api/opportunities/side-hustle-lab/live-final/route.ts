import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'
import { VentureRuntimeRepository } from '@/lib/opportunities/venture-runtime-repository'
import { certifySideHustleLiveFinalRuntime } from '@/lib/opportunities/side-hustle-lab-runtime'

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

    const result = await certifySideHustleLiveFinalRuntime({
      ownerUserId: identity.userId,
      certifiedAt: new Date().toISOString(),
    }, {
      opportunities: createSupabaseOpportunityRepository(),
      ventures: new VentureRuntimeRepository(service),
    })

    return NextResponse.json({
      ok: true,
      requestId,
      ...result,
    }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'side_hustle_live_final_failed'
    const auth = /Authenticated|identity|session/i.test(message)
    return NextResponse.json(
      { ok: false, requestId, error: auth ? 'Authentication required' : message },
      { status: auth ? 401 : 400, headers: { 'cache-control': 'no-store' } },
    )
  }
}
