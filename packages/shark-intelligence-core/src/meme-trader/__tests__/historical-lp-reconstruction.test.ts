import { describe, expect, it } from 'vitest'
import { reconstructHistoricalPoolLiquidity, resolvePoolVaults } from '../historical-lp-reconstruction'
import type { PoolHistory } from '../solana-pool-history'

const BASE = 'Base111111111111111111111111111111111111111'
const QUOTE = 'Quote11111111111111111111111111111111111111'
const BASE_VAULT = 'BaseVault1111111111111111111111111111111111'
const QUOTE_VAULT = 'QuoteVault11111111111111111111111111111111'

function tx(signature: string, observedAt: string, base: number, quote: number) {
  return {
    signature,
    observedAt,
    accountAddress: 'pool',
    evidenceId: `ev:${signature}`,
    raw: {
      transaction: { message: { accountKeys: [BASE_VAULT, QUOTE_VAULT] } },
      meta: {
        postTokenBalances: [
          { accountIndex: 0, mint: BASE, uiTokenAmount: { uiAmount: base, decimals: 6 } },
          { accountIndex: 1, mint: QUOTE, uiTokenAmount: { uiAmount: quote, decimals: 9 } },
        ],
      },
    },
  }
}

const history = {
  pool: { poolAddress: 'Pool111111111111111111111111111111111111111', observedAt: '2026-09-01T00:00:00.000Z', source: 'test', evidenceId: 'pool:1' },
  accounts: [],
  source: 'test',
  evidenceIds: ['pool:1'],
  transactions: [
    tx('a', '2026-09-01T00:00:00.000Z', 100, 50),
    tx('b', '2026-09-01T01:00:00.000Z', 120, 60),
    tx('c', '2026-09-01T02:00:00.000Z', 90, 45),
  ],
} as unknown as PoolHistory

describe('historical LP reconstruction', () => {
  it('reconstructs vault reserves and classifies add/remove events', () => {
    const result = reconstructHistoricalPoolLiquidity({ history, venue: 'pumpswap', baseMint: BASE, quoteMint: QUOTE, baseVault: BASE_VAULT, quoteVault: QUOTE_VAULT })
    expect(result.snapshots).toHaveLength(3)
    expect(result.events.map(event => event.kind)).toEqual(['LIQUIDITY_ADD', 'LIQUIDITY_REMOVE'])
    expect(result.events[0].baseDelta).toBe(20)
    expect(result.events[1].baseDelta).toBe(-30)
    expect(result.usdValuationCoverage).toBe(0)
    expect(result.evidenceIds).toContain('ev:b')
  })

  it('accepts point-in-time quote valuation but never invents it', () => {
    const result = reconstructHistoricalPoolLiquidity({
      history,
      venue: 'raydium',
      baseMint: BASE,
      quoteMint: QUOTE,
      baseVault: BASE_VAULT,
      quoteVault: QUOTE_VAULT,
      quoteUsdPrice: () => 2,
    })
    expect(result.usdValuationCoverage).toBe(1)
    expect(result.snapshots[0].liquidityUsd).toBe(200)
  })

  it('rejects vault metadata without mint identity', () => {
    expect(() => resolvePoolVaults([
      { address: BASE_VAULT, role: 'token-vault', source: 'test', evidenceId: 'base' },
      { address: QUOTE_VAULT, role: 'token-vault', mint: QUOTE, source: 'test', evidenceId: 'quote' },
    ], { baseMint: BASE, quoteMint: QUOTE })).toThrow()
  })
})
