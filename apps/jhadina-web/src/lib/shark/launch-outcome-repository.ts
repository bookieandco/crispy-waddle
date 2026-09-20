import type { SupabaseClient } from '@supabase/supabase-js'
import { evaluateLaunchOutcomeBatch, type PersistedLaunchOutcomeObservation, type TokenLaunch } from '@jhadina/shark-intelligence-core/meme-trader'

const launchFromRow = (row: any): TokenLaunch => ({
  launchId: row.launch_id, chainId: row.chain_id, tokenAddress: row.token_address,
  deployerWalletId: row.deployer_wallet_id ?? undefined, developerEntityId: row.developer_entity_id ?? undefined,
  clusterId: row.cluster_id ?? undefined, launchedAt: row.launched_at, launchpad: row.launchpad ?? undefined,
  initialLiquidityUsd: row.initial_liquidity_usd == null ? undefined : Number(row.initial_liquidity_usd),
  outcome: row.outcome, evidenceIds: row.evidence_ids ?? [],
})

const observationFromRow = (row: any): PersistedLaunchOutcomeObservation => ({
  observationId: row.observation_id, launchId: row.launch_id, observedAt: row.observed_at,
  priceReturnFromLaunchPct: row.price_return_from_launch_pct == null ? undefined : Number(row.price_return_from_launch_pct),
  peakReturnPct: row.peak_return_pct == null ? undefined : Number(row.peak_return_pct),
  maxDrawdownPct: row.max_drawdown_pct == null ? undefined : Number(row.max_drawdown_pct),
  initialLiquidityUsd: row.initial_liquidity_usd == null ? undefined : Number(row.initial_liquidity_usd),
  currentLiquidityUsd: row.current_liquidity_usd == null ? undefined : Number(row.current_liquidity_usd),
  peakLiquidityUsd: row.peak_liquidity_usd == null ? undefined : Number(row.peak_liquidity_usd),
  liquidityDrawdownFromPeak: row.liquidity_drawdown_from_peak == null ? undefined : Number(row.liquidity_drawdown_from_peak),
  liquidityDrainRate: row.liquidity_drain_rate == null ? undefined : Number(row.liquidity_drain_rate),
  liquidityDrainAcceleration: row.liquidity_drain_acceleration == null ? undefined : Number(row.liquidity_drain_acceleration),
  liquidityStabilityScore: row.liquidity_stability_score == null ? undefined : Number(row.liquidity_stability_score),
  holderCountChangePct: row.holder_count_change_pct == null ? undefined : Number(row.holder_count_change_pct),
  holderExitPct: row.holder_exit_pct == null ? undefined : Number(row.holder_exit_pct),
  developerSoldPct: row.developer_sold_pct == null ? undefined : Number(row.developer_sold_pct),
  liquidityRemoved: row.liquidity_removed ?? undefined, tradingHalted: row.trading_halted ?? undefined,
  holderBehavior: row.holder_behavior ?? undefined, evidenceIds: row.evidence_ids ?? [], source: row.source,
})

export async function runPersistedLaunchOutcomeWorker(client: SupabaseClient, limit = 500) {
  const [{ data: launchRows, error: launchError }, { data: observationRows, error: observationError }] = await Promise.all([
    client.from('jhadina_token_launches').select('*').order('launched_at', { ascending: false }).limit(limit),
    client.from('jhadina_launch_outcome_observations').select('*').order('observed_at', { ascending: false }).limit(limit * 4),
  ])
  if (launchError) throw new Error(`SHARK launch load failed: ${launchError.message}`)
  if (observationError) throw new Error(`SHARK outcome observation load failed: ${observationError.message}`)
  const launches = (launchRows ?? []).map(launchFromRow)
  const observations = (observationRows ?? []).map(observationFromRow)
  const evaluatedAt = new Date().toISOString()
  const result = evaluateLaunchOutcomeBatch({ launches, observations, evaluatedAt })

  for (const item of result.assessments) {
    const previous = launches.find(x => x.launchId === item.launchId)?.outcome ?? 'UNKNOWN'
    const { error: evaluationError } = await client.from('jhadina_launch_outcome_evaluations').upsert({
      evaluation_id: `launch-evaluation:${item.launchId}:${evaluatedAt}`, launch_id: item.launchId,
      previous_outcome: previous, evaluated_outcome: item.assessment.outcome, confidence: item.assessment.confidence,
      evaluated_at: evaluatedAt, evaluator_version: item.assessment.version, evidence_ids: item.assessment.evidenceIds,
      reasons: item.assessment.reasons,
    }, { onConflict: 'evaluation_id' })
    if (evaluationError) throw new Error(`SHARK evaluation persistence failed: ${evaluationError.message}`)
    if (item.updatedLaunch.outcome !== previous) {
      const { error } = await client.from('jhadina_token_launches').update({
        outcome: item.updatedLaunch.outcome, evidence_ids: item.updatedLaunch.evidenceIds, updated_at: evaluatedAt,
      }).eq('launch_id', item.launchId)
      if (error) throw new Error(`SHARK launch outcome update failed: ${error.message}`)
    }
  }

  for (const actor of result.actorHistories) {
    const h = actor.history
    const { error } = await client.from('jhadina_actor_outcome_history').upsert({
      actor_key: actor.actorKey, actor_id: actor.actorId, actor_kind: actor.actorKind,
      launches: h.launches, healthy_launches: h.healthyLaunches, bad_launches: h.badLaunches,
      failed_launches: h.failedLaunches, rug_rate: h.rugRate, pump_and_dump_rate: h.pumpAndDumpRate,
      outcome_coverage: h.outcomeCoverage, confidence: h.confidence, association_confidence: 1,
      evidence_ids: h.evidenceIds, evaluated_at: evaluatedAt, evaluator_version: 'launch-outcome-v1', updated_at: evaluatedAt,
    }, { onConflict: 'actor_key' })
    if (error) throw new Error(`SHARK actor history persistence failed: ${error.message}`)
  }
  return result
}
