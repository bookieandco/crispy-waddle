import type { HistoricalPoolTransaction, PoolAccountRef, PoolHistory } from './solana-pool-history'
import type { PoolLiquidityDecoder, PoolLiquidityEvent } from './pool-liquidity-reconstruction'

export type DexLiquidityVenue = 'raydium' | 'pumpswap'

export const RAYDIUM_AMM_V4_PROGRAM_ID = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'
export const PUMPSWAP_AMM_PROGRAM_ID = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA'

type ParsedPoolState = {
  baseMint: string
  quoteMint: string
  baseVault: string
  quoteVault: string
  programId: string
  evidenceId?: string
}

export type NormalizedReserveState = {
  observedAt: string
  poolAddress: string
  baseReserve: number
  quoteReserve: number
  liquidityUsd: number
  source: string
  evidenceId: string
  kind: 'SNAPSHOT' | 'LIQUIDITY_ADD' | 'LIQUIDITY_REMOVE'
}

export interface DexLiquidityDecoder extends PoolLiquidityDecoder {
  readonly venue: DexLiquidityVenue
  readonly programIds: readonly string[]
  discoverAccounts(pool: PoolHistory['pool']): PoolAccountRef[]
  decodeTransaction(transaction: HistoricalPoolTransaction, pool: PoolHistory['pool']): NormalizedReserveState[]
}

function readPublicKey(data: Uint8Array, offset: number): string {
  if (data.length < offset + 32) throw new Error(`pool account data is too short at offset ${offset}`)
  return toBase58(data.slice(offset, offset + 32))
}

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
function toBase58(bytes: Uint8Array): string {
  if (!bytes.length) return ''
  const digits = [0]
  for (const byte of bytes) {
    let carry = byte
    for (let i = 0; i < digits.length; i++) {
      const value = digits[i] * 256 + carry
      digits[i] = value % 58
      carry = Math.floor(value / 58)
    }
    while (carry) {
      digits.push(carry % 58)
      carry = Math.floor(carry / 58)
    }
  }
  let result = ''
  for (const byte of bytes) if (byte === 0) result += '1'; else break
  for (let i = digits.length - 1; i >= 0; i--) result += ALPHABET[digits[i]]
  return result
}

function decodeAccountData(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data
  if (Array.isArray(data) && data.every(value => Number.isInteger(value) && value >= 0 && value <= 255)) return Uint8Array.from(data)
  if (typeof data === 'string') {
    const normalized = data.trim()
    if (!normalized) throw new Error('pool account data is empty')
    try {
      if (typeof atob === 'function') {
        const binary = atob(normalized)
        return Uint8Array.from(binary, char => char.charCodeAt(0))
      }
    } catch {
      throw new Error('invalid base64 pool account data')
    }
  }
  throw new Error('unsupported pool account data encoding')
}

function assertProgramOwner(actualOwner: string | undefined, expected: string): void {
  if (actualOwner !== undefined && actualOwner !== expected) throw new Error(`pool account owner mismatch for ${expected}`)
}

/** PumpSwap pool state layout verified against the TokensHive protocol decoder. */
export function parsePumpSwapPoolState(input: { data: unknown; owner?: string }): ParsedPoolState {
  assertProgramOwner(input.owner, PUMPSWAP_AMM_PROGRAM_ID)
  const data = decodeAccountData(input.data)
  if (data.length < 243) throw new Error(`invalid pumpswap pool data length: ${data.length}`)
  return {
    baseMint: readPublicKey(data, 43),
    quoteMint: readPublicKey(data, 75),
    baseVault: readPublicKey(data, 139),
    quoteVault: readPublicKey(data, 171),
    programId: PUMPSWAP_AMM_PROGRAM_ID,
  }
}

/** Raydium AMM V4 pool state layout verified against the TokensHive protocol decoder. */
export function parseRaydiumAmmV4PoolState(input: { data: unknown; owner?: string }): ParsedPoolState {
  assertProgramOwner(input.owner, RAYDIUM_AMM_V4_PROGRAM_ID)
  const data = decodeAccountData(input.data)
  if (data.length < 752) throw new Error(`invalid raydium liquidity-v4 pool data length: ${data.length}`)
  return {
    baseMint: readPublicKey(data, 400),
    quoteMint: readPublicKey(data, 432),
    baseVault: readPublicKey(data, 336),
    quoteVault: readPublicKey(data, 368),
    programId: RAYDIUM_AMM_V4_PROGRAM_ID,
  }
}

/**
 * Common safety boundary for DEX decoders. A decoder may only emit a USD
 * liquidity value when the transaction/parser has explicitly established the
 * reserve state and its USD valuation. Token transfer amounts alone are not
 * accepted as liquidity.
 */
export abstract class BaseDexLiquidityDecoder implements DexLiquidityDecoder {
  abstract readonly venue: DexLiquidityVenue
  abstract readonly programIds: readonly string[]
  abstract discoverAccounts(pool: PoolHistory['pool']): PoolAccountRef[]
  abstract decodeTransaction(transaction: HistoricalPoolTransaction, pool: PoolHistory['pool']): NormalizedReserveState[]

  decode(history: PoolHistory): PoolLiquidityEvent[] {
    return history.transactions.flatMap(tx => this.decodeTransaction(tx, history.pool)).map(state => ({
      observedAt: state.observedAt,
      poolAddress: state.poolAddress,
      kind: state.kind,
      liquidityUsd: state.liquidityUsd,
      source: state.source,
      evidenceId: state.evidenceId,
    }))
  }

  protected static rawReserveState(raw: unknown): { baseReserve: number; quoteReserve: number; liquidityUsd: number; kind: NormalizedReserveState['kind'] } | undefined {
    if (!raw || typeof raw !== 'object') return undefined
    const candidate = raw as Record<string, unknown>
    const reserve = candidate.reserveState
    if (!reserve || typeof reserve !== 'object') return undefined
    const r = reserve as Record<string, unknown>
    const baseReserve = Number(r.baseReserve)
    const quoteReserve = Number(r.quoteReserve)
    const liquidityUsd = Number(r.liquidityUsd)
    const kind = r.kind
    if (![baseReserve, quoteReserve, liquidityUsd].every(Number.isFinite) || liquidityUsd < 0) return undefined
    if (kind !== 'SNAPSHOT' && kind !== 'LIQUIDITY_ADD' && kind !== 'LIQUIDITY_REMOVE') return undefined
    return { baseReserve, quoteReserve, liquidityUsd, kind }
  }
}

export class RaydiumAmmLiquidityDecoder extends BaseDexLiquidityDecoder {
  readonly venue = 'raydium' as const
  readonly programIds = [RAYDIUM_AMM_V4_PROGRAM_ID]

  discoverAccounts(pool: PoolHistory['pool']): PoolAccountRef[] {
    return pool.metadata?.accounts?.filter((a: PoolAccountRef) => a.role === 'token-vault' || a.role === 'lp-vault' || a.role === 'authority') ?? []
  }

  decodeTransaction(transaction: HistoricalPoolTransaction, pool: PoolHistory['pool']): NormalizedReserveState[] {
    const state = BaseDexLiquidityDecoder.rawReserveState(transaction.raw)
    if (!state) return []
    return [{ ...state, observedAt: transaction.observedAt, poolAddress: pool.poolAddress, source: `raydium-amm:${transaction.signature}`, evidenceId: transaction.evidenceId }]
  }
}

export class PumpSwapLiquidityDecoder extends BaseDexLiquidityDecoder {
  readonly venue = 'pumpswap' as const
  readonly programIds = [PUMPSWAP_AMM_PROGRAM_ID]

  discoverAccounts(pool: PoolHistory['pool']): PoolAccountRef[] {
    return pool.metadata?.accounts?.filter((a: PoolAccountRef) => a.role === 'token-vault' || a.role === 'lp-vault' || a.role === 'authority') ?? []
  }

  decodeTransaction(transaction: HistoricalPoolTransaction, pool: PoolHistory['pool']): NormalizedReserveState[] {
    const state = BaseDexLiquidityDecoder.rawReserveState(transaction.raw)
    if (!state) return []
    return [{ ...state, observedAt: transaction.observedAt, poolAddress: pool.poolAddress, source: `pumpswap:${transaction.signature}`, evidenceId: transaction.evidenceId }]
  }
}

export class DexLiquidityDecoderRegistry {
  constructor(private readonly decoders: DexLiquidityDecoder[]) {}
  forVenue(venue: DexLiquidityVenue): DexLiquidityDecoder | undefined { return this.decoders.find(d => d.venue === venue) }
  forProgram(programId: string): DexLiquidityDecoder | undefined { return this.decoders.find(d => d.programIds.includes(programId)) }
  list(): readonly DexLiquidityDecoder[] { return this.decoders }
}
