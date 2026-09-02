import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { TokenLaunch } from '@jhadina/shark-intelligence-core/meme-trader/wallet-launch-pipeline'
import { CoinGeckoHistoricalSource } from '@jhadina/shark-intelligence-core/meme-trader/coingecko-historical-source'
import { HeliusHistoricalSource } from '@jhadina/shark-intelligence-core/meme-trader/helius-historical-source'
import { collectHistoricalObservation } from '@jhadina/shark-intelligence-core/meme-trader/historical-observation-collector'

export const runtime = 'nodejs'

function authorized(request: NextRequest): boolean {
  const expected = process.env.SHARK_OUTCOME_WORKER_SECRET ?? process.env.CRON_SECRET
  return Boolean(expected && request.headers.get('authorization') === `Bearer ${expected}`)
}
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service-role configuration is required.')
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
function limitOf(request: NextRequest): number { const n = Number(request.nextUrl.searchParams.get('limit') ?? '100'); return Math.max(1, Math.min(500, Number.isFinite(n) ? Math.floor(n) : 100)) }

async function run(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const cgKey = process.env.COINGECKO_API_KEY
  if (!cgKey) return NextResponse.json({ error: 'coingecko_api_key_missing' }, { status: 503 })
  try {
    const supabase = serviceClient(); const limit = limitOf(request)
    const { data: rows, error } = await supabase.from('jhadina_token_launches').select('launch_id,chain_id,token_address,deployer_wallet_id,developer_entity_id,cluster_id,launched_at,launchpad,initial_liquidity_usd,outcome,outcome_observed_at,evidence_ids').order('launched_at', { ascending: true }).limit(limit)
    if (error) return NextResponse.json({ error: 'launch_query_failed' }, { status: 500 })
    const launches = (rows ?? []).map(row => ({ launchId: row.launch_id, chainId: row.chain_id, tokenAddress: row.token_address, deployerWalletId: row.deployer_wallet_id ?? undefined, developerEntityId: row.developer_entity_id ?? undefined, clusterId: row.cluster_id ?? undefined, launchedAt: row.launched_at, launchpad: row.launchpad ?? undefined, initialLiquidityUsd: row.initial_liquidity_usd ?? undefined, outcome: row.outcome, outcomeObservedAt: row.outcome_observed_at ?? undefined, evidenceIds: row.evidence_ids ?? [] })) as TokenLaunch[]
    const market = new CoinGeckoHistoricalSource({ apiKey: cgKey })
    const actors = process.env.HELIUS_API_KEY ? new HeliusHistoricalSource({ apiKey: process.env.HELIUS_API_KEY }) : undefined
    const results = []
    for (const launch of launches) {
      const result = await collectHistoricalObservation({ launch, market, actors })
      const o = result.observation
      const payload = {
        observation_id: o.observationId, launch_id: o.launchId, observed_at: o.observedAt,
        price_return_from_launch_pct: o.priceReturnFromLaunchPct ?? null, peak_return_pct: o.peakReturnPct ?? null, max_drawdown_pct: o.maxDrawdownPct ?? null,
        initial_liquidity_usd: launch.initialLiquidityUsd ?? null, current_liquidity_usd: o.currentLiquidityUsd ?? null, peak_liquidity_usd: o.peakLiquidityUsd ?? null, liquidity_drawdown_from_peak: o.liquidityDrawdownFromPeak ?? null,
        holder_count_change_pct: o.holderCountChangePct ?? null, holder_exit_pct: o.holderExitPct ?? null, developer_sold_pct: o.developerSoldPct ?? null,
        liquidity_removed: o.liquidityRemoved ?? null, trading_halted: o.tradingHalted ?? null, holder_behavior: o.holderBehavior ?? null,
        evidence_ids: o.evidenceIds, source: o.source,
      }
      const { error: writeError } = await supabase.from('jhadina_launch_outcome_observations').upsert(payload, { onConflict: 'observation_id' })
      results.push({ launchId: launch.launchId, sourceStatus: result.sourceStatus, errors: result.errors, persisted: !writeError })
    }
    return NextResponse.json({ ok: true, limit, processed: results.length, results })
  } catch { return NextResponse.json({ error: 'historical_observation_backfill_failed' }, { status: 500 }) }
}
export async function GET(request: NextRequest) { return run(request) }
export async function POST(request: NextRequest) { return run(request) }
