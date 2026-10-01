import { NextRequest, NextResponse } from 'next/server'
import { authorizedSchedulerRequest } from '@/lib/internal-scheduler-auth'
import { createSchedulerServiceRoleClient } from '@/lib/supabase/service-role'
import { runVentureSupervisorBatch } from '@/lib/opportunities/venture-supervisor-runtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  if (!(await authorizedSchedulerRequest(request))) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const client = createSchedulerServiceRoleClient(request)
  if (!client) return NextResponse.json({ ok: false, error: 'venture_runtime_persistence_unavailable' }, { status: 503 })
  try {
    const result = await runVentureSupervisorBatch(client)
    return NextResponse.json({ ok: true, result }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'venture_supervisor_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 502, headers: { 'cache-control': 'no-store' } })
  }
}
