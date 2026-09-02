import { describe, expect, it } from 'vitest'
import { createActorAwareMemeTradeAssessment } from '../actor-aware-assessment'

const graph = { nodes: [], edges: [] } as any

const baseInput = {
  assessmentId: 'composition',
  assessedAt: '2026-01-01T00:00:00Z',
  market: {
    observationId: 'market-1', source: 'dexscreener', observedAt: '2026-01-01T00:00:00Z', receivedAt: '2026-01-01T00:00:01Z',
    chainId: 'solana', subjectId: 'TOKEN', payload: { liquidityUsd: 100000, volume24hUsd: 200000, buys24h: 100, sells24h: 50 },
  },
  tradeType: 'new-pair-speculation' as const,
  strategyFit: { score: .8, matchedSignals: [], conflicts: [] },
  holderCohort: { score: .8, profitableTrackedWallets: 0, accumulatingWallets: 0, distributingWallets: 0, reasons: [] },
  thesis: 'test',
  invalidation: { conditions: ['liquidity loss'], severity: 'high' as const },
  positionPlan: { maxPositionFraction: .01, entryConditions: [], profitTakingConditions: [], exitConditions: [] },
  confidence: .8,
}

const withdrawal = {
  signature: 'SIG', observedAt: '2026-01-01T00:00:00Z', poolAddress: 'POOL', lpMint: 'LP', lpTokenAccount: 'LP_ACCOUNT', lpAmountRaw: 1000n,
  ownerBefore: 'DEVELOPER', lpStateEventId: 'lp-event', raydiumWithdrawalEventId: 'withdrawal-event', developerAssociation: 'MATCHED' as const,
  evidenceIds: ['withdrawal-evidence'], confidence: .9,
}

const migration = {
  kind: 'LEGITIMATE_MIGRATION' as const, confidence: .9, evidenceIds: ['migration-evidence'], migrationId: 'migration-1',
  withdrawalEventId: 'withdrawal-event', withdrawalSignature: 'SIG', reason: 'legitimate_migration:migration-1', hardBlockRug: false,
}

describe('canonical actor-aware assessment composition', () => {
  it('passes verified withdrawal and exact migration classification into actor risk', () => {
    const result = createActorAwareMemeTradeAssessment({
      ...baseInput,
      actorGraph: graph,
      verifiedLPWithdrawals: [withdrawal],
      migrationClassifications: { 'withdrawal-event': migration },
    })
    expect(result.riskAssessment.developerRisk).toBe(0)
    expect(result.evidenceIds).toEqual(expect.arrayContaining(['withdrawal-evidence', 'migration-evidence']))
  })

  it('does not silently manufacture actor evidence when optional inputs are absent', () => {
    const result = createActorAwareMemeTradeAssessment({ ...baseInput, actorGraph: graph })
    expect(result.riskAssessment.developerRisk).toBe(0)
    expect(result.evidenceIds).toContain('market-1')
  })
})
