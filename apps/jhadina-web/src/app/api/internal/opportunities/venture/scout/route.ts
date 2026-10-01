import { NextRequest, NextResponse } from 'next/server'
import { authorizedSchedulerRequest } from '@/lib/internal-scheduler-auth'
import { createSchedulerServiceRoleClient } from '@/lib/supabase/service-role'
import { runVentureMarketScout } from '@/lib/opportunities/venture-market-scout-runtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  if (!(await authorizedSchedulerRequest(request))) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const client = createSchedulerServiceRoleClient(request)
  if (!client) return NextResponse.json({ ok: false, error: 'venture_runtime_persistence_unavailable' }, { status: 503 })
  try {
    const result = await runVentureMarketScout(client)
    return NextResponse.json(
      { ok: result.status === 'PROCESSED', result },
      { status: result.status === 'PROCESSED' ? 200 : 503, headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'venture_market_scout_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 502, headers: { 'cache-control': 'no-store' } })
  }
}
