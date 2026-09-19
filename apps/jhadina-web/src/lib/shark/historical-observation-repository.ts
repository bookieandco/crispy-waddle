import type { SupabaseClient } from '@supabase/supabase-js'
import { CoinGeckoHistoricalSource, HeliusHistoricalSource, collectHistoricalObservation, type TokenLaunch } from '@jhadina/shark-intelligence-core/meme-trader'

const launchFromRow = (row: any): TokenLaunch => ({
  launchId: row.launch_id, chainId: row.chain_id, tokenAddress: row.token_address,
  deployerWalletId: row.deployer_wallet_id ?? undefined, developerEntityId: row.developer_entity_id ?? undefined,
  clusterId: row.cluster_id ?? undefined, launchedAt: row.launched_at, launchpad: row.launchpad ?? undefined,
  initialLiquidityUsd: row.initial_liquidity_usd == null ? undefined : Number(row.initial_liquidity_usd),
  outcome: row.outcome, evidenceIds: row.evidence_ids ?? [],
})

export async function runHistoricalObservationBackfill(client: SupabaseClient, options: { coinGeckoApiKey: string; heliusApiKey?: string; limit: number }) {
  const { data, error } = await client.from('jhadina_token_launches').select('*').order('launched_at', { ascending: false }).limit(options.limit)
  if (error) throw new Error(`SHARK launch backfill load failed: ${error.message}`)
  const market = new CoinGeckoHistoricalSource({ apiKey: options.coinGeckoApiKey })
  const actors = options.heliusApiKey ? new HeliusHistoricalSource({ apiKey: options.heliusApiKey }) : undefined
  let persisted = 0; let partial = 0; const failures: Array<{ launchId: string; reason: string }> = []
  for (const row of data ?? []) {
    const launch = launchFromRow(row)
    try {
      const result = await collectHistoricalObservation({ launch, market, actors })
      const o = result.observation
      const { error: persistError } = await client.from('jhadina_launch_outcome_observations').upsert({
        observation_id: o.observationId, launch_id: o.launchId, observed_at: o.observedAt,
        price_return_from_launch_pct: o.priceReturnFromLaunchPct ?? null, peak_return_pct: o.peakReturnPct ?? null,
        max_drawdown_pct: o.maxDrawdownPct ?? null, current_liquidity_usd: o.currentLiquidityUsd ?? null,
        peak_liquidity_usd: o.peakLiquidityUsd ?? null, liquidity_drawdown_from_peak: o.liquidityDrawdownFromPeak ?? null,
        holder_count_change_pct: o.holderCountChangePct ?? null, holder_exit_pct: o.holderExitPct ?? null,
        developer_sold_pct: o.developerSoldPct ?? null, liquidity_removed: o.liquidityRemoved ?? null,
        trading_halted: o.tradingHalted ?? null, holder_behavior: o.holderBehavior ?? null,
        evidence_ids: o.evidenceIds, source: o.source,
      }, { onConflict: 'observation_id' })
      if (persistError) throw new Error(persistError.message)
      persisted += 1
      if (result.errors.length || Object.values(result.sourceStatus).some(status => status !== 'complete')) partial += 1
    } catch (error) {
      failures.push({ launchId: launch.launchId, reason: error instanceof Error ? error.message : 'unknown-backfill-failure' })
    }
  }
  return { processed: (data ?? []).length, persisted, partial, failed: failures.length, failures }
}
