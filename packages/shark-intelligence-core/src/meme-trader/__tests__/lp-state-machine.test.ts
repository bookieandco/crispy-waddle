import { describe, expect, it } from 'vitest'
import { SolanaLPStateMachine } from '../lp-state-machine'

const pool = { poolAddress: 'POOL', chainId: 'solana-mainnet', tokenAddress: 'TOKEN' } as any

function tx(meta: Record<string, unknown>): any {
  return {
    signature: 'SIG',
    observedAt: '2026-01-01T00:00:00Z',
    accountAddress: 'POOL',
    evidenceId: 'ev:lp',
    raw: {
      transaction: { message: { accountKeys: ['LP_ACCOUNT', 'OWNER', 'OTHER_ACCOUNT'] } },
      meta,
    },
  }
}

describe('Solana LP state machine', () => {
  it('classifies a corroborated LP burn and preserves the pre-withdrawal owner', () => {
    const result = new SolanaLPStateMachine().decode(tx({
      preTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER', uiTokenAmount: { amount: '1000', decimals: 6 } }],
      postTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER', uiTokenAmount: { amount: '0', decimals: 6 } }],
      innerInstructions: [{ index: 0, instructions: [{ program: 'spl-token', parsed: { type: 'burn', info: { account: 'LP_ACCOUNT', mint: 'LP', amount: '1000' } } }] }],
    }), pool, 'LP')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ kind: 'BURN', from: 'OWNER', amountRaw: 1000n, confidence: 1 })
    expect(result[0].evidenceIds).toContain('ev:lp')
  })

  it('does not call a new 0-to-X account a mint without corroborating evidence', () => {
    const result = new SolanaLPStateMachine().decode(tx({
      preTokenBalances: [],
      postTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER', uiTokenAmount: { amount: '1000', decimals: 6 } }],
      innerInstructions: [],
    }), pool, 'LP')

    expect(result[0]).toMatchObject({ kind: 'UNKNOWN', to: 'OWNER', amountRaw: 1000n })
    expect(result[0].confidence).toBeLessThan(1)
  })

  it('classifies a corroborated transfer out from the pre-state owner', () => {
    const result = new SolanaLPStateMachine().decode(tx({
      preTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER_A', uiTokenAmount: { amount: '1000', decimals: 6 } }],
      postTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER_A', uiTokenAmount: { amount: '400', decimals: 6 } }],
      innerInstructions: [{ index: 0, instructions: [{ program: 'spl-token', parsed: { type: 'transfer', info: { source: 'LP_ACCOUNT', destination: 'OTHER_ACCOUNT', mint: 'LP', amount: '600' } } }] }],
    }), pool, 'LP')

    expect(result[0]).toMatchObject({ kind: 'TRANSFER', from: 'OWNER_A', amountRaw: 600n, confidence: 1 })
  })
})
