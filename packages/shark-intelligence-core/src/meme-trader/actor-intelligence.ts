import type { EntityGraph, EntityGraphEdge } from './entity-graph'
import { deriveActorOutcomeHistory } from './launch-outcome-engine'
import type { ActorOutcomeHistory } from './launch-outcome-engine'
import { deriveLaunchBehaviorSignal, type LaunchBehaviorSignal, type TokenLaunch } from './wallet-launch-pipeline'
import type { ActorRiskIntelligence } from './actor-risk-integration'

export type ActorAssociation = {
  actorId: string
  kind: 'wallet' | 'developer' | 'cluster'
  confidence: number
  evidenceIds: string[]
}

export type HistoricalActorIntelligence = ActorRiskIntelligence & {
  associations: ActorAssociation[]
  matchedLaunches: TokenLaunch[]
}

const clamp = (n: number) => Math.max(0, Math.min(1, n))

function currentActorIds(graph: EntityGraph, tokenAddress: string): ActorAssociation[] {
  const tokenIds = new Set(graph.nodes.filter(n => n.kind === 'token' && n.id.endsWith(`:${tokenAddress}`)).map(n => n.id))
  const associations = new Map<string, ActorAssociation>()
  for (const edge of graph.edges) {
    if (!tokenIds.has(edge.to) && !tokenIds.has(edge.from)) continue
    const actorNodeId = tokenIds.has(edge.to) ? edge.from : edge.to
    const node = graph.nodes.find(n => n.id === actorNodeId)
    if (!node || !['wallet', 'developer', 'cluster'].includes(node.kind)) continue
    const actorId = node.id.replace(/^(wallet|developer|cluster):/, '')
    const key = `${node.kind}:${actorId}`
    const previous = associations.get(key)
    const confidence = Math.max(previous?.confidence ?? 0, clamp(edge.confidence * node.confidence))
    associations.set(key, { actorId, kind: node.kind, confidence, evidenceIds: [...new Set([...(previous?.evidenceIds ?? []), ...edge.evidenceIds, ...node.evidenceIds])] })
  }
  return [...associations.values()]
}

function matchesActor(launch: TokenLaunch, association: ActorAssociation): boolean {
  if (association.kind === 'wallet') return launch.deployerWalletId === association.actorId
  if (association.kind === 'developer') return launch.developerEntityId === association.actorId
  return launch.clusterId === association.actorId
}

function signalForAssociation(association: ActorAssociation, launches: TokenLaunch[]): LaunchBehaviorSignal | undefined {
  if (!launches.length) return undefined
  const signal = deriveLaunchBehaviorSignal({ walletId: association.actorId, entityId: association.kind === 'developer' ? association.actorId : undefined, clusterId: association.kind === 'cluster' ? association.actorId : undefined, launches, evidenceIds: association.evidenceIds })
  return { ...signal, confidence: clamp(signal.confidence * association.confidence), evidenceIds: [...new Set([...signal.evidenceIds, ...association.evidenceIds])] }
}

export function deriveHistoricalActorIntelligence(input: { currentGraph: EntityGraph; currentTokenAddress: string; historicalLaunches: TokenLaunch[] }): HistoricalActorIntelligence {
  const associations = currentActorIds(input.currentGraph, input.currentTokenAddress)
  const signals: LaunchBehaviorSignal[] = []
  const outcomeHistory: ActorOutcomeHistory[] = []
  const matched = new Map<string, TokenLaunch>()

  for (const association of associations) {
    const launches = input.historicalLaunches.filter(launch => matchesActor(launch, association))
    launches.forEach(launch => matched.set(launch.launchId, launch))
    const signal = signalForAssociation(association, launches)
    if (signal) signals.push(signal)
    if (launches.length) {
      const history = deriveActorOutcomeHistory(association.actorId, launches)
      outcomeHistory.push({ ...history, confidence: clamp(history.confidence * association.confidence), evidenceIds: [...new Set([...history.evidenceIds, ...association.evidenceIds])] })
    }
  }

  return {
    associations,
    matchedLaunches: [...matched.values()],
    launchBehavior: signals,
    outcomeHistory,
    evidenceIds: [...new Set([...input.currentGraph.nodes.flatMap(n => n.evidenceIds), ...input.currentGraph.edges.flatMap(e => e.evidenceIds)])],
  }
}

export function graphEdgeConfidence(edge: EntityGraphEdge): number {
  return clamp(edge.confidence)
}
