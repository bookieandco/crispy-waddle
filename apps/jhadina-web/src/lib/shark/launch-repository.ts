import type { SupabaseClient } from '@supabase/supabase-js'
import type { SolanaLaunchCollection } from '@jhadina/shark-intelligence-core/meme-trader'

export async function persistSharkLaunch(client: SupabaseClient, collection: SolanaLaunchCollection) {
  const launch = collection.ingested.launch
  const { data: existing, error: existingError } = await client
    .from('jhadina_token_launches')
    .select('*')
    .eq('chain_id', launch.chainId)
    .eq('token_address', launch.tokenAddress)
    .maybeSingle()
  if (existingError) throw new Error(`SHARK launch lookup failed: ${existingError.message}`)

  // Launch-ingestion observations describe identity/provenance, not outcome revisions.
  // Never let a duplicate webhook reset or outrank the outcome worker's classification.
  const outcome = existing?.outcome ?? launch.outcome ?? 'UNKNOWN'
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
    outcome_observed_at: existing?.outcome_observed_at ?? launch.outcomeObservedAt ?? null,
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
      confidence: edge.confidence,
      observed_at: edge.observedAt,
      evidence_ids: edge.evidenceIds,
    }]
  })
  if (edges.length) {
    const edgeIds = edges.map(edge => edge.edge_id)
    const { data: existingEdges, error: edgeLookupError } = await client
      .from('jhadina_token_actor_edges')
      .select('edge_id,evidence_ids,observed_at,confidence')
      .in('edge_id', edgeIds)
    if (edgeLookupError) throw new Error(`SHARK actor-edge lookup failed: ${edgeLookupError.message}`)

    const existingById = new Map((existingEdges ?? []).map(row => [row.edge_id, row]))
    const mergedEdges = edges.map(edge => {
      const prior = existingById.get(edge.edge_id)
      return {
        ...edge,
        observed_at: prior?.observed_at && Date.parse(prior.observed_at) <= Date.parse(edge.observed_at)
          ? prior.observed_at
          : edge.observed_at,
        confidence: Math.max(prior?.confidence ?? 0, edge.confidence),
        evidence_ids: [...new Set([...(prior?.evidence_ids ?? []), ...edge.evidence_ids])],
      }
    })

    const { error: edgeError } = await client
      .from('jhadina_token_actor_edges')
      .upsert(mergedEdges, { onConflict: 'edge_id', ignoreDuplicates: false })
    if (edgeError) throw new Error(`SHARK actor-edge persistence failed: ${edgeError.message}`)
  }
  return { launchId: existing?.launch_id ?? launch.launchId, persistedEdges: edges.length }
}
