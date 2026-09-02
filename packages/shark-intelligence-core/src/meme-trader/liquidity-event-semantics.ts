import type { HistoricalPoolTransaction, PoolHistory } from './solana-pool-history'

export type LiquidityEventKind =
  | 'SWAP'
  | 'LIQUIDITY_ADD'
  | 'LIQUIDITY_REMOVE'
  | 'LP_MINT'
  | 'LP_BURN'
  | 'LP_TRANSFER'
  | 'POOL_CREATE'
  | 'POOL_MIGRATION'
  | 'UNKNOWN'

export type LiquidityEventEvidence = {
  eventId: string
  kind: LiquidityEventKind
  observedAt: string
  poolAddress: string
  actorId?: string
  lpMint?: string
  amountRaw?: bigint
  source: string
  evidenceIds: string[]
  confidence: number
  semantic: 'EXPLICIT' | 'INFERRED'
}

export interface LiquidityInstructionDecoder {
  decode(transaction: HistoricalPoolTransaction, pool: PoolHistory['pool']): LiquidityEventEvidence[]
}

/**
 * Conservative fallback: vault balance deltas are not enough to call an event
 * a liquidity withdrawal because swaps can move both reserves. A decoder must
 * provide explicit instruction semantics before this layer emits ADD/REMOVE.
 */
export class NoopLiquidityInstructionDecoder implements LiquidityInstructionDecoder {
  decode(_transaction: HistoricalPoolTransaction, _pool: PoolHistory['pool']): LiquidityEventEvidence[] {
    return []
  }
}

export function classifySemanticLiquidityEvent(input: {
  transaction: HistoricalPoolTransaction
  pool: PoolHistory['pool']
  decoder: LiquidityInstructionDecoder
}): LiquidityEventEvidence[] {
  return input.decoder.decode(input.transaction, input.pool).filter(event => {
    if (!event.eventId || !event.observedAt || !event.poolAddress) return false
    if (event.poolAddress !== input.pool.poolAddress) return false
    if (!Number.isFinite(event.confidence) || event.confidence < 0 || event.confidence > 1) return false
    if (!event.evidenceIds.length) return false
    return true
  })
}

export function semanticLiquidityEvents(input: {
  history: PoolHistory
  decoder: LiquidityInstructionDecoder
}): LiquidityEventEvidence[] {
  return input.history.transactions
    .flatMap(transaction => classifySemanticLiquidityEvent({ transaction, pool: input.history.pool, decoder: input.decoder }))
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
}
