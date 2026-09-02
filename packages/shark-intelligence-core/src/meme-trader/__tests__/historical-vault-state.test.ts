import { describe, expect, it } from 'vitest'
import { historicalVaultStates, reconstructHistoricalVaultState } from '../historical-vault-state'

type TestInput = {
  base: string
  quote: string
  pool: string
  signature: string
  preBase: string
  postBase: string
  preQuote: string
  postQuote: string
}

function tx(input: TestInput) {
  const keys = [input.base, input.quote, input.pool]
  return {
    signature: input.signature,
    observedAt: '2026-01-01T00:00:00.000Z',
    accountAddress: input.pool,
    evidenceId: `helius:${input.signature}`,
    raw: {
      transaction: { message: { accountKeys: keys } },
      meta: {
        preTokenBalances: [
          { accountIndex: 0, mint: 'BASE', uiTokenAmount: { amount: input.preBase, decimals: 6 } },
          { accountIndex: 1, mint: 'QUOTE', uiTokenAmount: { amount: input.preQuote, decimals: 9 } },
        ],
        postTokenBalances: [
          { accountIndex: 0, mint: 'BASE', uiTokenAmount: { amount: input.postBase, decimals: 6 } },
          { accountIndex: 1, mint: 'QUOTE', uiTokenAmount: { amount: input.postQuote, decimals: 9 } },
        ],
      },
    },
  }
}

function pool() {
  return {
    poolAddress: 'POOL',
    baseMint: 'BASE',
    quoteMint: 'QUOTE',
    observedAt: '2026-01-01T00:00:00.000Z',
    source: 'test',
    evidenceId: 'pool:evidence',
  }
}

const accounts = [
  { address: 'BASE_VAULT', role: 'token-vault' as const, mint: 'BASE', source: 'test', evidenceId: 'base:vault' },
  { address: 'QUOTE_VAULT', role: 'token-vault' as const, mint: 'QUOTE', source: 'test', evidenceId: 'quote:vault' },
]

describe('historical vault state reconstruction', () => {
  it('reconstructs a liquidity addition from pre/post vault balances', () => {
    const state = reconstructHistoricalVaultState({
      transaction: tx({ base: 'BASE_VAULT', quote: 'QUOTE_VAULT', pool: 'POOL', signature: 'ADD', preBase: '100', postBase: '200', preQuote: '1000', postQuote: '2000' }),
      pool: pool(),
      accounts,
    })
    expect(state?.baseDeltaRaw).toBe(100n)
    expect(state?.quoteDeltaRaw).toBe(1000n)
    expect(state?.kind).toBe('LIQUIDITY_ADD')
  })

  it('reconstructs a liquidity removal and preserves transaction evidence', () => {
    const state = reconstructHistoricalVaultState({
      transaction: tx({ base: 'BASE_VAULT', quote: 'QUOTE_VAULT', pool: 'POOL', signature: 'REMOVE', preBase: '200', postBase: '100', preQuote: '2000', postQuote: '1000' }),
      pool: pool(),
      accounts,
    })
    expect(state?.kind).toBe('LIQUIDITY_REMOVE')
    expect(state?.evidenceId).toBe('helius:REMOVE')
  })

  it('does not cross-contaminate unrelated token balances', () => {
    const transaction = tx({ base: 'BASE_VAULT', quote: 'QUOTE_VAULT', pool: 'POOL', signature: 'OTHER', preBase: '100', postBase: '100', preQuote: '1000', postQuote: '1000' })
    transaction.raw.meta.postTokenBalances.push({ accountIndex: 2, mint: 'OTHER', uiTokenAmount: { amount: '999999', decimals: 6 } })
    const state = reconstructHistoricalVaultState({ transaction, pool: pool(), accounts })
    expect(state?.baseVault.mint).toBe('BASE')
    expect(state?.quoteVault.mint).toBe('QUOTE')
    expect(state?.baseDeltaRaw).toBe(0n)
  })

  it('builds a chronological state series', () => {
    const first = tx({ base: 'BASE_VAULT', quote: 'QUOTE_VAULT', pool: 'POOL', signature: '1', preBase: '100', postBase: '200', preQuote: '1000', postQuote: '2000' })
    const second = { ...tx({ base: 'BASE_VAULT', quote: 'QUOTE_VAULT', pool: 'POOL', signature: '2', preBase: '200', postBase: '100', preQuote: '2000', postQuote: '1000' }), observedAt: '2026-01-01T01:00:00.000Z' }
    const states = historicalVaultStates({ history: { pool: pool(), accounts, transactions: [second, first], source: 'test', evidenceIds: [] }, accounts })
    expect(states.map(s => s.signature)).toEqual(['1', '2'])
  })
})
