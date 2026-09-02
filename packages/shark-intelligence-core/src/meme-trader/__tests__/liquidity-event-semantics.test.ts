import { describe, expect, it } from 'vitest'
import { classifySemanticLiquidityEvent, NoopLiquidityInstructionDecoder } from '../liquidity-event-semantics'
import { buildLPPositionLedger, correlateLiquidityRemoval, NoopLPPositionEventDecoder } from '../lp-position-ledger'

const pool = { poolAddress: 'POOL', baseMint: 'BASE', quoteMint: 'QUOTE' } as any
const tx = { signature: 'SIG', observedAt: '2026-09-02T10:00:00Z', accountAddress: 'POOL', raw: {}, evidenceId: 'ev:tx' } as any

describe('liquidity event semantics', () => {
  it('does not infer liquidity removal from a reserve drop alone', () => {
    expect(classifySemanticLiquidityEvent({ transaction: tx, pool, decoder: new NoopLiquidityInstructionDecoder() })).toEqual([])
  })

  it('rejects events without evidence or valid confidence', () => {
    const decoder = { decode: () => [{ eventId: 'x', kind: 'LIQUIDITY_REMOVE', observedAt: tx.observedAt, poolAddress: 'POOL', source: 'test', evidenceIds: [], confidence: 0.9, semantic: 'EXPLICIT' as const }] }
    expect(classifySemanticLiquidityEvent({ transaction: tx, pool, decoder })).toEqual([])
  })

  it('keeps LP ledger and removal correlation separate from reserve reconstruction', () => {
    const liquidity = [{ eventId: 'remove-1', kind: 'LIQUIDITY_REMOVE' as const, observedAt: tx.observedAt, poolAddress: 'POOL', source: 'raydium', evidenceIds: ['ev:remove'], confidence: 1, semantic: 'EXPLICIT' as const }]
    const lp = [{ eventId: 'burn-1', observedAt: '2026-09-02T10:00:30Z', poolAddress: 'POOL', lpMint: 'LP', kind: 'BURN' as const, amountRaw: 10n, source: 'spl-token', evidenceIds: ['ev:burn'], confidence: 1 }]
    expect(buildLPPositionLedger({ history: { pool, transactions: [tx] }, decoder: { decode: () => lp } })).toHaveLength(1)
    expect(correlateLiquidityRemoval({ liquidityEvents: liquidity, lpEvents: lp })[0].correlatedLpEventIds).toEqual(['burn-1'])
  })

  it('has an empty default LP decoder', () => {
    expect(buildLPPositionLedger({ history: { pool, transactions: [tx] }, decoder: new NoopLPPositionEventDecoder() })).toEqual([])
  })
})
