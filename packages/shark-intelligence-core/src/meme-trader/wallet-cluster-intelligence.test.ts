import { describe, expect, it } from 'vitest'
import { classifyWalletMeteoraAdversarialRisk, fuseWalletClusterWithMeteoraSignals } from './wallet-meteora-adversarial-fusion'
import { detectWalletClusters, type WalletClusterTrade } from './wallet-cluster-intelligence'

const t = (walletId: string, observedAt: string, extra: Partial<WalletClusterTrade> = {}): WalletClusterTrade => ({
  walletId,
  tokenMint: 'TOKEN',
  observedAt,
  side: 'BUY',
  ...extra,
})

describe('wallet cluster intelligence', () => {
  it('detects temporal convergence across distinct wallets', () => {
    const result = detectWalletClusters([
      t('A', '2026-09-03T10:00:00.000Z', { walletScore: 8 }),
      t('B', '2026-09-03T10:04:00.000Z', { walletScore: 7 }),
      t('C', '2026-09-03T10:08:00.000Z', { walletScore: 6 }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].wallets).toEqual(['A', 'B', 'C'])
    expect(result[0].hypothesis).toBe('TEMPORAL_CONVERGENCE')
    expect(result[0].confidence).toBeGreaterThan(0)
  })

  it('does not cluster wallets outside the configured time window', () => {
    const result = detectWalletClusters([
      t('A', '2026-09-03T10:00:00.000Z'),
      t('B', '2026-09-03T10:16:00.000Z'),
      t('C', '2026-09-03T10:32:00.000Z'),
    ])
    expect(result).toHaveLength(0)
  })

  it('uses funding overlap as supporting evidence rather than proof of ownership', () => {
    const result = detectWalletClusters([
      t('A', '2026-09-03T10:00:00.000Z', { funderIds: ['F1'] }),
      t('B', '2026-09-03T10:01:00.000Z', { funderIds: ['F1'] }),
      t('C', '2026-09-03T10:02:00.000Z', { funderIds: ['F1'] }),
    ])
    expect(result[0].fundingRelationshipScore).toBeGreaterThan(0)
    expect(result[0].hypothesis).not.toBe('COORDINATED_BEHAVIOR')
  })

  it('excludes known infrastructure wallets from clustering', () => {
    const result = detectWalletClusters(
      [t('A', '2026-09-03T10:00:00.000Z'), t('B', '2026-09-03T10:01:00.000Z'), t('C', '2026-09-03T10:02:00.000Z')],
      {},
      [{ walletId: 'A', reason: 'EXCHANGE' }],
    )
    expect(result).toHaveLength(0)
  })
})

describe('wallet + Meteora adversarial fusion', () => {
  it('raises concern when cluster participation overlaps coordinated liquidity withdrawal', () => {
    const cluster = detectWalletClusters([
      t('A', '2026-09-03T10:00:00.000Z', { walletScore: 9 }),
      t('B', '2026-09-03T10:01:00.000Z', { walletScore: 8 }),
      t('C', '2026-09-03T10:02:00.000Z', { walletScore: 8 }),
    ])[0]
    const result = fuseWalletClusterWithMeteoraSignals(cluster, [{
      signalId: 'm1', kind: 'COORDINATED_WITHDRAWAL', score: 0.9, confidence: 0.9,
      evidenceIds: ['e-m1'], observedAt: '2026-09-03T10:10:00.000Z', poolAddress: 'POOL', actorIds: ['A', 'B', 'C'],
    }])
    expect(result[0].adversarialScore).toBeGreaterThan(0.5)
    expect(classifyWalletMeteoraAdversarialRisk(result[0])).toBe('HIGH')
    expect(result[0].evidenceIds).toContain('e-m1')
  })

  it('does not create an execution or trade authorization decision', () => {
    const cluster = detectWalletClusters([
      t('A', '2026-09-03T10:00:00.000Z'), t('B', '2026-09-03T10:01:00.000Z'), t('C', '2026-09-03T10:02:00.000Z'),
    ])[0]
    const result = fuseWalletClusterWithMeteoraSignals(cluster, [{
      signalId: 'm1', kind: 'RAPID_WITHDRAWAL', score: 1, confidence: 1,
      evidenceIds: ['e1'], observedAt: '2026-09-03T10:10:00.000Z', poolAddress: 'POOL',
    }])
    expect(result[0]).not.toHaveProperty('execute')
    expect(result[0]).not.toHaveProperty('positionSize')
    expect(result[0]).not.toHaveProperty('approval')
  })
})
