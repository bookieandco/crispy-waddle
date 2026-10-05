import { NextRequest, NextResponse } from 'next/server'
import { authorizedSchedulerRequest } from '@/lib/internal-scheduler-auth'
import { createSchedulerServiceRoleClient } from '@/lib/supabase/service-role'
import { runPupsonBusinessFactorySourceSync } from '@/lib/opportunities/search-commerce-pupson-source-runtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  if (!(await authorizedSchedulerRequest(request))) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const client = createSchedulerServiceRoleClient(request)
  if (!client) {
    return NextResponse.json(
      { ok: false, error: 'pupson_business_factory_persistence_unavailable' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    )
  }

  try {
    const result = await runPupsonBusinessFactorySourceSync(client)
    const status = result.status === 'PASS' ? 200 : 502
    return NextResponse.json(
      { ok: result.status === 'PASS', result },
      { status, headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'pupson_business_factory_sync_failed'
    return NextResponse.json(
      { ok: false, error: message },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    )
  }
}
