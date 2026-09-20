import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { runPersistedLaunchOutcomeWorker } from '@/lib/shark/launch-outcome-repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`)
}

function parseLimit(request: NextRequest): number | null {
  const raw = request.nextUrl.searchParams.get('limit')
  if (raw === null) return 500
  const value = Number(raw)
  return Number.isInteger(value) && value >= 1 && value <= 1000 ? value : null
}

async function run(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 })
  const limit = parseLimit(request)
  if (limit === null) return NextResponse.json({ ok: false, error: 'invalid_limit' }, { status: 400 })
  const client = createServiceRoleClient()
  if (!client) return NextResponse.json({ ok: false, error: 'shark_persistence_unavailable' }, { status: 503 })
  try {
    const result = await runPersistedLaunchOutcomeWorker(client, limit)
    return NextResponse.json({
      ok: true, evaluated: result.evaluated, changed: result.changed,
      unchanged: result.unchanged, unknown: result.unknown, actorHistories: result.actorHistories.length,
    })
  } catch (error) {
    console.error('SHARK launch outcome worker failed', error)
    return NextResponse.json({ ok: false, error: 'shark_launch_outcome_worker_failed', reason: 'worker_execution_failed' }, { status: 502 })
  }
}

export async function GET(request: NextRequest) { return run(request) }
export async function POST(request: NextRequest) { return run(request) }
