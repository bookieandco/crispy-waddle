import { describe, expect, it } from 'vitest'
import { deriveWalletProfile } from './wallet-profile'

describe('wallet profile', () => {
  it('does not serialize infinite profit factor when there are no observed losses', () => {
    const profile = deriveWalletProfile({
      walletId: 'wallet-1',
      chains: ['solana'],
      windowDays: 1,
      evidenceIds: ['e1'],
      observedAt: '2026-09-02T00:00:00.000Z',
      trades: [{ realizedPnl: 10, tokenAddress: 'A' }],
    })

    expect(profile.profitFactor).toBeUndefined()
    expect(JSON.stringify(profile)).not.toContain('Infinity')
  })

  it('calculates finite profit factor when both profit and loss are observed', () => {
    const profile = deriveWalletProfile({
      walletId: 'wallet-2',
      chains: ['solana'],
      windowDays: 2,
      evidenceIds: ['e1', 'e2'],
      observedAt: '2026-09-02T00:00:00.000Z',
      trades: [
        { realizedPnl: 30, tokenAddress: 'A' },
        { realizedPnl: -10, tokenAddress: 'B' },
      ],
    })

    expect(profile.profitFactor).toBe(3)
  })
})
