import { describe, expect, it } from 'vitest'
import { deriveTokenActorGraph } from '../entity-graph'
import { matchPersistedActorOutcomeHistory, derivePersistedActorIntelligence, type PersistedActorOutcomeRecord } from '../persisted-actor-intelligence'

const record = (actorKey: string, actorKind: PersistedActorOutcomeRecord['actorKind']): PersistedActorOutcomeRecord => ({
  actorKey,
  actorKind,
  actorId: actorKey.split(':')[1],
  launches: 4,
  healthyLaunches: 1,
  badLaunches: 3,
  failedLaunches: 0,
  rugRate: 0.75,
  pumpAndDumpRate: 0,
  outcomeCoverage: 1,
  confidence: 0.9,
  associationConfidence: 0.8,
  evidenceIds: ['rep-1'],
})

describe('persisted actor intelligence', () => {
  it('matches durable reputation only to actors actually associated with the current token', () => {
    const graph = deriveTokenActorGraph({
      chainId: 'solana-mainnet',
      tokenAddress: 'TOKEN-1',
      deployerWalletId: 'WALLET-1',
      developerEntityId: 'DEV-1',
      clusterId: 'CLUSTER-1',
      evidenceIds: ['graph-1'],
    })
    const associations = graph.edges.length ? [{ actorId: 'DEV-1', kind: 'developer' as const, confidence: 0.8, evidenceIds: ['graph-1'] }] : []
    const matched = matchPersistedActorOutcomeHistory({
      associations,
      records: [record('developer:DEV-1', 'developer'), record('developer:DEV-OTHER', 'developer')],
    })
    expect(matched).toHaveLength(1)
    expect(matched[0].actorId).toBe('DEV-1')
    expect(matched[0].confidence).toBeCloseTo(0.576)
  })

  it('preserves actor kind so same identifier cannot cross-contaminate reputation', () => {
    const associations = [
      { actorId: 'SHARED', kind: 'wallet' as const, confidence: 1, evidenceIds: [] },
      { actorId: 'SHARED', kind: 'developer' as const, confidence: 1, evidenceIds: [] },
    ]
    const matched = matchPersistedActorOutcomeHistory({
      associations,
      records: [record('wallet:SHARED', 'wallet'), record('developer:SHARED', 'developer')],
    })
    expect(matched).toHaveLength(2)
    expect(new Set(matched.map(item => item.actorKind))).toEqual(new Set(['wallet', 'developer']))
  })

  it('prefers durable reputation when it has stronger confidence than compatibility history', () => {
    const graph = deriveTokenActorGraph({
      chainId: 'solana-mainnet',
      tokenAddress: 'TOKEN-2',
      developerEntityId: 'DEV-2',
      evidenceIds: ['graph-2'],
    })
    const result = derivePersistedActorIntelligence({
      currentGraph: graph,
      currentTokenAddress: 'TOKEN-2',
      historicalLaunches: [],
      persistedRecords: [record('developer:DEV-2', 'developer')],
    })
    expect(result.outcomeHistory).toHaveLength(1)
    expect(result.outcomeHistory[0].rugRate).toBe(0.75)
    expect(result.evidenceIds).toContain('rep-1')
  })
})
