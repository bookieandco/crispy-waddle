import { describe, expect, it } from 'vitest'
import { buildHistoricalObservation } from './historical-observation-backfill'
import { HeliusHistoricalSource } from './helius-historical-source'
import { CoinGeckoHistoricalSource } from './coingecko-historical-source'
import { deriveLiquidityHistory } from './liquidity-history'
import type { TokenLaunch } from './wallet-launch-pipeline'

const launch: TokenLaunch = {
  launchId: 'launch-1',
  chainId: 'solana-mainnet',
  tokenAddress: 'mint-1',
  deployerWalletId: 'developer-1',
  launchedAt: '2026-09-18T20:00:00Z',
  outcome: 'UNKNOWN',
  evidenceIds: ['launch-evidence'],
}

describe('SHARK historical observation regression', () => {
  it('keeps max drawdown normalized to a 0-1 ratio', () => {
    const observation = buildHistoricalObservation({
      launch,
      candles: [
        { observedAt: '2026-09-18T20:00:00Z', open: 100, high: 100, low: 100, close: 100, source: 'test', evidenceId: 'c1' },
        { observedAt: '2026-09-18T20:01:00Z', open: 100, high: 100, low: 20, close: 20, source: 'test', evidenceId: 'c2' },
      ],
      now: '2026-09-18T20:02:00Z',
    })
    expect(observation.maxDrawdownPct).toBeCloseTo(0.8, 10)
  })

  it('derives developer disposal ratio from token quantities', () => {
    const observation = buildHistoricalObservation({
      launch,
      candles: [],
      movements: [
        { observedAt: '2026-09-18T20:01:00Z', actorId: 'developer-1', direction: 'TRANSFER_IN', tokenAmount: 100, source: 'test', evidenceId: 'in' },
        { observedAt: '2026-09-18T20:02:00Z', actorId: 'developer-1', direction: 'TRANSFER_OUT', tokenAmount: 75, source: 'test', evidenceId: 'out' },
      ],
      now: '2026-09-18T20:03:00Z',
    })
    expect(observation.developerSoldPct).toBeCloseTo(75 / 175, 10)
  })

  it('normalizes Helius direction and preserves token quantity', async () => {
    const calls: unknown[] = []
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)))
      return new Response(JSON.stringify({ result: { data: [
        { signature: 'sig-out', blockTime: 1789761660, fromUserAccount: 'developer-1', toUserAccount: 'other', uiAmount: 25, amount: '25000000', decimals: 6 },
        { signature: 'sig-in', blockTime: 1789761720, fromUserAccount: 'other', toUserAccount: 'developer-1', amount: '10000000', decimals: 6 },
        { signature: 'sig-unrelated', blockTime: 1789761780, fromUserAccount: 'x', toUserAccount: 'y', uiAmount: 999 },
      ] } }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    const source = new HeliusHistoricalSource({ apiKey: 'test-key', fetchImpl })
    const movements = await source.deployerTransfers(launch)
    expect(movements.map(m => [m.direction, m.tokenAmount])).toEqual([
      ['TRANSFER_OUT', 25],
      ['TRANSFER_IN', 10],
    ])
    const rpc = calls[0] as { params: unknown[] }
    expect(rpc.params).toEqual(['developer-1', expect.objectContaining({ mint: 'mint-1', limit: 100, sortOrder: 'asc' })])
  })
  it('maps solana-mainnet to CoinGecko solana for holder history', async () => {
    const urls: string[] = []
    const fetchImpl = (async (url: string | URL | Request) => {
      urls.push(String(url))
      return new Response(JSON.stringify({ data: { attributes: { holders_chart: [] } } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const source = new CoinGeckoHistoricalSource({ apiKey: 'test-key', fetchImpl })
    await source.holderHistory(launch)

    expect(urls[0]).toContain('/onchain/networks/solana/tokens/mint-1/holders_chart')
    expect(urls[0]).not.toContain('/onchain/networks/solana-mainnet/')
  })

  it('derives immutable snapshot identity from all evidence, not only the last candle', () => {
    const base = buildHistoricalObservation({
      launch,
      candles: [{ observedAt: '2026-09-18T20:01:00Z', open: 1, high: 1, low: 1, close: 1, source: 'test', evidenceId: 'candle-same' }],
      holders: [{ observedAt: '2026-09-18T20:02:00Z', holderCount: 10, source: 'test', evidenceId: 'holders-a' }],
      now: '2026-09-18T20:03:00Z',
    })
    const repeated = buildHistoricalObservation({
      launch,
      candles: [{ observedAt: '2026-09-18T20:01:00Z', open: 1, high: 1, low: 1, close: 1, source: 'test', evidenceId: 'candle-same' }],
      holders: [{ observedAt: '2026-09-18T20:02:00Z', holderCount: 10, source: 'test', evidenceId: 'holders-a' }],
      now: '2026-09-18T20:04:00Z',
    })
    const revised = buildHistoricalObservation({
      launch,
      candles: [{ observedAt: '2026-09-18T20:01:00Z', open: 1, high: 1, low: 1, close: 1, source: 'test', evidenceId: 'candle-same' }],
      holders: [{ observedAt: '2026-09-18T20:05:00Z', holderCount: 12, source: 'test', evidenceId: 'holders-b' }],
      now: '2026-09-18T20:06:00Z',
    })

    expect(repeated.observationId).toBe(base.observationId)
    expect(revised.observationId).not.toBe(base.observationId)
    expect(base.observedAt).toBe('2026-09-18T20:02:00Z')
    expect(revised.observedAt).toBe('2026-09-18T20:05:00Z')
  })

  it('preserves complete liquidity history metrics in the historical snapshot', () => {
    const liquidityHistory = deriveLiquidityHistory([
      { observedAt: '2026-09-18T20:00:00Z', liquidityUsd: 1000, source: 'test', evidenceId: 'liq-1' },
      { observedAt: '2026-09-18T20:01:00Z', liquidityUsd: 800, source: 'test', evidenceId: 'liq-2' },
      { observedAt: '2026-09-18T20:02:00Z', liquidityUsd: 400, source: 'test', evidenceId: 'liq-3' },
    ])
    const observation = buildHistoricalObservation({
      launch,
      candles: [],
      liquidityHistory,
      now: '2026-09-18T20:03:00Z',
    })

    expect(observation.initialLiquidityUsd).toBe(liquidityHistory.initialLiquidityUsd)
    expect(observation.currentLiquidityUsd).toBe(liquidityHistory.currentLiquidityUsd)
    expect(observation.peakLiquidityUsd).toBe(liquidityHistory.peakLiquidityUsd)
    expect(observation.liquidityDrawdownFromPeak).toBe(liquidityHistory.drawdownFromPeak)
    expect(observation.liquidityDrainRate).toBe(liquidityHistory.drainRate)
    expect(observation.liquidityDrainAcceleration).toBe(liquidityHistory.drainAcceleration)
    expect(observation.liquidityStabilityScore).toBe(liquidityHistory.stabilityScore)
    expect(observation.evidenceIds).toEqual(expect.arrayContaining(['liq-1', 'liq-2', 'liq-3']))
  })

})