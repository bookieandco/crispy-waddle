import type { EntityGraph } from './entity-graph'
import type { ActorOutcomeHistory } from './launch-outcome-engine'
import { deriveHistoricalActorIntelligence, type ActorAssociation, type HistoricalActorIntelligence } from './actor-intelligence'
import type { TokenLaunch } from './wallet-launch-pipeline'

export type PersistedActorOutcomeRecord = ActorOutcomeHistory & {
  actorKey: string
  actorKind: 'wallet' | 'developer' | 'cluster'
  associationConfidence: number
}

const clamp = (n: number) => Math.max(0, Math.min(1, n))

/**
 * Matches the current token's graph actors to durable actor reputation.
 * Association confidence is preserved and multiplied into reputation confidence;
 * a cluster match is never treated as proof of common ownership.
 */
export function matchPersistedActorOutcomeHistory(input: {
  associations: ActorAssociation[]
  records: PersistedActorOutcomeRecord[]
}): ActorOutcomeHistory[] {
  const byKey = new Map(input.records.map(record => [record.actorKey, record]))
  return input.associations.flatMap(association => {
    const record = byKey.get(`${association.kind}:${association.actorId}`)
    if (!record) return []
    const confidence = clamp(record.confidence * association.confidence * record.associationConfidence)
    return [{
      actorId: record.actorId,
      launches: record.launches,
      healthyLaunches: record.healthyLaunches,
      badLaunches: record.badLaunches,
      failedLaunches: record.failedLaunches,
      rugRate: record.rugRate,
      pumpAndDumpRate: record.pumpAndDumpRate,
      outcomeCoverage: record.outcomeCoverage,
      confidence,
      evidenceIds: [...new Set([...record.evidenceIds, ...association.evidenceIds])],
    }]
  })
}

/**
 * Combines durable reputation with optional in-memory historical launches.
 * Durable reputation is the preferred source once backfill has populated it.
 */
export function derivePersistedActorIntelligence(input: {
  currentGraph: EntityGraph
  currentTokenAddress: string
  persistedRecords: PersistedActorOutcomeRecord[]
  historicalLaunches?: TokenLaunch[]
}): HistoricalActorIntelligence {
  const base = deriveHistoricalActorIntelligence({
    currentGraph: input.currentGraph,
    currentTokenAddress: input.currentTokenAddress,
    historicalLaunches: input.historicalLaunches ?? [],
  })
  const durable = matchPersistedActorOutcomeHistory({ associations: base.associations, records: input.persistedRecords })
  const merged = new Map<string, ActorOutcomeHistory>()
  for (const history of base.outcomeHistory) merged.set(history.actorId, history)
  for (const history of durable) {
    const current = merged.get(history.actorId)
    if (!current || history.confidence > current.confidence) merged.set(history.actorId, history)
  }
  return {
    ...base,
    outcomeHistory: [...merged.values()],
    evidenceIds: [...new Set([...base.evidenceIds, ...durable.flatMap(history => history.evidenceIds)])],
  }
}
