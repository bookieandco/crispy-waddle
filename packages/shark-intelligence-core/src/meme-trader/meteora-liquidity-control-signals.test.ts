import { describe, expect, it } from 'vitest'
import { deriveMeteoraLiquidityControlSignals, type DlmmWithdrawalObservation } from './meteora-liquidity-control-signals'

const withdrawal = (id: string, at: string, overrides: Partial<DlmmWithdrawalObservation> = {}): DlmmWithdrawalObservation => ({
  eventId: id,
  signature: `sig-${id}`,
  poolAddress: 'POOL',
  tokenMint: 'TOKEN',
  observedAt: at,
  positionAddress: `POSITION-${id}`,
  ownerId: `W${id}`,
  removedBps: 1000,
  oneSided: false,
  positionClosed: false,
  rebalanceBeforeWithdrawal: false,
  evidenceIds: [`e-${id}`],
  confidence: 0.9,
  ...overrides,
})

describe('Meteora liquidity-control signals', () => {
  it('detects concentrated ownership', () => {
    const signals = deriveMeteoraLiquidityControlSignals({
      poolAddress: 'POOL', tokenMint: 'TOKEN',
      positionCount: 10, ownerPositionCount: 7,
      withdrawals: [withdrawal('1', '2026-09-03T10:00:00.000Z')],
    })
    expect(signals.some(s => s.kind === 'OWNER_CONCENTRATION')).toBe(true)
  })

  it('detects large, one-sided, rebalanced, closed withdrawals', () => {
    const signals = deriveMeteoraLiquidityControlSignals({
      poolAddress: 'POOL', tokenMint: 'TOKEN',
      withdrawals: [withdrawal('1', '2026-09-03T10:00:00.000Z', {
        removedBps: 10000, oneSided: true, rebalanceBeforeWithdrawal: true, positionClosed: true,
      })],
    })
    expect(signals.map(s => s.kind)).toEqual(expect.arrayContaining([
      'RAPID_WITHDRAWAL', 'ONE_SIDED_WITHDRAWAL', 'REBALANCE_BEFORE_WITHDRAWAL', 'POSITION_CLOSURE',
    ]))
  })

  it('detects coordinated withdrawals and destination convergence', () => {
    const signals = deriveMeteoraLiquidityControlSignals({
      poolAddress: 'POOL', tokenMint: 'TOKEN',
      withdrawals: [
        withdrawal('1', '2026-09-03T10:00:00.000Z', { ownerId: 'A', destinationIds: ['D'] }),
        withdrawal('2', '2026-09-03T10:02:00.000Z', { ownerId: 'B', destinationIds: ['D'] }),
        withdrawal('3', '2026-09-03T10:03:00.000Z', { ownerId: 'C', destinationIds: ['D'] }),
      ],
    })
    expect(signals.some(s => s.kind === 'COORDINATED_WITHDRAWAL')).toBe(true)
    expect(signals.some(s => s.kind === 'DESTINATION_CONVERGENCE')).toBe(true)
  })

  it('does not manufacture signals from invalid withdrawal state', () => {
    const signals = deriveMeteoraLiquidityControlSignals({
      poolAddress: 'POOL', tokenMint: 'TOKEN',
      withdrawals: [withdrawal('1', 'bad-date', { removedBps: 20000 })],
    })
    expect(signals).toHaveLength(0)
  })
})
