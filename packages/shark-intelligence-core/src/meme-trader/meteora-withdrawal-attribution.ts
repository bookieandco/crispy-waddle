import type { EntityGraph } from './entity-graph'
import type { MeteoraDlmmLiquidityDelta } from './meteora-dlmm'

export type MeteoraDlmmWithdrawalAttribution = Readonly<{
  evidenceId: string
  observedAt: string
  poolAddress: string
  position: string
  owner: string
  tokenXRemoved: bigint
  tokenYRemoved: bigint
  association: 'DIRECT_DEPLOYER' | 'CONTROLLED_DEVELOPER' | 'CLUSTER_ASSOCIATED' | 'NOT_MATCHED'
  actorId?: string
  confidence: number
  evidenceIds: readonly string[]
}>

const clamp = (n: number) => Math.max(0, Math.min(1, n))

/** DLMM-native attribution: position owner is authoritative; no LP-token fiction. */
export function attributeMeteoraDlmmWithdrawal(input: {
  delta: MeteoraDlmmLiquidityDelta
  graph: EntityGraph
  tokenAddress: string
}): MeteoraDlmmWithdrawalAttribution | null {
  const { delta, graph } = input
  if (delta.kind !== 'LIQUIDITY_REMOVE') return null
  const walletId = `wallet:${delta.owner}`
  const ownerNode = graph.nodes.find(n => n.id === walletId)
  const tokenIds = new Set(graph.nodes.filter(n => n.kind === 'token' && n.id.endsWith(`:${input.tokenAddress}`)).map(n => n.id))
  const edges = graph.edges.filter(e => e.from === walletId || e.to === walletId)
  let association: MeteoraDlmmWithdrawalAttribution['association'] = 'NOT_MATCHED'
  let actorId: string | undefined
  let associationConfidence = 1
  let associationEvidence: string[] = []

  const deployed = edges.find(e => e.from === walletId && e.relation === 'deployed' && tokenIds.has(e.to))
  if (deployed) {
    association = 'DIRECT_DEPLOYER'
    actorId = delta.owner
    associationConfidence = deployed.confidence
    associationEvidence = deployed.evidenceIds
  } else {
    const controls = edges.find(e => e.from === walletId && e.relation === 'controls' && graph.nodes.some(n => n.id === e.to && n.kind === 'developer'))
    if (controls) {
      association = 'CONTROLLED_DEVELOPER'
      actorId = controls.to.replace(/^developer:/, '')
      associationConfidence = controls.confidence
      associationEvidence = controls.evidenceIds
    } else {
      const cluster = graph.clusters.find(c => c.nodeIds.includes(walletId) && c.nodeIds.some(id => tokenIds.has(id)))
      if (cluster) {
        association = 'CLUSTER_ASSOCIATED'
        actorId = cluster.clusterId.replace(/^cluster:/, '')
        associationConfidence = cluster.confidence
        associationEvidence = cluster.evidenceIds
      }
    }
  }

  const confidence = clamp(Math.min(0.9, associationConfidence, ownerNode?.confidence ?? 1))
  return Object.freeze({
    evidenceId: delta.evidenceId,
    observedAt: delta.observedAt,
    poolAddress: delta.poolAddress,
    position: delta.position,
    owner: delta.owner,
    tokenXRemoved: delta.tokenXDelta < 0n ? -delta.tokenXDelta : 0n,
    tokenYRemoved: delta.tokenYDelta < 0n ? -delta.tokenYDelta : 0n,
    association,
    actorId,
    confidence,
    evidenceIds: Object.freeze([...new Set([delta.evidenceId, ...associationEvidence, ...(ownerNode?.evidenceIds ?? [])])]),
  })
}

export function verifiedAdversarialMeteoraWithdrawals(
  items: readonly MeteoraDlmmWithdrawalAttribution[],
): MeteoraDlmmWithdrawalAttribution[] {
  return items.filter(item =>
    (item.association === 'DIRECT_DEPLOYER' || item.association === 'CONTROLLED_DEVELOPER')
    && item.confidence >= 0.7,
  )
}
