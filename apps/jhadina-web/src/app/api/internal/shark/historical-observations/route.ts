import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { runHistoricalObservationBackfill } from '@/lib/shark/historical-observation-repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`)
}

function parseLimit(request: NextRequest): number | null {
  const raw = request.nextUrl.searchParams.get('limit')
  if (raw === null) return 100
  const value = Number(raw)
  return Number.isInteger(value) && value >= 1 && value <= 500 ? value : null
}

async function run(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 })
  const limit = parseLimit(request)
  if (limit === null) return NextResponse.json({ ok: false, error: 'invalid_limit' }, { status: 400 })
  const coinGeckoApiKey = process.env.COINGECKO_API_KEY
  if (!coinGeckoApiKey) return NextResponse.json({ ok: false, error: 'shark_market_history_unavailable', reason: 'CoinGecko API key is not configured' }, { status: 503 })
  const client = createServiceRoleClient()
  if (!client) return NextResponse.json({ ok: false, error: 'shark_persistence_unavailable' }, { status: 503 })

  try {
    const result = await runHistoricalObservationBackfill(client, {
      coinGeckoApiKey,
      heliusApiKey: process.env.HELIUS_API_KEY,
      limit,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown SHARK historical observation worker failure'
    return NextResponse.json({ ok: false, error: 'shark_historical_observation_worker_failed', reason }, { status: 502 })
  }
}

export async function GET(request: NextRequest) { return run(request) }
export async function POST(request: NextRequest) { return run(request) }
