import type { HistoricalPoolTransaction, PoolAccountRef, PoolHistory } from './solana-pool-history'
import type { PoolLiquidityDecoder, PoolLiquidityEvent } from './pool-liquidity-reconstruction'

export type DexLiquidityVenue = 'raydium' | 'pumpswap'

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

/** Raydium AMM v4 reserve decoder. Raw RPC parsing must provide an explicit reserveState object. */
export class RaydiumAmmLiquidityDecoder extends BaseDexLiquidityDecoder {
  readonly venue = 'raydium' as const
  readonly programIds = ['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8']

  discoverAccounts(pool: PoolHistory['pool']): PoolAccountRef[] {
    return pool.metadata?.accounts?.filter((a: PoolAccountRef) => a.role === 'token-vault' || a.role === 'lp-vault' || a.role === 'authority') ?? []
  }

  decodeTransaction(transaction: HistoricalPoolTransaction, pool: PoolHistory['pool']): NormalizedReserveState[] {
    const state = BaseDexLiquidityDecoder.rawReserveState(transaction.raw)
    if (!state) return []
    return [{ ...state, observedAt: transaction.observedAt, poolAddress: pool.poolAddress, source: `raydium-amm:${transaction.signature}`, evidenceId: transaction.evidenceId }]
  }
}

/**
 * PumpSwap decoder deliberately starts with an explicit normalized reserve
 * contract. PumpSwap's account/instruction layout must be decoded from its
 * program-specific state before reserve values can be trusted.
 */
export class PumpSwapLiquidityDecoder extends BaseDexLiquidityDecoder {
  readonly venue = 'pumpswap' as const
  readonly programIds: readonly string[] = []

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
