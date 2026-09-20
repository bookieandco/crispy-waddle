import type { SupabaseClient } from '@supabase/supabase-js'
import type { SolanaLaunchCollection } from '@jhadina/shark-intelligence-core/meme-trader'

const outcomeRank: Record<string, number> = { UNKNOWN: 0, HEALTHY: 1, FAILED: 1, PUMP_AND_DUMP: 1, RUG: 2 }

export async function persistSharkLaunch(client: SupabaseClient, collection: SolanaLaunchCollection) {
  const launch = collection.ingested.launch
  const { data: existing, error: existingError } = await client
    .from('jhadina_token_launches')
    .select('*')
    .eq('chain_id', launch.chainId)
    .eq('token_address', launch.tokenAddress)
    .maybeSingle()
  if (existingError) throw new Error(`SHARK launch lookup failed: ${existingError.message}`)

  const existingOutcome = existing?.outcome ?? 'UNKNOWN'
  const incomingOutcome = launch.outcome ?? 'UNKNOWN'
  const outcome = (outcomeRank[incomingOutcome] ?? 0) >= (outcomeRank[existingOutcome] ?? 0)
    ? incomingOutcome
    : existingOutcome
  const evidenceIds = [...new Set([...(existing?.evidence_ids ?? []), ...launch.evidenceIds])]
  const launchedAt = existing?.launched_at && Date.parse(existing.launched_at) <= Date.parse(launch.launchedAt)
    ? existing.launched_at
    : launch.launchedAt

  const { error } = await client.from('jhadina_token_launches').upsert({
    launch_id: existing?.launch_id ?? launch.launchId,
    chain_id: launch.chainId,
    token_address: launch.tokenAddress,
    deployer_wallet_id: launch.deployerWalletId ?? existing?.deployer_wallet_id ?? null,
    developer_entity_id: launch.developerEntityId ?? existing?.developer_entity_id ?? null,
    cluster_id: launch.clusterId ?? existing?.cluster_id ?? null,
    launched_at: launchedAt,
    launchpad: launch.launchpad ?? existing?.launchpad ?? null,
    initial_liquidity_usd: launch.initialLiquidityUsd ?? existing?.initial_liquidity_usd ?? null,
    outcome,
    evidence_ids: evidenceIds,
    source: collection.observation.source,
    observation_id: collection.observation.observationId,
    signature: collection.signature ?? existing?.signature ?? null,
    slot: collection.slot ?? existing?.slot ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'chain_id,token_address', ignoreDuplicates: false })
  if (error) throw new Error(`SHARK launch persistence failed: ${error.message}`)

  const nodes = new Map(collection.ingested.graph.nodes.map(node => [node.id, node]))
  const tokenNodeId = `token:${launch.chainId}:${launch.tokenAddress}`
  const edges = collection.ingested.graph.edges.flatMap(edge => {
    const actorNodeId = edge.from === tokenNodeId ? edge.to : edge.from
    const actor = nodes.get(actorNodeId)
    if (!actor || actor.kind === 'token') return []
    return [{
      edge_id: edge.id,
      launch_id: existing?.launch_id ?? launch.launchId,
      token_address: launch.tokenAddress,
      actor_id: actor.id.replace(/^(wallet|developer|organization|cluster):/, ''),
      actor_kind: actor.kind,
      role: edge.relation,
      observed_at: edge.observedAt,
      evidence_ids: edge.evidenceIds,
    }]
  })
  if (edges.length) {
    const { error: edgeError } = await client.from('jhadina_token_actor_edges').upsert(edges, { onConflict: 'edge_id', ignoreDuplicates: true })
    if (edgeError) throw new Error(`SHARK actor-edge persistence failed: ${edgeError.message}`)
  }
  return { launchId: existing?.launch_id ?? launch.launchId, persistedEdges: edges.length }
}
