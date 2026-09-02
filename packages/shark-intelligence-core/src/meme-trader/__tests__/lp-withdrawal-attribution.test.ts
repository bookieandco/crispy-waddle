import { describe, expect, it } from 'vitest'
import { attributeLPWithdrawals, verifiedLPWithdrawals } from '../lp-withdrawal-attribution'
import type { LiquidityEventEvidence } from '../liquidity-event-semantics'
import type { LPPositionEvent } from '../lp-position-ledger'

const removal: LiquidityEventEvidence = {
  eventId: 'raydium:SIG:LIQUIDITY_REMOVE:LP',
  kind: 'LIQUIDITY_REMOVE',
  observedAt: '2026-01-01T00:00:00Z',
  poolAddress: 'POOL',
  signature: 'SIG',
  lpMint: 'LP',
  lpTokenAccount: 'LP_ACCOUNT',
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
  tokenAccount: 'LP_ACCOUNT',
  signature: 'SIG',
  kind: 'BURN',
  from: 'DEVELOPER',
  amountRaw: 1000n,
  source: 'solana-token-balance-reconciliation',
  evidenceIds: ['ev:lp'],
  confidence: 1,
}

const history = { pool: { poolAddress: 'POOL' } as any, transactions: [], accounts: [], source: 'test', evidenceIds: [] }

describe('LP withdrawal attribution', () => {
  it('identifies the owner immediately before a fully correlated withdrawal', () => {
    const result = attributeLPWithdrawals({ history, liquidityEvents: [removal], lpEvents: [burn], developerWalletIds: ['DEVELOPER'] })
    expect(result[0]).toMatchObject({ ownerBefore: 'DEVELOPER', developerAssociation: 'MATCHED', lpAmountRaw: 1000n, lpTokenAccount: 'LP_ACCOUNT', confidence: 1 })
    expect(verifiedLPWithdrawals(result)).toHaveLength(1)
  })

  it('rejects a mismatched LP mint', () => {
    const result = attributeLPWithdrawals({ history, liquidityEvents: [removal], lpEvents: [{ ...burn, lpMint: 'OTHER_LP' }] })
    expect(result[0].ownerBefore).toBeUndefined()
    expect(verifiedLPWithdrawals(result)).toHaveLength(0)
  })

  it('rejects a mismatched LP token account', () => {
    const result = attributeLPWithdrawals({ history, liquidityEvents: [removal], lpEvents: [{ ...burn, tokenAccount: 'OTHER_ACCOUNT' }] })
    expect(result[0].ownerBefore).toBeUndefined()
    expect(verifiedLPWithdrawals(result)).toHaveLength(0)
  })

  it('rejects a mismatched LP amount', () => {
    const result = attributeLPWithdrawals({ history, liquidityEvents: [removal], lpEvents: [{ ...burn, amountRaw: 999n }] })
    expect(result[0].ownerBefore).toBeUndefined()
    expect(verifiedLPWithdrawals(result)).toHaveLength(0)
  })

  it('rejects an LP event with missing known identity fields', () => {
    const result = attributeLPWithdrawals({ history, liquidityEvents: [removal], lpEvents: [{ ...burn, lpMint: undefined, tokenAccount: undefined, amountRaw: undefined }] })
    expect(result[0].ownerBefore).toBeUndefined()
    expect(verifiedLPWithdrawals(result)).toHaveLength(0)
  })

  it('rejects a different transaction signature even when pool and timestamp match', () => {
    const result = attributeLPWithdrawals({ history, liquidityEvents: [removal], lpEvents: [{ ...burn, signature: 'OTHER_SIG' }] })
    expect(result[0].ownerBefore).toBeUndefined()
    expect(verifiedLPWithdrawals(result)).toHaveLength(0)
  })

  it('does not infer developer control without an explicit developer wallet set', () => {
    const result = attributeLPWithdrawals({ history, liquidityEvents: [removal], lpEvents: [burn] })
    expect(result[0].developerAssociation).toBe('UNKNOWN')
  })

  it('rejects an uncorrelated removal from verified withdrawals', () => {
    const result = attributeLPWithdrawals({ history, liquidityEvents: [removal], lpEvents: [] })
    expect(result[0].ownerBefore).toBeUndefined()
    expect(verifiedLPWithdrawals(result)).toHaveLength(0)
  })
})
