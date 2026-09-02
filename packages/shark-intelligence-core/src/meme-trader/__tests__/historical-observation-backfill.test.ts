import { describe, expect, it } from 'vitest'
import { buildHistoricalObservation } from '../historical-observation-backfill'
import type { TokenLaunch } from '../wallet-launch-pipeline'

const launch: TokenLaunch = {
  launchId: 'launch-1', chainId: 'solana-mainnet', tokenAddress: 'mint-1', deployerWalletId: 'dev-1', launchedAt: '2026-01-01T00:00:00.000Z', outcome: 'UNKNOWN', evidenceIds: ['launch:e1'],
}

describe('historical observation backfill', () => {
  it('derives point-in-time price trajectory and holder behavior', () => {
    const result = buildHistoricalObservation({
      launch,
      now: '2026-01-03T00:00:00.000Z',
      candles: [
        { observedAt: '2026-01-01T00:00:00.000Z', open: 1, high: 2, low: 0.9, close: 1.5, source: 'test', evidenceId: 'price:1' },
        { observedAt: '2026-01-02T00:00:00.000Z', open: 1.5, high: 2.5, low: 0.4, close: 0.5, source: 'test', evidenceId: 'price:2' },
      ],
      holders: [
        { observedAt: '2026-01-01T00:00:00.000Z', holderCount: 100, source: 'test', evidenceId: 'holders:1' },
        { observedAt: '2026-01-02T00:00:00.000Z', holderCount: 40, source: 'test', evidenceId: 'holders:2' },
      ],
      movements: [{ observedAt: '2026-01-02T00:00:00.000Z', actorId: 'dev-1', direction: 'SELL', amountUsd: 500, source: 'test', evidenceId: 'dev:1' }],
    })
    expect(result.priceReturnFromLaunchPct).toBe(-50)
    expect(result.peakReturnPct).toBe(150)
    expect(result.holderExitPct).toBe(0.6)
    expect(result.holderBehavior).toBe('PANIC_EXIT')
    expect(result.developerSoldPct).toBe(1)
    expect(result.evidenceIds).toEqual(expect.arrayContaining(['launch:e1', 'price:1', 'holders:2', 'dev:1']))
  })

  it('does not invent liquidity when the source has no liquidity history', () => {
    const result = buildHistoricalObservation({ launch, now: '2026-01-03T00:00:00.000Z', candles: [] })
    expect(result.currentLiquidityUsd).toBeUndefined()
    expect(result.peakLiquidityUsd).toBeUndefined()
    expect(result.liquidityRemoved).toBeUndefined()
  })
})
