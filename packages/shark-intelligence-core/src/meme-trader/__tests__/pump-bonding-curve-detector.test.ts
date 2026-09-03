import { describe, expect, it } from 'vitest'
import {
  detectPumpGraduationSniper,
  observePumpBondingCurve,
  type PumpBondingCurveState,
} from '../pump-bonding-curve-detector'

const initial = 793_100n

const state = (realTokenReserves: bigint, complete = false): PumpBondingCurveState => ({
  mint: 'mint-1',
  bondingCurve: 'curve-1',
  virtualTokenReserves: 1_000_000n,
  virtualQuoteReserves: 30_000n,
  realTokenReserves,
  realQuoteReserves: 80_000_000_000n,
  tokenTotalSupply: 1_000_000n,
  complete,
  observedAt: '2026-09-03T12:00:00.000Z',
  slot: 123,
  signature: 'sig-1',
  evidenceIds: ['solana-signature:sig-1'],
})

describe('Pump bonding curve graduation detector', () => {
  it('uses on-chain real-token depletion rather than a hard-coded SOL threshold', () => {
    const observation = observePumpBondingCurve(state(7_931n), initial)
    expect(observation.phase).toBe('NEAR_GRADUATION')
    expect(observation.completion).toBeCloseTo(0.99)
    expect(observation.remainingRealTokenRatio).toBeCloseTo(0.01)
  })

  it('detects the transition into the near-graduation window', () => {
    const previous = observePumpBondingCurve(state(20_000n), initial)
    const current = observePumpBondingCurve(state(7_000n), initial)
    const signal = detectPumpGraduationSniper(current, previous)
    expect(signal?.trigger).toBe('CROSSED_NEAR_GRADUATION')
    expect(signal?.executionAllowed).toBe(false)
  })

  it('does not repeatedly signal while remaining in the same phase', () => {
    const previous = observePumpBondingCurve(state(7_000n), initial)
    const current = observePumpBondingCurve({ ...state(6_000n), signature: 'sig-2' }, initial)
    expect(detectPumpGraduationSniper(current, previous)).toBeNull()
  })

  it('emits a distinct completion observation without authorizing execution', () => {
    const current = observePumpBondingCurve(state(0n, true), initial)
    const signal = detectPumpGraduationSniper(current)
    expect(current.phase).toBe('COMPLETED')
    expect(signal?.trigger).toBe('COMPLETED')
    expect(signal?.executionAllowed).toBe(false)
  })

  it('fails closed when initial reserve or evidence is invalid', () => {
    const missingReserve = observePumpBondingCurve(state(0n), 0n)
    expect(missingReserve.phase).toBe('INVALID')
    const missingEvidence = observePumpBondingCurve({ ...state(1n), evidenceIds: [] }, initial)
    expect(missingEvidence.phase).toBe('INVALID')
  })
})
