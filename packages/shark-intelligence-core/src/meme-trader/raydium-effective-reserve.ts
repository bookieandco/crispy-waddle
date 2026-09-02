export const RAYDIUM_OPEN_ORDERS_BASE_TOTAL_OFFSET = 85
export const RAYDIUM_OPEN_ORDERS_QUOTE_TOTAL_OFFSET = 101
export const RAYDIUM_OPEN_ORDERS_MIN_SIZE = 109
export const RAYDIUM_V4_BASE_NEED_TAKE_PNL_OFFSET = 192
export const RAYDIUM_V4_QUOTE_NEED_TAKE_PNL_OFFSET = 200

export type RaydiumOpenOrdersState = {
  baseTotalRaw: bigint
  quoteTotalRaw: bigint
  source: string
  evidenceId: string
}

export type RaydiumPnlState = {
  baseNeedTakePnlRaw: bigint
  quoteNeedTakePnlRaw: bigint
  source: string
  evidenceId: string
}

export type RaydiumEffectiveReserve = {
  baseReserveRaw: bigint
  quoteReserveRaw: bigint
  vaultBaseRaw: bigint
  vaultQuoteRaw: bigint
  openOrdersBaseRaw: bigint
  openOrdersQuoteRaw: bigint
  baseNeedTakePnlRaw: bigint
  quoteNeedTakePnlRaw: bigint
  evidenceIds: string[]
}

function bytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data
  if (Array.isArray(data) && data.every(v => Number.isInteger(v) && v >= 0 && v <= 255)) return Uint8Array.from(data)
  if (typeof data === 'string') {
    const binary = atob(data.trim())
    return Uint8Array.from(binary, c => c.charCodeAt(0))
  }
  throw new Error('unsupported Raydium account-data encoding')
}

function readU64LE(data: Uint8Array, offset: number): bigint {
  if (data.length < offset + 8) throw new Error(`Raydium account data is too short at offset ${offset}`)
  let value = 0n
  for (let i = 0; i < 8; i++) value |= BigInt(data[offset + i]) << BigInt(i * 8)
  return value
}

/** Decodes Serum/OpenBook OpenOrders totals used by Raydium AMM V4. */
export function parseRaydiumOpenOrdersState(input: { data: unknown; evidenceId: string; source?: string }): RaydiumOpenOrdersState {
  const data = bytes(input.data)
  if (data.length < RAYDIUM_OPEN_ORDERS_MIN_SIZE) throw new Error(`invalid OpenOrders account length: ${data.length}`)
  if (!input.evidenceId) throw new Error('OpenOrders state requires evidence')
  return {
    baseTotalRaw: readU64LE(data, RAYDIUM_OPEN_ORDERS_BASE_TOTAL_OFFSET),
    quoteTotalRaw: readU64LE(data, RAYDIUM_OPEN_ORDERS_QUOTE_TOTAL_OFFSET),
    source: input.source ?? 'raydium-open-orders',
    evidenceId: input.evidenceId,
  }
}

/** Decodes Raydium AMM V4 needTakePnl fields from pool state. */
export function parseRaydiumV4PnlState(input: { data: unknown; evidenceId: string; source?: string }): RaydiumPnlState {
  const data = bytes(input.data)
  if (data.length < RAYDIUM_V4_QUOTE_NEED_TAKE_PNL_OFFSET + 8) throw new Error(`invalid Raydium V4 pool-state length: ${data.length}`)
  if (!input.evidenceId) throw new Error('Raydium PnL state requires evidence')
  return {
    baseNeedTakePnlRaw: readU64LE(data, RAYDIUM_V4_BASE_NEED_TAKE_PNL_OFFSET),
    quoteNeedTakePnlRaw: readU64LE(data, RAYDIUM_V4_QUOTE_NEED_TAKE_PNL_OFFSET),
    source: input.source ?? 'raydium-v4-pool-state',
    evidenceId: input.evidenceId,
  }
}

/**
 * Raydium AMM effective reserves: vault balances + OpenOrders totals -
 * needTakePnl. Everything remains in raw token units until an independent
 * point-in-time price source is available.
 */
export function deriveRaydiumEffectiveReserve(input: {
  vaultBaseRaw: bigint
  vaultQuoteRaw: bigint
  openOrders?: RaydiumOpenOrdersState
  pnl?: RaydiumPnlState
  evidenceIds: string[]
}): RaydiumEffectiveReserve {
  const ooBase = input.openOrders?.baseTotalRaw ?? 0n
  const ooQuote = input.openOrders?.quoteTotalRaw ?? 0n
  const pnlBase = input.pnl?.baseNeedTakePnlRaw ?? 0n
  const pnlQuote = input.pnl?.quoteNeedTakePnlRaw ?? 0n
  const baseReserveRaw = input.vaultBaseRaw + ooBase - pnlBase
  const quoteReserveRaw = input.vaultQuoteRaw + ooQuote - pnlQuote
  if (baseReserveRaw < 0n || quoteReserveRaw < 0n) throw new Error('Raydium effective reserve cannot be negative')
  return {
    baseReserveRaw,
    quoteReserveRaw,
    vaultBaseRaw: input.vaultBaseRaw,
    vaultQuoteRaw: input.vaultQuoteRaw,
    openOrdersBaseRaw: ooBase,
    openOrdersQuoteRaw: ooQuote,
    baseNeedTakePnlRaw: pnlBase,
    quoteNeedTakePnlRaw: pnlQuote,
    evidenceIds: [...new Set([...input.evidenceIds, ...(input.openOrders ? [input.openOrders.evidenceId] : []), ...(input.pnl ? [input.pnl.evidenceId] : [])])],
  }
}
