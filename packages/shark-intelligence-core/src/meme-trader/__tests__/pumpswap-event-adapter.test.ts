import { describe, expect, it } from 'vitest'
import { PumpSwapEventAdapter } from '../pumpswap-event-adapter'
import { classifySemanticLiquidityEvent } from '../liquidity-event-semantics'

const pool = { poolAddress: 'POOL', baseMint: 'BASE', quoteMint: 'QUOTE' } as any

describe('PumpSwapEventAdapter', () => {
  it('maps decoded deposits and withdrawals into canonical liquidity events', () => {
    const history = { pool, transactions: [{ signature: 'SIG', observedAt: '2026-09-02T10:00:00Z', accountAddress: 'POOL', evidenceId: 'ev:tx', raw: { pumpSwapEvents: [{ kind: 'DEPOSIT', pool: 'POOL', amount: '100' }, { kind: 'WITHDRAW', pool: 'POOL', amount: '25' }] } }] } as any
    const events = classifySemanticLiquidityEvent({ transaction: history.transactions[0], pool, decoder: new PumpSwapEventAdapter() })
    expect(events.map(e => e.kind)).toEqual(['LIQUIDITY_ADD', 'LIQUIDITY_REMOVE'])
    expect(events[0].amountRaw).toBe(100n)
    expect(events[1].amountRaw).toBe(25n)
  })

  it('maps trades to SWAP without treating them as liquidity changes', () => {
    const tx = { signature: 'SIG2', observedAt: '2026-09-02T10:00:00Z', accountAddress: 'POOL', evidenceId: 'ev:tx2', raw: { pumpSwapEvents: [{ kind: 'BUY', pool: 'POOL', amount: '7' }, { kind: 'SELL', pool: 'POOL', amount: '3' }] } } as any
    const events = classifySemanticLiquidityEvent({ transaction: tx, pool, decoder: new PumpSwapEventAdapter() })
    expect(events.map(e => e.kind)).toEqual(['SWAP', 'SWAP'])
  })

  it('rejects events for another pool and negative amounts', () => {
    const tx = { signature: 'SIG3', observedAt: '2026-09-02T10:00:00Z', accountAddress: 'POOL', evidenceId: 'ev:tx3', raw: { pumpSwapEvents: [{ kind: 'DEPOSIT', pool: 'OTHER', amount: '100' }, { kind: 'WITHDRAW', pool: 'POOL', amount: '-1' }] } } as any
    expect(classifySemanticLiquidityEvent({ transaction: tx, pool, decoder: new PumpSwapEventAdapter() })).toEqual([])
  })

  it('keeps event identity deterministic so replayed transaction processing can deduplicate', () => {
    const tx = { signature: 'SIG4', observedAt: '2026-09-02T10:00:00Z', accountAddress: 'POOL', evidenceId: 'ev:tx4', raw: { pumpSwapEvents: [{ kind: 'DEPOSIT', pool: 'POOL', amount: '100' }] } } as any
    const adapter = new PumpSwapEventAdapter()
    const a = classifySemanticLiquidityEvent({ transaction: tx, pool, decoder: adapter })
    const b = classifySemanticLiquidityEvent({ transaction: tx, pool, decoder: adapter })
    expect(a[0].eventId).toBe(b[0].eventId)
  })
})
