import { describe, expect, it } from 'vitest'
import { deriveWalletProfile } from '../wallet-profile'

describe('deriveWalletProfile', () => {
  it('derives deterministic behavior metrics from trade evidence', () => {
    const profile = deriveWalletProfile({
      walletId: 'wallet-1',
      chains: ['solana', 'solana'],
      windowDays: 2,
      evidenceIds: ['arkham:1', 'rpc:1'],
      observedAt: '2026-09-02T12:00:00.000Z',
      trades: [
        { tokenAddress: 'A', realizedPnl: 100, holdTimeSeconds: 1800, amountUsd: 100, newPair: true },
        { tokenAddress: 'B', realizedPnl: -50, holdTimeSeconds: 7200, amountUsd: 50, narrative: true },
      ],
    })
    expect(profile.chains).toEqual(['solana'])
    expect(profile.tokensPerDay).toBe(1)
    expect(profile.tradesPerDay).toBe(1)
    expect(profile.winRate).toBe(0.5)
    expect(profile.profitFactor).toBe(2)
    expect(profile.concentration).toBeCloseTo(2 / 3)
    expect(profile.strategyFingerprint).toContain('new-pair')
    expect(profile.strategyFingerprint).toContain('short-hold')
  })
})
