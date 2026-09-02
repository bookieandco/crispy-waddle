import { NextRequest, NextResponse } from 'next/server'
import { AlertDeliveryWorker } from '@/lib/government-opportunities/alert-delivery-worker'
import { createProductionAlertDeliveryRouter } from '@/lib/government-opportunities/production-alert-delivery-router'
import { SupabaseAlertDeliveryRepository } from '@/lib/government-opportunities/supabase-alert-delivery-repository'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BATCH_SIZE = 100
const DEFAULT_BATCH_SIZE = 25
const RETRY_POLICY = {
  maxAttempts: 5,
  baseDelaySeconds: 10,
  maxDelaySeconds: 300,
} as const

function authorized(request: NextRequest): boolean {
  const expected = process.env.OCE_DELIVERY_WORKER_SECRET ?? process.env.CRON_SECRET
  return Boolean(expected && request.headers.get('authorization') === `Bearer ${expected}`)
}

function parseBatchSize(request: NextRequest): number {
  const raw = Number(request.nextUrl.searchParams.get('limit') ?? DEFAULT_BATCH_SIZE)
  return Math.max(1, Math.min(MAX_BATCH_SIZE, Number.isFinite(raw) ? Math.floor(raw) : DEFAULT_BATCH_SIZE))
}

async function run(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const client = createServiceRoleClient()
  if (!client) return NextResponse.json({ ok: false, error: 'OCE delivery service configuration is missing' }, { status: 503 })

  try {
    const now = new Date().toISOString()
    const worker = new AlertDeliveryWorker(
      new SupabaseAlertDeliveryRepository(client),
      createProductionAlertDeliveryRouter(),
      {
        workerId: `oce-delivery:${crypto.randomUUID()}`,
        batchSize: parseBatchSize(request),
        retryPolicy: RETRY_POLICY,
        now: () => now,
      },
    )

    const result = await worker.runOnce()
    return NextResponse.json({ ok: true, worker: 'oce-alert-delivery', ...result })
  } catch {
    return NextResponse.json({ ok: false, error: 'OCE alert delivery worker failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return run(request)
}

export async function POST(request: NextRequest) {
  return run(request)
}
