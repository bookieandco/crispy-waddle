import { describe, expect, it } from 'vitest'
import { executeSharkPaperOrder } from './paper-execution.js'

describe('Shark paper execution', () => {
  const order = { id: 'paper-1', decisionId: 'decision-1', opportunityId: 'opp-1', side: 'buy' as const, orderType: 'market' as const, quantity: 2, submittedAt: '2026-01-01T00:00:00.000Z' }

  it('returns an explicitly simulated result and updates only paper balance state', () => {
    const result = executeSharkPaperOrder({ order, fillPrice: 10, fee: 1, slippage: 0.1, balance: { currency: 'USD', available: 100, reserved: 0 } })
    expect(result.simulated).toBe(true)
    expect(result.status).toBe('filled')
    expect(result.fills[0]).toMatchObject({ orderId: 'paper-1', quantity: 2, price: 10, fee: 1, slippage: 0.1 })
    expect(result.balance.available).toBe(79)
    expect(result.position.quantity).toBe(2)
  })

  it('rejects invalid paper orders before state transition', () => {
    expect(() => executeSharkPaperOrder({ order: { ...order, quantity: 0 }, fillPrice: 10, fee: 0, slippage: 0 })).toThrow('invalid Shark paper order')
  })
})
