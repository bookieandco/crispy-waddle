import { describe, expect, it } from 'vitest'
import {
  deriveRaydiumEffectiveReserve,
  parseRaydiumOpenOrdersState,
  parseRaydiumV4PnlState,
  RAYDIUM_OPEN_ORDERS_BASE_TOTAL_OFFSET,
  RAYDIUM_OPEN_ORDERS_QUOTE_TOTAL_OFFSET,
  RAYDIUM_V4_BASE_NEED_TAKE_PNL_OFFSET,
  RAYDIUM_V4_QUOTE_NEED_TAKE_PNL_OFFSET,
} from '../raydium-effective-reserve'

function putU64(data: Uint8Array, offset: number, value: bigint): void {
  for (let i = 0; i < 8; i++) data[offset + i] = Number((value >> BigInt(i * 8)) & 255n)
}

describe('Raydium effective reserve reconstruction', () => {
  it('decodes historical OpenOrders totals at verified offsets', () => {
    const data = new Uint8Array(109)
    putU64(data, RAYDIUM_OPEN_ORDERS_BASE_TOTAL_OFFSET, 1234n)
    putU64(data, RAYDIUM_OPEN_ORDERS_QUOTE_TOTAL_OFFSET, 5678n)
    const state = parseRaydiumOpenOrdersState({ data, evidenceId: 'oo:1' })
    expect(state.baseTotalRaw).toBe(1234n)
    expect(state.quoteTotalRaw).toBe(5678n)
  })

  it('decodes V4 needTakePnl fields at verified offsets', () => {
    const data = new Uint8Array(208)
    putU64(data, RAYDIUM_V4_BASE_NEED_TAKE_PNL_OFFSET, 11n)
    putU64(data, RAYDIUM_V4_QUOTE_NEED_TAKE_PNL_OFFSET, 22n)
    const state = parseRaydiumV4PnlState({ data, evidenceId: 'pool:1' })
    expect(state.baseNeedTakePnlRaw).toBe(11n)
    expect(state.quoteNeedTakePnlRaw).toBe(22n)
  })

  it('derives effective reserves from vault + OpenOrders - PnL', () => {
    const reserve = deriveRaydiumEffectiveReserve({
      vaultBaseRaw: 1000n,
      vaultQuoteRaw: 5000n,
      openOrders: { baseTotalRaw: 200n, quoteTotalRaw: 300n, source: 'oo', evidenceId: 'oo:1' },
      pnl: { baseNeedTakePnlRaw: 50n, quoteNeedTakePnlRaw: 100n, source: 'pool', evidenceId: 'pool:1' },
      evidenceIds: ['vault:1'],
    })
    expect(reserve.baseReserveRaw).toBe(1150n)
    expect(reserve.quoteReserveRaw).toBe(5200n)
    expect(reserve.evidenceIds).toEqual(['vault:1', 'oo:1', 'pool:1'])
  })

  it('rejects negative effective reserves', () => {
    expect(() => deriveRaydiumEffectiveReserve({
      vaultBaseRaw: 1n,
      vaultQuoteRaw: 1n,
      pnl: { baseNeedTakePnlRaw: 2n, quoteNeedTakePnlRaw: 0n, source: 'pool', evidenceId: 'pool:1' },
      evidenceIds: [],
    })).toThrow('cannot be negative')
  })

  it('rejects truncated account data', () => {
    expect(() => parseRaydiumOpenOrdersState({ data: new Uint8Array(108), evidenceId: 'x' })).toThrow('OpenOrders account length')
    expect(() => parseRaydiumV4PnlState({ data: new Uint8Array(207), evidenceId: 'x' })).toThrow('pool-state length')
  })
})
