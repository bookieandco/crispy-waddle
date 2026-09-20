import { describe, expect, it } from 'vitest'
import { createMeteoraDlmmPositionEvidence, reconcileMeteoraDlmmPosition } from './meteora-dlmm'
import { meteoraDlmmLiquidityEvidence } from './meteora-liquidity-adapter'
import { attributeMeteoraDlmmWithdrawal, verifiedAdversarialMeteoraWithdrawals } from './meteora-withdrawal-attribution'
import { applyActorRiskIntelligence } from './actor-risk-integration'

const snapshot = (id: string, lower: number, upper: number, x: bigint, y: bigint) =>
  createMeteoraDlmmPositionEvidence({
    evidenceId: id, observedAt: '2026-09-18T20:00:00Z', lbPair: 'pair-1',
    position: 'position-1', owner: 'dev-wallet', lowerBinId: lower, upperBinId: upper,
    bins: [{ binId: lower, amountX: x, amountY: y }],
  })

const graph: any = {
  nodes: [
    { id: 'wallet:dev-wallet', kind: 'wallet', confidence: .95, evidenceIds: ['wallet-ev'] },
    { id: 'token:solana-mainnet:mint-1', kind: 'token', confidence: 1, evidenceIds: ['token-ev'] },
  ],
  edges: [{ id: 'deploy-edge', from: 'wallet:dev-wallet', to: 'token:solana-mainnet:mint-1', relation: 'deployed', observedAt: '2026-09-18T19:00:00Z', confidence: .9, evidenceIds: ['deploy-ev'] }],
  clusters: [],
}

describe('Meteora DLMM risk invariants', () => {
  it('attributes a genuine developer liquidity removal', () => {
    const delta = reconcileMeteoraDlmmPosition(snapshot('before', 10, 10, 100n, 100n), snapshot('after', 10, 10, 40n, 50n), 'remove-ev')
    expect(delta.kind).toBe('LIQUIDITY_REMOVE')
    const attributed = attributeMeteoraDlmmWithdrawal({ delta, graph, tokenAddress: 'mint-1' })
    expect(attributed?.association).toBe('DIRECT_DEPLOYER')
    expect(verifiedAdversarialMeteoraWithdrawals([attributed!])).toHaveLength(1)
  })

  it('suppresses a normal range rebalance from withdrawal semantics', () => {
    const delta = reconcileMeteoraDlmmPosition(snapshot('before', 10, 10, 100n, 100n), snapshot('after', 11, 11, 80n, 120n), 'rebalance-ev')
    expect(delta.kind).toBe('REBALANCE')
    expect(meteoraDlmmLiquidityEvidence(delta)).toEqual([])
    expect(attributeMeteoraDlmmWithdrawal({ delta, graph, tokenAddress: 'mint-1' })).toBeNull()
  })


  it('reconstructs mixed per-bin movement without mislabeling it as a withdrawal', () => {
    const before = createMeteoraDlmmPositionEvidence({
      evidenceId: 'mixed-before', observedAt: '2026-09-18T20:00:00Z', lbPair: 'pair-1',
      position: 'position-1', owner: 'dev-wallet', lowerBinId: 10, upperBinId: 11,
      bins: [{ binId: 10, amountX: 100n, amountY: 20n }, { binId: 11, amountX: 10n, amountY: 100n }],
    })
    const after = createMeteoraDlmmPositionEvidence({
      evidenceId: 'mixed-after', observedAt: '2026-09-18T20:01:00Z', lbPair: 'pair-1',
      position: 'position-1', owner: 'dev-wallet', lowerBinId: 10, upperBinId: 11,
      bins: [{ binId: 10, amountX: 40n, amountY: 80n }, { binId: 11, amountX: 50n, amountY: 30n }],
    })
    const delta = reconcileMeteoraDlmmPosition(before, after, 'mixed')
    expect(delta.kind).toBe('REBALANCE')
    expect(delta.grossRemovedX).toBe(60n)
    expect(delta.grossAddedX).toBe(40n)
    expect(delta.grossRemovedY).toBe(70n)
    expect(delta.grossAddedY).toBe(60n)
    expect(meteoraDlmmLiquidityEvidence(delta)).toEqual([])
  })

  it('rejects duplicate bin evidence instead of double-counting BinArray state', () => {
    expect(() => createMeteoraDlmmPositionEvidence({
      evidenceId: 'duplicate-bin', observedAt: '2026-09-18T20:00:00Z', lbPair: 'pair-1',
      position: 'position-1', owner: 'dev-wallet', lowerBinId: 10, upperBinId: 11,
      bins: [{ binId: 10, amountX: 1n, amountY: 1n }, { binId: 10, amountX: 2n, amountY: 2n }],
    })).toThrow('Duplicate Meteora DLMM bin evidence')
  })

  it('does not promote cluster-only association to verified adversarial withdrawal', () => {
    const clusterGraph: any = {
      ...graph, edges: [],
      clusters: [{ clusterId: 'cluster:c1', nodeIds: ['wallet:dev-wallet', 'token:solana-mainnet:mint-1'], confidence: .9, evidenceIds: ['cluster-ev'] }],
    }
    const delta = reconcileMeteoraDlmmPosition(snapshot('before', 10, 10, 100n, 100n), snapshot('after', 10, 10, 20n, 20n), 'cluster-remove')
    const attributed = attributeMeteoraDlmmWithdrawal({ delta, graph: clusterGraph, tokenAddress: 'mint-1' })!
    expect(attributed.association).toBe('CLUSTER_ASSOCIATED')
    expect(verifiedAdversarialMeteoraWithdrawals([attributed])).toEqual([])
  })
})

const baseAssessment: any = {
  assessmentId: 'meteora-risk', assessedAt: '2026-09-18T20:00:00Z', token: { chainId: 'solana-mainnet', tokenAddress: 'mint-1' }, tradeType: 'new-pair-speculation',
  marketActivityQuality: { score: .8, volumeScore: .8, liquidityScore: .8, flowScore: .8, buyerGrowthScore: .8, manipulationPenalty: 0, reasons: [] },
  supplyControl: { score: 0, deployerRisk: 0, concentrationRisk: 0, bundledSupplyRisk: 0, liquidityControlRisk: 0, reasons: [] },
  holderCohort: { score: .8, profitableTrackedWallets: 0, accumulatingWallets: 0, distributingWallets: 0, reasons: [] },
  attention: { score: .8, crossSourceConfirmation: .8, engagementQuality: .8, sourceCredibility: .8, manipulationPenalty: 0, reasons: [] },
  strategyFit: { score: .8, matchedSignals: [], conflicts: [] },
  riskAssessment: { marketIntegrity: .1, liquidityRisk: .1, supplyControlRisk: 0, holderConcentrationRisk: .1, walletCohortRisk: 0, socialManipulationRisk: 0, narrativeFragilityRisk: .1, developerRisk: 0, contractRisk: 0, networkRisk: .1, attentionQuality: .8, exitLiquidityRisk: .1, overallRisk: .1, band: 'candidate' },
  thesis: 'test', invalidation: { conditions: ['liquidity loss'], severity: 'high' }, positionPlan: { maxPositionFraction: .01, entryConditions: [], profitTakingConditions: [], exitConditions: [] }, confidence: .5, evidenceIds: ['base'], assessmentVersion: 'test',
}

describe('Meteora multi-venue risk fusion', () => {
  it('does not double-count conventional LP and DLMM developer withdrawals', () => {
    const delta = reconcileMeteoraDlmmPosition(snapshot('before-risk', 10, 10, 100n, 100n), snapshot('after-risk', 10, 10, 20n, 20n), 'meteora-remove')
    const meteora = attributeMeteoraDlmmWithdrawal({ delta, graph, tokenAddress: 'mint-1' })!
    const conventional: any = {
      signature: 'sig', observedAt: delta.observedAt, poolAddress: 'pool', lpMint: 'lp', lpTokenAccount: 'acct',
      ownerBefore: 'dev-wallet', lpStateEventId: 'lp-event', developerAssociation: 'MATCHED',
      evidenceIds: ['conventional-remove'], confidence: .9,
    }
    const onlyMeteora = applyActorRiskIntelligence(baseAssessment, { verifiedMeteoraWithdrawals: [meteora] })
    const both = applyActorRiskIntelligence(baseAssessment, { verifiedMeteoraWithdrawals: [meteora], verifiedLPWithdrawals: [conventional] })
    expect(onlyMeteora.riskAssessment.developerRisk).toBe(.8)
    expect(both.riskAssessment.developerRisk).toBe(.8)
    expect(both.supplyControl.deployerRisk).toBe(onlyMeteora.supplyControl.deployerRisk)
  })
})
