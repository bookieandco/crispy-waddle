import type { EntityGraph } from './entity-graph'
import type { LPWithdrawalAttribution } from './lp-withdrawal-attribution'

export type DeveloperWithdrawalAssociation = {
  association: 'DIRECT_DEPLOYER' | 'CONTROLLED_DEVELOPER' | 'CLUSTER_ASSOCIATED' | 'NOT_MATCHED' | 'UNKNOWN'
  actorId?: string
  actorKind?: 'wallet' | 'developer' | 'cluster'
  confidence: number
  evidenceIds: string[]
}

export type DeveloperAttributedWithdrawal = LPWithdrawalAttribution & {
  actorAssociation: DeveloperWithdrawalAssociation
}

const clamp = (n: number) => Math.max(0, Math.min(1, n))

/**
 * Maps the verified pre-withdrawal LP owner into the existing EntityGraph.
 * Cluster membership is explicitly weaker than direct developer/deployer proof.
 */
export function attributeWithdrawalToDeveloper(input: {
  withdrawal: LPWithdrawalAttribution
  graph: EntityGraph
  tokenAddress: string
}): DeveloperAttributedWithdrawal {
  const owner = input.withdrawal.ownerBefore
  if (!owner) {
    return { ...input.withdrawal, actorAssociation: { association: 'UNKNOWN', confidence: 0, evidenceIds: input.withdrawal.evidenceIds } }
  }

  const walletId = `wallet:${owner}`
  const tokenIds = new Set(input.graph.nodes.filter(n => n.kind === 'token' && n.id.endsWith(`:${input.tokenAddress}`)).map(n => n.id))
  const ownerNode = input.graph.nodes.find(n => n.id === walletId)
  const relevantEdges = input.graph.edges.filter(edge => edge.from === walletId || edge.to === walletId)

  const directDeploy = relevantEdges.find(edge => edge.from === walletId && edge.relation === 'deployed' && tokenIds.has(edge.to))
  if (directDeploy) {
    const confidence = clamp(Math.min(directDeploy.confidence, ownerNode?.confidence ?? 1, input.withdrawal.confidence))
    return {
      ...input.withdrawal,
      developerAssociation: 'MATCHED',
      actorAssociation: {
        association: 'DIRECT_DEPLOYER',
        actorId: owner,
        actorKind: 'wallet',
        confidence,
        evidenceIds: [...new Set([...input.withdrawal.evidenceIds, ...directDeploy.evidenceIds, ...(ownerNode?.evidenceIds ?? [])])],
      },
      confidence,
    }
  }

  const controlledDeveloper = relevantEdges.find(edge => edge.from === walletId && edge.relation === 'controls' && input.graph.nodes.some(node => node.id === edge.to && node.kind === 'developer'))
  if (controlledDeveloper) {
    const developerId = controlledDeveloper.to.replace(/^developer:/, '')
    const confidence = clamp(Math.min(controlledDeveloper.confidence, ownerNode?.confidence ?? 1, input.withdrawal.confidence))
    return {
      ...input.withdrawal,
      developerAssociation: 'MATCHED',
      actorAssociation: {
        association: 'CONTROLLED_DEVELOPER',
        actorId: developerId,
        actorKind: 'developer',
        confidence,
        evidenceIds: [...new Set([...input.withdrawal.evidenceIds, ...controlledDeveloper.evidenceIds, ...(ownerNode?.evidenceIds ?? [])])],
      },
      confidence,
    }
  }

  const cluster = input.graph.clusters.find(item => item.nodeIds.includes(walletId) && item.nodeIds.some(id => tokenIds.has(id)))
  if (cluster) {
    const confidence = clamp(Math.min(cluster.confidence, input.withdrawal.confidence))
    return {
      ...input.withdrawal,
      actorAssociation: {
        association: 'CLUSTER_ASSOCIATED',
        actorId: cluster.clusterId.replace(/^cluster:/, ''),
        actorKind: 'cluster',
        confidence,
        evidenceIds: [...new Set([...input.withdrawal.evidenceIds, ...cluster.evidenceIds])],
      },
      confidence,
    }
  }

  return {
    ...input.withdrawal,
    actorAssociation: { association: 'NOT_MATCHED', confidence: input.withdrawal.confidence, evidenceIds: input.withdrawal.evidenceIds },
  }
}
