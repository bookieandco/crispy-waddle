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

/** Matches current-token graph actors to durable reputation without treating cluster association as ownership proof. */
export function matchPersistedActorOutcomeHistory(input: {
  associations: ActorAssociation[]
  records: PersistedActorOutcomeRecord[]
}): Array<ActorOutcomeHistory & { actorKey: string; actorKind: PersistedActorOutcomeRecord['actorKind'] }> {
  const byKey = new Map(input.records.map(record => [record.actorKey, record]))
  return input.associations.flatMap(association => {
    const key = `${association.kind}:${association.actorId}`
    const record = byKey.get(key)
    if (!record) return []
    const confidence = clamp(record.confidence * association.confidence * record.associationConfidence)
    return [{
      actorKey: key,
      actorKind: association.kind,
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

/** Durable reputation is preferred once backfill has populated it; in-memory history remains a compatibility fallback. */
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
  for (const history of base.outcomeHistory) {
    const matching = base.associations.find(association => association.actorId === history.actorId)
    merged.set(matching ? `${matching.kind}:${history.actorId}` : `unknown:${history.actorId}`, history)
  }
  for (const history of durable) {
    const key = `${history.actorKind}:${history.actorId}`
    const current = merged.get(key)
    if (!current || history.confidence > current.confidence) merged.set(key, history)
  }
  return {
    ...base,
    outcomeHistory: [...merged.values()],
    evidenceIds: [...new Set([...base.evidenceIds, ...durable.flatMap(history => history.evidenceIds)])],
  }
}
