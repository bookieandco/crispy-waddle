import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { evaluateLaunchOutcomeBatch, type PersistedLaunchOutcomeObservation } from '@jhadina/shark-intelligence-core/meme-trader/launch-outcome-worker'
import type { TokenLaunch } from '@jhadina/shark-intelligence-core/meme-trader/wallet-launch-pipeline'

export const runtime = 'nodejs'

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service-role configuration is required.')
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function authorized(request: NextRequest): boolean {
  const expected = process.env.SHARK_OUTCOME_WORKER_SECRET ?? process.env.CRON_SECRET
  return Boolean(expected && request.headers.get('authorization') === `Bearer ${expected}`)
}

function parseLimit(request: NextRequest): number {
  const raw = Number(request.nextUrl.searchParams.get('limit') ?? '500')
  return Math.max(1, Math.min(2000, Number.isFinite(raw) ? Math.floor(raw) : 500))
}

async function run(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const supabase = serviceClient()
    const limit = parseLimit(request)
    const { data: launches, error: launchError } = await supabase
      .from('jhadina_token_launches')
      .select('launch_id,chain_id,token_address,deployer_wallet_id,developer_entity_id,cluster_id,launched_at,launchpad,initial_liquidity_usd,outcome,outcome_observed_at,evidence_ids')
      .order('launched_at', { ascending: true })
      .limit(limit)
    if (launchError) return NextResponse.json({ error: 'launch_query_failed' }, { status: 500 })

    const typedLaunches = (launches ?? []).map(row => ({
      launchId: row.launch_id,
      chainId: row.chain_id,
      tokenAddress: row.token_address,
      deployerWalletId: row.deployer_wallet_id ?? undefined,
      developerEntityId: row.developer_entity_id ?? undefined,
      clusterId: row.cluster_id ?? undefined,
      launchedAt: row.launched_at,
      launchpad: row.launchpad ?? undefined,
      initialLiquidityUsd: row.initial_liquidity_usd ?? undefined,
      outcome: row.outcome,
      outcomeObservedAt: row.outcome_observed_at ?? undefined,
      evidenceIds: row.evidence_ids ?? [],
    })) as TokenLaunch[]

    const launchIds = typedLaunches.map(launch => launch.launchId)
    const { data: observations, error: observationError } = launchIds.length
      ? await supabase.from('jhadina_launch_outcome_observations').select('*').in('launch_id', launchIds).order('observed_at', { ascending: false })
      : { data: [], error: null }
    if (observationError) return NextResponse.json({ error: 'observation_query_failed' }, { status: 500 })

    const typedObservations = (observations ?? []).map(row => ({
      observationId: row.observation_id,
      launchId: row.launch_id,
      observedAt: row.observed_at,
      priceReturnFromLaunchPct: row.price_return_from_launch_pct ?? undefined,
      peakReturnPct: row.peak_return_pct ?? undefined,
      maxDrawdownPct: row.max_drawdown_pct ?? undefined,
      initialLiquidityUsd: row.initial_liquidity_usd ?? undefined,
      currentLiquidityUsd: row.current_liquidity_usd ?? undefined,
      peakLiquidityUsd: row.peak_liquidity_usd ?? undefined,
      liquidityDrawdownFromPeak: row.liquidity_drawdown_from_peak ?? undefined,
      liquidityDrainRate: row.liquidity_drain_rate ?? undefined,
      liquidityDrainAcceleration: row.liquidity_drain_acceleration ?? undefined,
      liquidityStabilityScore: row.liquidity_stability_score ?? undefined,
      holderCountChangePct: row.holder_count_change_pct ?? undefined,
      holderExitPct: row.holder_exit_pct ?? undefined,
      developerSoldPct: row.developer_sold_pct ?? undefined,
      liquidityRemoved: row.liquidity_removed ?? undefined,
      tradingHalted: row.trading_halted ?? undefined,
      holderBehavior: row.holder_behavior ?? undefined,
      evidenceIds: row.evidence_ids ?? [],
      source: row.source,
    })) as PersistedLaunchOutcomeObservation[]

    const latestObservationByLaunch = new Map<string, PersistedLaunchOutcomeObservation>()
    for (const observation of typedObservations) {
      const current = latestObservationByLaunch.get(observation.launchId)
      if (!current || Date.parse(observation.observedAt) > Date.parse(current.observedAt)) latestObservationByLaunch.set(observation.launchId, observation)
    }

    const evaluatedAt = new Date().toISOString()
    const result = evaluateLaunchOutcomeBatch({ launches: typedLaunches, observations: typedObservations, evaluatedAt })

    for (const item of result.assessments) {
      const original = typedLaunches.find(launch => launch.launchId === item.launchId)
      if (!original || item.updatedLaunch.outcome === original.outcome) continue
      const { error } = await supabase.from('jhadina_token_launches').update({
        outcome: item.updatedLaunch.outcome,
        outcome_observed_at: item.updatedLaunch.outcomeObservedAt ?? null,
        evidence_ids: item.updatedLaunch.evidenceIds,
      }).eq('launch_id', item.launchId)
      if (error) return NextResponse.json({ error: 'launch_update_failed', launchId: item.launchId }, { status: 500 })
    }

    if (result.assessments.length) {
      const evaluationRows = result.assessments.map(item => {
        const observation = latestObservationByLaunch.get(item.launchId)
        return {
          evaluation_id: `launch-outcome:${item.launchId}:${item.assessment.version}:${observation?.observationId ?? 'none'}`,
          launch_id: item.launchId,
          previous_outcome: typedLaunches.find(launch => launch.launchId === item.launchId)?.outcome ?? 'UNKNOWN',
          evaluated_outcome: item.assessment.outcome,
          confidence: item.assessment.confidence,
          evaluated_at: item.assessment.evaluatedAt,
          evaluator_version: item.assessment.version,
          evidence_ids: item.assessment.evidenceIds,
          reasons: item.assessment.reasons,
        }
      })
      const { error } = await supabase.from('jhadina_launch_outcome_evaluations').upsert(evaluationRows, { onConflict: 'evaluation_id' })
      if (error) return NextResponse.json({ error: 'evaluation_persist_failed' }, { status: 500 })
    }

    if (result.actorHistories.length) {
      const now = new Date().toISOString()
      const actorRows = result.actorHistories.map(item => ({
        actor_key: item.actorKey,
        actor_id: item.actorId,
        actor_kind: item.actorKind,
        launches: item.history.launches,
        healthy_launches: item.history.healthyLaunches,
        bad_launches: item.history.badLaunches,
        failed_launches: item.history.failedLaunches,
        rug_rate: item.history.rugRate,
        pump_and_dump_rate: item.history.pumpAndDumpRate,
        outcome_coverage: item.history.outcomeCoverage,
        confidence: item.history.confidence,
        association_confidence: 1,
        evidence_ids: item.history.evidenceIds,
        evaluated_at: now,
        evaluator_version: 'launch-outcome-v1',
        updated_at: now,
      }))
      const { error } = await supabase.from('jhadina_actor_outcome_history').upsert(actorRows, { onConflict: 'actor_key' })
      if (error) return NextResponse.json({ error: 'actor_history_persist_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, limit, ...result })
  } catch {
    return NextResponse.json({ error: 'outcome_worker_failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) { return run(request) }
export async function POST(request: NextRequest) { return run(request) }
