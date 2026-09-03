import type { HistoricalPoolTransaction, PoolHistory } from './solana-pool-history'
import type { LiquidityEventEvidence, LiquidityInstructionDecoder } from './liquidity-event-semantics'
import { PUMPSWAP_AMM_PROGRAM_ID } from './dex-liquidity-decoder'

type PumpSwapEventKind = 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAW' | 'CREATE_POOL'

type PumpSwapEvent = {
  kind: PumpSwapEventKind
  pool?: string
  timestamp?: number | string
  amount?: string | number
  lpTokenAmount?: string | number
  evidenceId?: string
}

/**
 * Converts SDK/IDL-decoded PumpSwap events into the existing canonical
 * liquidity-event vocabulary. It intentionally consumes decoded events only;
 * it does not guess instruction semantics from arbitrary transaction bytes.
 */
export class PumpSwapEventAdapter implements LiquidityInstructionDecoder {
  decode(transaction: HistoricalPoolTransaction, pool: PoolHistory['pool']): LiquidityEventEvidence[] {
    const raw = transaction.raw
    if (!raw || typeof raw !== 'object') return []
    const events = (raw as Record<string, unknown>).pumpSwapEvents
    if (!Array.isArray(events)) return []

    return events.flatMap((candidate, index) => this.decodeEvent(candidate, index, transaction, pool))
  }

  private decodeEvent(candidate: unknown, index: number, transaction: HistoricalPoolTransaction, pool: PoolHistory['pool']): LiquidityEventEvidence[] {
    if (!candidate || typeof candidate !== 'object') return []
    const event = candidate as Record<string, unknown>
    const kind = event.kind
    if (kind !== 'BUY' && kind !== 'SELL' && kind !== 'DEPOSIT' && kind !== 'WITHDRAW' && kind !== 'CREATE_POOL') return []
    if (event.pool !== undefined && event.pool !== pool.poolAddress) return []

    const timestamp = event.timestamp === undefined ? transaction.observedAt : new Date(Number(event.timestamp)).toISOString()
    if (!Number.isFinite(Date.parse(timestamp))) return []
    const amount = event.amount ?? event.lpTokenAmount
    const amountRaw = typeof amount === 'string' && /^-?\d+$/.test(amount) ? BigInt(amount) : typeof amount === 'number' && Number.isSafeInteger(amount) ? BigInt(amount) : undefined
    if (amountRaw !== undefined && amountRaw < 0n) return []

    const semanticKind: LiquidityEventEvidence['kind'] =
      kind === 'DEPOSIT' ? 'LIQUIDITY_ADD' :
      kind === 'WITHDRAW' ? 'LIQUIDITY_REMOVE' :
      kind === 'CREATE_POOL' ? 'POOL_CREATE' : 'SWAP'

    const evidenceId = typeof event.evidenceId === 'string' && event.evidenceId ? event.evidenceId : transaction.evidenceId
    return [{
      eventId: `pumpswap:${transaction.signature}:${semanticKind}:${index}`,
      signature: transaction.signature,
      kind: semanticKind,
      observedAt: timestamp,
      poolAddress: pool.poolAddress,
      amountRaw,
      source: PUMPSWAP_AMM_PROGRAM_ID,
      evidenceIds: [transaction.evidenceId, evidenceId].filter(Boolean),
      confidence: 1,
      semantic: 'EXPLICIT',
    }]
  }
}
