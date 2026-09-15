import { describe, expect, it } from 'vitest'
import type { HistoricalPoolTransaction, PoolHistory } from '../solana-pool-history'
import type { LiquidityEventEvidence, LiquidityInstructionDecoder } from '../liquidity-event-semantics'
import { DexObservationLayer } from '../dex-observation-layer'

const PROGRAM = 'Dex111111111111111111111111111111111111111'
const POOL = 'Pool111111111111111111111111111111111111111'

function history(raw: unknown): PoolHistory {
  const transaction: HistoricalPoolTransaction = {
    signature: 'sig-1',
    observedAt: '2026-09-03T10:00:00.000Z',
    accountAddress: POOL,
    raw,
    evidenceId: 'evidence-1',
  }
  return {
    pool: {
      poolAddress: POOL,
      dexId: 'test-dex',
      baseMint: 'Base111111111111111111111111111111111111111',
      quoteMint: 'Quote11111111111111111111111111111111111111',
      observedAt: transaction.observedAt,
      source: 'test',
      evidenceId: 'pool-evidence',
    },
    accounts: [],
    transactions: [transaction],
    source: 'test',
    evidenceIds: ['pool-evidence', 'evidence-1'],
  }
}

const decoder: LiquidityInstructionDecoder = {
  decode(transaction, pool): LiquidityEventEvidence[] {
    return [{
      eventId: 'event-1',
      signature: transaction.signature,
      kind: 'LIQUIDITY_ADD',
      observedAt: transaction.observedAt,
      poolAddress: pool.poolAddress,
      source: 'test-decoder',
      evidenceIds: [transaction.evidenceId],
      confidence: 1,
      semantic: 'EXPLICIT',
    }]
  },
}

describe('DexObservationLayer', () => {
  it('normalizes decoded protocol events into canonical observations', () => {
    const layer = new DexObservationLayer([{ programId: PROGRAM, venue: 'test-dex', decoder }])
    const result = layer.observe(history({
      transaction: {
        message: {
          accountKeys: [PROGRAM],
          instructions: [{ programIdIndex: 0 }],
        },
      },
    }))

    expect(result.rejections).toEqual([])
    expect(result.observations).toHaveLength(1)
    expect(result.observations[0]).toMatchObject({
      signature: 'sig-1',
      poolAddress: POOL,
      programId: PROGRAM,
      venue: 'test-dex',
      evidenceIds: ['evidence-1'],
      event: { kind: 'LIQUIDITY_ADD', semantic: 'EXPLICIT' },
    })
  })

  it('fails closed for transactions without a discoverable program', () => {
    const layer = new DexObservationLayer([{ programId: PROGRAM, venue: 'test-dex', decoder }])
    const result = layer.observe(history({ transaction: { message: { accountKeys: [], instructions: [] } } }))

    expect(result.observations).toEqual([])
    expect(result.rejections).toEqual([{
      signature: 'sig-1',
      poolAddress: POOL,
      reason: 'MISSING_PROGRAM',
    }])
  })

  it('fails closed for unsupported DEX programs', () => {
    const layer = new DexObservationLayer([{ programId: PROGRAM, venue: 'test-dex', decoder }])
    const result = layer.observe(history({
      transaction: {
        message: {
          accountKeys: ['Unknown1111111111111111111111111111111111111'],
          instructions: [{ programIdIndex: 0 }],
        },
      },
    }))

    expect(result.observations).toEqual([])
    expect(result.rejections[0]).toMatchObject({ reason: 'UNSUPPORTED_PROGRAM' })
  })

  it('rejects decoder output for another transaction or pool', () => {
    const badDecoder: LiquidityInstructionDecoder = {
      decode: () => [{
        eventId: 'bad',
        signature: 'other-signature',
        kind: 'LIQUIDITY_ADD',
        observedAt: '2026-09-03T10:00:00.000Z',
        poolAddress: POOL,
        source: 'bad-decoder',
        evidenceIds: ['evidence-1'],
        confidence: 1,
        semantic: 'EXPLICIT',
      }],
    }
    const layer = new DexObservationLayer([{ programId: PROGRAM, venue: 'test-dex', decoder: badDecoder }])
    const result = layer.observe(history({ transaction: { message: { accountKeys: [PROGRAM], instructions: [{ programIdIndex: 0 }] } } }))

    expect(result.observations).toEqual([])
  })
})
