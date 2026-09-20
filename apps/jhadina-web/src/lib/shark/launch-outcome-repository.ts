import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  deriveActorOutcomeHistories,
  evaluateLaunchOutcomeBatch,
  type PersistedLaunchOutcomeObservation,
  type TokenLaunch,
} from '@jhadina/shark-intelligence-core/meme-trader'

const launchFromRow = (row: any): TokenLaunch => ({
  launchId: row.launch_id, chainId: row.chain_id, tokenAddress: row.token_address,
  deployerWalletId: row.deployer_wallet_id ?? undefined, developerEntityId: row.developer_entity_id ?? undefined,
  clusterId: row.cluster_id ?? undefined, launchedAt: row.launched_at, launchpad: row.launchpad ?? undefined,
  initialLiquidityUsd: row.initial_liquidity_usd == null ? undefined : Number(row.initial_liquidity_usd),
  outcome: row.outcome, outcomeObservedAt: row.outcome_observed_at ?? undefined, evidenceIds: row.evidence_ids ?? [],
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

function latestObservationByLaunch(observations: PersistedLaunchOutcomeObservation[]) {
  const latest = new Map<string, PersistedLaunchOutcomeObservation>()
  for (const observation of observations) {
    const current = latest.get(observation.launchId)
    if (!current || Date.parse(observation.observedAt) > Date.parse(current.observedAt)) {
      latest.set(observation.launchId, observation)
    }
  }
  return latest
}

function observationFingerprint(observation: PersistedLaunchOutcomeObservation): string {
  const canonical = JSON.stringify([
    observation.observationId,
    observation.observedAt,
    observation.source,
    observation.priceReturnFromLaunchPct ?? null,
    observation.peakReturnPct ?? null,
    observation.maxDrawdownPct ?? null,
    observation.initialLiquidityUsd ?? null,
    observation.currentLiquidityUsd ?? null,
    observation.peakLiquidityUsd ?? null,
    observation.liquidityDrawdownFromPeak ?? null,
    observation.liquidityDrainRate ?? null,
    observation.liquidityDrainAcceleration ?? null,
    observation.liquidityStabilityScore ?? null,
    observation.holderCountChangePct ?? null,
    observation.holderExitPct ?? null,
    observation.developerSoldPct ?? null,
    observation.liquidityRemoved ?? null,
    observation.tradingHalted ?? null,
    observation.holderBehavior ?? null,
    [...observation.evidenceIds].sort(),
  ])
  return createHash('sha256').update(canonical).digest('hex').slice(0, 24)
}

async function loadAllLaunches(client: SupabaseClient): Promise<TokenLaunch[]> {
  const pageSize = 1000
  const rows: any[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from('jhadina_token_launches')
      .select('*')
      .order('launch_id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`SHARK canonical actor-history launch load failed: ${error.message}`)
    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows.map(launchFromRow)
}

export async function runPersistedLaunchOutcomeWorker(client: SupabaseClient, limit = 500) {
  const { data: launchRows, error: launchError } = await client
    .from('jhadina_token_launches')
    .select('*')
    .order('launched_at', { ascending: false })
    .limit(limit)
  if (launchError) throw new Error(`SHARK launch load failed: ${launchError.message}`)

  const launches = (launchRows ?? []).map(launchFromRow)
  const launchIds = launches.map(launch => launch.launchId)
  let observationRows: any[] = []
  if (launchIds.length) {
    const { data, error: observationError } = await client.rpc(
      'jhadina_shark_latest_outcome_observations',
      { p_launch_ids: launchIds },
    )
    if (observationError) throw new Error(`SHARK outcome observation load failed: ${observationError.message}`)
    observationRows = data ?? []
  }

  const observations = observationRows.map(observationFromRow)
  const latestObservations = latestObservationByLaunch(observations)
  const evaluatedAt = new Date().toISOString()
  const result = evaluateLaunchOutcomeBatch({ launches, observations, evaluatedAt })

  for (const item of result.assessments) {
    const previous = launches.find(x => x.launchId === item.launchId)?.outcome ?? 'UNKNOWN'
    const observation = latestObservations.get(item.launchId)
    if (!observation) throw new Error(`SHARK evaluation missing source observation for ${item.launchId}`)
    const evaluationId = `launch-evaluation:${item.launchId}:${item.assessment.version}:${observationFingerprint(observation)}`

    const { error: evaluationError } = await client.from('jhadina_launch_outcome_evaluations').upsert({
      evaluation_id: evaluationId,
      launch_id: item.launchId,
      previous_outcome: previous,
      evaluated_outcome: item.assessment.outcome,
      confidence: item.assessment.confidence,
      evaluated_at: evaluatedAt,
      evaluator_version: item.assessment.version,
      evidence_ids: item.assessment.evidenceIds,
      reasons: item.assessment.reasons,
    }, { onConflict: 'evaluation_id', ignoreDuplicates: true })
    if (evaluationError) throw new Error(`SHARK evaluation persistence failed: ${evaluationError.message}`)

    if (item.updatedLaunch.outcome !== previous) {
      const { error } = await client.from('jhadina_token_launches').update({
        outcome: item.updatedLaunch.outcome,
        outcome_observed_at: item.updatedLaunch.outcomeObservedAt ?? evaluatedAt,
        evidence_ids: item.updatedLaunch.evidenceIds,
        updated_at: evaluatedAt,
      }).eq('launch_id', item.launchId)
      if (error) throw new Error(`SHARK launch outcome update failed: ${error.message}`)
    }
  }

  const touchedActorKeys = new Set(result.actorHistories.map(actor => actor.actorKey))
  const canonicalActorHistories = deriveActorOutcomeHistories(await loadAllLaunches(client))
    .filter(actor => touchedActorKeys.has(actor.actorKey))

  const actorKeys = canonicalActorHistories.map(actor => ({ kind: actor.actorKind, id: actor.actorId }))
  const actorIds = [...new Set(actorKeys.map(actor => actor.id))]
  const { data: actorEdges, error: actorEdgeError } = actorIds.length
    ? await client.from('jhadina_token_actor_edges').select('actor_id,actor_kind,confidence').in('actor_id', actorIds)
    : { data: [], error: null }
  if (actorEdgeError) throw new Error(`SHARK actor association confidence load failed: ${actorEdgeError.message}`)

  const associationConfidence = new Map<string, number>()
  for (const edge of actorEdges ?? []) {
    const key = `${edge.actor_kind}:${edge.actor_id}`
    associationConfidence.set(key, Math.max(associationConfidence.get(key) ?? 0, Number(edge.confidence ?? 0)))
  }

  for (const actor of canonicalActorHistories) {
    const h = actor.history
    const { error } = await client.from('jhadina_actor_outcome_history').upsert({
      actor_key: actor.actorKey,
      actor_id: actor.actorId,
      actor_kind: actor.actorKind,
      launches: h.launches,
      healthy_launches: h.healthyLaunches,
      bad_launches: h.badLaunches,
      failed_launches: h.failedLaunches,
      rug_rate: h.rugRate,
      pump_and_dump_rate: h.pumpAndDumpRate,
      outcome_coverage: h.outcomeCoverage,
      confidence: h.confidence,
      association_confidence: associationConfidence.get(actor.actorKey) ?? 0,
      evidence_ids: h.evidenceIds,
      evaluated_at: evaluatedAt,
      evaluator_version: 'launch-outcome-v2',
      updated_at: evaluatedAt,
    }, { onConflict: 'actor_key' })
    if (error) throw new Error(`SHARK actor history persistence failed: ${error.message}`)
  }

  return { ...result, actorHistories: canonicalActorHistories }
}
