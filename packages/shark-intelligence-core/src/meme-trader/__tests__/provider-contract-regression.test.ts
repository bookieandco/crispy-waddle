import { describe, expect, it } from 'vitest'
import { normalizeDexScreenerPair } from '../dexscreener-event-ingest'
import { isHeliusWebhookAuthorizationValid } from '../helius-webhook-auth'
import { HeliusHistoricalSource } from '../helius-historical-source'
import { CoinGeckoHistoricalSource } from '../coingecko-historical-source'
import type { TokenLaunch } from '../wallet-launch-pipeline'

const launch: TokenLaunch = {
  launchId: 'provider-contract',
  chainId: 'solana-mainnet',
  tokenAddress: 'Mint111',
  deployerWalletId: 'Wallet111',
  launchedAt: '2026-09-20T00:00:00.000Z',
  outcome: 'UNKNOWN',
  evidenceIds: ['fixture:launch'],
}

describe('SHARK provider contract fixtures', () => {
  it('matches Helius authHeader verbatim instead of inventing Bearer semantics', () => {
    expect(isHeliusWebhookAuthorizationValid('shark-secret', 'shark-secret')).toBe(true)
    expect(isHeliusWebhookAuthorizationValid('Bearer shark-secret', 'shark-secret')).toBe(false)
    expect(isHeliusWebhookAuthorizationValid(null, 'shark-secret')).toBe(false)
  })

  it('accepts the documented Helius transfer row shape including string uiAmount', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({
      result: {
        data: [{
          signature: 'sig-1',
          slot: 315073428,
          blockTime: 1789862400,
          type: 'transfer',
          fromUserAccount: 'Wallet111',
          toUserAccount: 'Wallet222',
          mint: 'Mint111',
          amount: '2500000',
          decimals: 6,
          uiAmount: '2.5',
          confirmationStatus: 'finalized',
          transactionIdx: 35,
          instructionIdx: 1,
          innerInstructionIdx: 0,
        }],
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch

    const source = new HeliusHistoricalSource({ apiKey: 'fixture', fetchImpl })
    const movements = await source.deployerTransfers(launch)
    expect(movements).toHaveLength(1)
    expect(movements[0].tokenAmount).toBe(2.5)
    expect(movements[0].direction).toBe('TRANSFER_OUT')
    expect(movements[0].evidenceId).toContain('sig-1:35:1:0')
  })

  it('accepts the documented CoinGecko token OHLCV tuple and labels provider-selected-pool semantics', async () => {
    const launched = Math.floor(Date.parse(launch.launchedAt) / 1000)
    const fetchImpl = (async () => new Response(JSON.stringify({
      data: { attributes: { ohlcv_list: [[launched, 1, 2, .5, 1.5, 3481.67]] } },
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch

    const source = new CoinGeckoHistoricalSource({ apiKey: 'fixture', fetchImpl })
    const candles = await source.candles(launch)
    expect(candles).toHaveLength(1)
    expect(candles[0]).toMatchObject({
      open: 1, high: 2, low: .5, close: 1.5, volumeUsd: 3481.67,
      source: 'coingecko-token-ohlcv-most-liquid-pool',
    })
  })

  it('accepts the documented DexScreener pair shape without treating pair creation as observation time', () => {
    const receivedAt = '2026-09-20T12:00:00.000Z'
    const evidence = normalizeDexScreenerPair({
      chainId: 'solana',
      dexId: 'raydium',
      pairAddress: 'Pair111',
      baseToken: { address: 'Mint111', name: 'Meme', symbol: 'MEME' },
      quoteToken: { address: 'Quote111', name: 'USD Coin', symbol: 'USDC' },
      priceNative: '0.01',
      priceUsd: '0.25',
      txns: { h24: { buys: 120, sells: 80 } },
      volume: { h24: 500000 },
      liquidity: { usd: 100000, base: 1000, quote: 25000 },
      pairCreatedAt: Date.parse('2026-09-20T10:00:00.000Z'),
    }, receivedAt)
    expect(evidence.observedAt).toBe(receivedAt)
    expect(evidence.payload.pairAgeHours).toBe(2)
    expect(evidence.payload.priceUsd).toBe(.25)
  })
})
