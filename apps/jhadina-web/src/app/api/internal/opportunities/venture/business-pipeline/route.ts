import { NextRequest, NextResponse } from 'next/server'
import { authorizedSchedulerRequest } from '@/lib/internal-scheduler-auth'
import { createSchedulerServiceRoleClient } from '@/lib/supabase/service-role'
import { runVentureSearchCommerceBusinessCycle } from '@/lib/opportunities/venture-search-commerce-business-cycle'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  if (!(await authorizedSchedulerRequest(request))) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const client = createSchedulerServiceRoleClient(request)
  if (!client) {
    return NextResponse.json(
      { ok: false, error: 'search_commerce_business_cycle_persistence_unavailable' },
      { status: 503 },
    )
  }

  try {
    const result = await runVentureSearchCommerceBusinessCycle(client)
    return NextResponse.json(
      { ok: true, result },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'search_commerce_business_cycle_failed'
    return NextResponse.json(
      { ok: false, error: message },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    )
  }
}
