import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { collectHeliusLaunch, type HeliusLaunchWebhookEvent } from '@jhadina/shark-intelligence-core/meme-trader/solana-launch-collector'

export const runtime = 'nodejs'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error('Supabase service-role configuration is required for Helius launch ingestion.')
  return createSupabaseClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

function authorized(request: NextRequest): boolean {
  const expected = process.env.HELIUS_WEBHOOK_AUTH_SECRET
  if (!expected) return false
  return request.headers.get('authorization') === expected
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const payload = await request.json()
    const events: HeliusLaunchWebhookEvent[] = Array.isArray(payload) ? payload : [payload]
    const collected = events.map(event => collectHeliusLaunch(event)).filter((value): value is NonNullable<typeof value> => value !== null)
    if (!collected.length) return NextResponse.json({ accepted: 0, ignored: events.length })

    const supabase = getServiceClient()
    const rows = collected.map(({ observation, ingested }) => ({
      launch_id: ingested.launch.launchId,
      owner_id: null,
      chain_id: ingested.launch.chainId,
      token_address: ingested.launch.tokenAddress,
      deployer_wallet_id: ingested.launch.deployerWalletId ?? null,
      developer_entity_id: ingested.launch.developerEntityId ?? null,
      cluster_id: ingested.launch.clusterId ?? null,
      launched_at: ingested.launch.launchedAt,
      launchpad: ingested.launch.launchpad ?? null,
      initial_liquidity_usd: ingested.launch.initialLiquidityUsd ?? null,
      outcome: ingested.launch.outcome,
      outcome_observed_at: ingested.launch.outcomeObservedAt ?? null,
      evidence_ids: [...new Set(ingested.launch.evidenceIds)],
    }))

    const { error } = await supabase.from('jhadina_token_launches').upsert(rows, { onConflict: 'launch_id', ignoreDuplicates: true })
    if (error) return NextResponse.json({ error: 'persistence_failed' }, { status: 500 })

    return NextResponse.json({ accepted: collected.length, ignored: events.length - collected.length, launches: collected.map(x => x.ingested.launch.launchId) })
  } catch {
    return NextResponse.json({ error: 'invalid_launch_payload' }, { status: 400 })
  }
}
