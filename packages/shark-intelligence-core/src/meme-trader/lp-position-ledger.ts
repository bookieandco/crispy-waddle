import type { HistoricalPoolTransaction, PoolHistory } from './solana-pool-history'
import type { LiquidityEventEvidence } from './liquidity-event-semantics'

export type LPPositionEventKind = 'MINT' | 'TRANSFER' | 'BURN' | 'UNKNOWN'

export type LPPositionEvent = {
  eventId: string
  observedAt: string
  poolAddress: string
  lpMint: string
  kind: LPPositionEventKind
  from?: string
  to?: string
  amountRaw?: bigint
  source: string
  evidenceIds: string[]
  confidence: number
}

export type LPPositionState = {
  lpMint: string
  owner?: string
  balanceRaw: bigint
  observedAt: string
  evidenceIds: string[]
}

export interface LPPositionEventDecoder {
  decode(transaction: HistoricalPoolTransaction, pool: PoolHistory['pool']): LPPositionEvent[]
}

export class NoopLPPositionEventDecoder implements LPPositionEventDecoder {
  decode(_transaction: HistoricalPoolTransaction, _pool: PoolHistory['pool']): LPPositionEvent[] { return [] }
}

export function buildLPPositionLedger(input: {
  history: PoolHistory
  decoder: LPPositionEventDecoder
}): LPPositionEvent[] {
  return input.history.transactions
    .flatMap(transaction => input.decoder.decode(transaction, input.history.pool))
    .filter(event => event.poolAddress === input.history.pool.poolAddress && event.evidenceIds.length > 0 && Number.isFinite(event.confidence) && event.confidence >= 0 && event.confidence <= 1)
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
}

/**
 * Correlates semantic liquidity removal with LP burns/transfers without
 * treating a reserve drop by itself as proof of LP withdrawal.
 */
export function correlateLiquidityRemoval(input: {
  liquidityEvents: LiquidityEventEvidence[]
  lpEvents: LPPositionEvent[]
}): Array<LiquidityEventEvidence & { correlatedLpEventIds: string[] }> {
  return input.liquidityEvents
    .filter(event => event.kind === 'LIQUIDITY_REMOVE')
    .map(event => ({
      ...event,
      correlatedLpEventIds: input.lpEvents
        .filter(lp => lp.poolAddress === event.poolAddress && Math.abs(Date.parse(lp.observedAt) - Date.parse(event.observedAt)) <= 120_000 && (lp.kind === 'BURN' || lp.kind === 'TRANSFER'))
        .map(lp => lp.eventId),
    }))
}
