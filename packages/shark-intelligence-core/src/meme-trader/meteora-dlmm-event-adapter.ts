import type { HistoricalPoolTransaction } from './solana-pool-history'
import type { LiquidityEventEvidence, LiquidityInstructionDecoder } from './liquidity-event-semantics'

/** Meteora DLMM lb_clmm mainnet/devnet program. Verified against Meteora's public developer docs. */
export const METEORA_DLMM_PROGRAM_ID = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'

export type MeteoraDlmmEventKind =
  | 'POOL_CREATE'
  | 'LIQUIDITY_ADD'
  | 'LIQUIDITY_REMOVE'
  | 'SWAP'
  | 'LP_MINT'
  | 'LP_BURN'
  | 'LP_TRANSFER'

/**
 * Normalized input emitted by a protocol-aware Meteora parser.
 * Keep parsing separate from semantic classification: raw bytes are not
 * interpreted here without an authoritative/current IDL-backed parser.
 */
export type MeteoraDlmmDecodedEvent = {
  eventId: string
  signature: string
  observedAt: string
  poolAddress: string
  kind: MeteoraDlmmEventKind
  actorId?: string
  lpMint?: string
  lpTokenAccount?: string
  amountRaw?: bigint
  evidenceIds: string[]
  source: string
  confidence: number
  semantic: 'EXPLICIT' | 'INFERRED'
}

export function normalizeMeteoraDlmmEvent(
  event: MeteoraDlmmDecodedEvent,
  transaction: HistoricalPoolTransaction,
  expectedPool: string,
): LiquidityEventEvidence | undefined {
  if (!event.eventId || event.signature !== transaction.signature) return undefined
  if (event.poolAddress !== expectedPool) return undefined
  if (!event.observedAt || !event.evidenceIds.length) return undefined
  if (!Number.isFinite(event.confidence) || event.confidence < 0 || event.confidence > 1) return undefined
  if (event.amountRaw !== undefined && event.amountRaw < 0n) return undefined

  return {
    eventId: `meteora-dlmm:${event.eventId}`,
    signature: event.signature,
    kind: event.kind,
    observedAt: event.observedAt,
    poolAddress: event.poolAddress,
    actorId: event.actorId,
    lpMint: event.lpMint,
    lpTokenAccount: event.lpTokenAccount,
    amountRaw: event.amountRaw,
    source: event.source,
    evidenceIds: [...new Set([transaction.evidenceId, ...event.evidenceIds])],
    confidence: event.confidence,
    semantic: event.semantic,
  }
}

/**
 * Adapter boundary for an IDL-backed Meteora parser. The repository deliberately
 * does not guess current Anchor discriminators or account offsets here.
 */
export class MeteoraDlmmEventAdapter implements LiquidityInstructionDecoder {
  constructor(
    private readonly decodeEvents: (
      transaction: HistoricalPoolTransaction,
      poolAddress: string,
    ) => MeteoraDlmmDecodedEvent[],
  ) {}

  decode(transaction: HistoricalPoolTransaction, pool: { poolAddress: string }): LiquidityEventEvidence[] {
    return this.decodeEvents(transaction, pool.poolAddress)
      .map(event => normalizeMeteoraDlmmEvent(event, transaction, pool.poolAddress))
      .filter((event): event is LiquidityEventEvidence => event !== undefined)
  }
}

/** Pure semantic mapper used by tests and future IDL-backed parsers. */
export function meteoraDlmmKindToLiquidityKind(kind: MeteoraDlmmEventKind): LiquidityEventEvidence['kind'] {
  switch (kind) {
    case 'POOL_CREATE': return 'POOL_CREATE'
    case 'LIQUIDITY_ADD': return 'LIQUIDITY_ADD'
    case 'LIQUIDITY_REMOVE': return 'LIQUIDITY_REMOVE'
    case 'SWAP': return 'SWAP'
    case 'LP_MINT': return 'LP_MINT'
    case 'LP_BURN': return 'LP_BURN'
    case 'LP_TRANSFER': return 'LP_TRANSFER'
  }
}
