import type { SupabaseClient } from '@supabase/supabase-js'
import type { SolanaLaunchCollection } from '@jhadina/shark-intelligence-core/meme-trader'

export async function persistSharkLaunch(client: SupabaseClient, collection: SolanaLaunchCollection) {
  const launch = collection.ingested.launch
  const { error } = await client.from('jhadina_token_launches').upsert({
    launch_id: launch.launchId,
    chain_id: launch.chainId,
    token_address: launch.tokenAddress,
    deployer_wallet_id: launch.deployerWalletId ?? null,
    developer_entity_id: launch.developerEntityId ?? null,
    cluster_id: launch.clusterId ?? null,
    launched_at: launch.launchedAt,
    launchpad: launch.launchpad ?? null,
    initial_liquidity_usd: launch.initialLiquidityUsd ?? null,
    outcome: launch.outcome,
    evidence_ids: launch.evidenceIds,
    source: collection.observation.source,
    observation_id: collection.observation.observationId,
    signature: collection.signature ?? null,
    slot: collection.slot ?? null,
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
      launch_id: launch.launchId,
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
  return { launchId: launch.launchId, persistedEdges: edges.length }
}
