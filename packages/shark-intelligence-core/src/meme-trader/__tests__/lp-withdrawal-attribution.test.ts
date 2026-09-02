import { describe, expect, it } from 'vitest'
import { attributeLPWithdrawals, verifiedLPWithdrawals } from '../lp-withdrawal-attribution'
import type { LiquidityEventEvidence } from '../liquidity-event-semantics'
import type { LPPositionEvent } from '../lp-position-ledger'

const removal: LiquidityEventEvidence = {
  eventId: 'raydium:SIG:LIQUIDITY_REMOVE:LP',
  kind: 'LIQUIDITY_REMOVE',
  observedAt: '2026-01-01T00:00:00Z',
  poolAddress: 'POOL',
  lpMint: 'LP',
  amountRaw: 1000n,
  source: 'raydium-amm:withdraw',
  evidenceIds: ['ev:withdraw'],
  confidence: 1,
  semantic: 'EXPLICIT',
}

const burn: LPPositionEvent = {
  eventId: 'SIG:lp-state:LP:4:BURN',
  observedAt: '2026-01-01T00:00:00Z',
  poolAddress: 'POOL',
  lpMint: 'LP',
  kind: 'BURN',
  from: 'DEVELOPER',
  amountRaw: 1000n,
  source: 'solana-token-balance-reconciliation',
  evidenceIds: ['ev:lp'],
  confidence: 1,
}

describe('LP withdrawal attribution', () => {
  it('identifies the owner immediately before a correlated withdrawal', () => {
    const result = attributeLPWithdrawals({
      history: { pool: { poolAddress: 'POOL' } as any, transactions: [], accounts: [], source: 'test', evidenceIds: [] },
      liquidityEvents: [removal],
      lpEvents: [burn],
      developerWalletIds: ['DEVELOPER'],
    })
    expect(result[0]).toMatchObject({ ownerBefore: 'DEVELOPER', developerAssociation: 'MATCHED', lpAmountRaw: 1000n, confidence: 1 })
    expect(verifiedLPWithdrawals(result)).toHaveLength(1)
  })

  it('does not infer developer control without an explicit developer wallet set', () => {
    const result = attributeLPWithdrawals({
      history: { pool: { poolAddress: 'POOL' } as any, transactions: [], accounts: [], source: 'test', evidenceIds: [] },
      liquidityEvents: [removal],
      lpEvents: [burn],
    })
    expect(result[0].developerAssociation).toBe('UNKNOWN')
  })

  it('rejects an uncorrelated removal from verified withdrawals', () => {
    const result = attributeLPWithdrawals({
      history: { pool: { poolAddress: 'POOL' } as any, transactions: [], accounts: [], source: 'test', evidenceIds: [] },
      liquidityEvents: [removal],
      lpEvents: [],
    })
    expect(result[0].ownerBefore).toBeUndefined()
    expect(verifiedLPWithdrawals(result)).toHaveLength(0)
  })
})
