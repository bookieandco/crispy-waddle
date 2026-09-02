import { describe, expect, it } from 'vitest'
import { reconstructPoolLiquidity } from '../pool-liquidity-reconstruction'

const pool = { poolAddress: 'POOL1', dexId: 'raydium', observedAt: '2026-01-01T00:00:00.000Z', source: 'test', evidenceId: 'pool-e1' }
const history = { pool, accounts: [], transactions: [], source: 'test', evidenceIds: ['pool-e1'] }

describe('pool liquidity reconstruction', () => {
  it('builds point-in-time liquidity history from decoded events', () => {
    const result = reconstructPoolLiquidity({ history, decoder: { decode: () => [
      { observedAt: '2026-01-01T00:00:00.000Z', poolAddress: 'POOL1', kind: 'SNAPSHOT', liquidityUsd: 10000, source: 'raydium-decoder', evidenceId: 'l1' },
      { observedAt: '2026-01-01T01:00:00.000Z', poolAddress: 'POOL1', kind: 'LIQUIDITY_REMOVE', liquidityUsd: 4000, source: 'raydium-decoder', evidenceId: 'l2' },
    ] } })
    expect(result.history.initialLiquidityUsd).toBe(10000)
    expect(result.history.currentLiquidityUsd).toBe(4000)
    expect(result.history.drawdownFromPeak).toBeCloseTo(0.6)
    expect(result.history.drainRate).toBeCloseTo(0.6)
    expect(result.evidenceIds).toEqual(expect.arrayContaining(['pool-e1', 'l1', 'l2']))
  })

  it('never accepts invalid or fabricated liquidity', () => {
    expect(() => reconstructPoolLiquidity({ history, decoder: { decode: () => [{ observedAt: '2026-01-01T00:00:00.000Z', poolAddress: 'POOL1', kind: 'LIQUIDITY_REMOVE', liquidityUsd: Number.NaN, source: 'transfer-inference', evidenceId: 'bad' }] } })).toThrow()
  })

  it('ignores events belonging to another pool', () => {
    expect(() => reconstructPoolLiquidity({ history, decoder: { decode: () => [{ observedAt: '2026-01-01T00:00:00.000Z', poolAddress: 'OTHER', kind: 'SNAPSHOT', liquidityUsd: 1000, source: 'decoder', evidenceId: 'other' }] } })).toThrow('No decoded liquidity events')
  })
})
