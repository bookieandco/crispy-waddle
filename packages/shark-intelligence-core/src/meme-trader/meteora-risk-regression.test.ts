import { describe, expect, it } from 'vitest'
import { createMeteoraDlmmPositionEvidence, reconcileMeteoraDlmmPosition } from './meteora-dlmm'
import { meteoraDlmmLiquidityEvidence } from './meteora-liquidity-adapter'
import { attributeMeteoraDlmmWithdrawal, verifiedAdversarialMeteoraWithdrawals } from './meteora-withdrawal-attribution'

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
