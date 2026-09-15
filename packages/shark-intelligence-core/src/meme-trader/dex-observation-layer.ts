import type { HistoricalPoolTransaction, PoolHistory } from './solana-pool-history'
import { classifySemanticLiquidityEvent, type LiquidityEventEvidence, type LiquidityInstructionDecoder } from './liquidity-event-semantics'

export type DexObservationProgram = {
  programId: string
  venue: string
  decoder: LiquidityInstructionDecoder
}

export type CanonicalDexObservation = {
  observationId: string
  signature: string
  observedAt: string
  poolAddress: string
  programId: string
  venue: string
  event: LiquidityEventEvidence
  evidenceIds: string[]
  provenance: {
    source: string
    transactionSignature: string
  }
}

export type DexObservationRejection = {
  signature: string
  poolAddress: string
  reason: 'MISSING_PROGRAM' | 'UNSUPPORTED_PROGRAM' | 'DECODER_ERROR'
  programId?: string
}

export type DexObservationResult = {
  observations: CanonicalDexObservation[]
  rejections: DexObservationRejection[]
}

type RawInstruction = {
  programId?: unknown
  programIdIndex?: unknown
}

type AccountKey = string | { pubkey?: string }

function accountKeys(raw: Record<string, unknown>): AccountKey[] {
  const tx = raw.transaction && typeof raw.transaction === 'object' ? raw.transaction as Record<string, unknown> : raw
  const message = tx.message && typeof tx.message === 'object' ? tx.message as Record<string, unknown> : undefined
  const keys = message?.accountKeys ?? tx.accountKeys ?? raw.accountKeys
  return Array.isArray(keys)
    ? keys.filter((key): key is AccountKey => typeof key === 'string' || !!key && typeof key === 'object')
    : []
}

function keyAt(keys: AccountKey[], index: number): string | undefined {
  const key = keys[index]
  return typeof key === 'string' ? key : key?.pubkey
}

function outerInstructions(raw: Record<string, unknown>): RawInstruction[] {
  const tx = raw.transaction && typeof raw.transaction === 'object' ? raw.transaction as Record<string, unknown> : raw
  const message = tx.message && typeof tx.message === 'object' ? tx.message as Record<string, unknown> : undefined
  return Array.isArray(message?.instructions) ? message.instructions as RawInstruction[] : []
}

function referencedProgramIds(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return []
  const row = raw as Record<string, unknown>
  const keys = accountKeys(row)
  const ids = outerInstructions(row).flatMap(ix => {
    if (typeof ix.programId === 'string') return [ix.programId]
    if (typeof ix.programIdIndex === 'number' && Number.isInteger(ix.programIdIndex)) {
      const id = keyAt(keys, ix.programIdIndex)
      return id ? [id] : []
    }
    return []
  })
  return [...new Set(ids)]
}

function observationId(signature: string, event: LiquidityEventEvidence): string {
  return `dex:${signature}:${event.eventId}`
}

/**
 * Canonical boundary between raw Solana transaction history and SHARK's
 * historical liquidity evidence. Protocol decoders are explicit adapters;
 * unknown programs fail closed instead of being heuristically interpreted.
 */
export class DexObservationLayer {
  private readonly programsById: ReadonlyMap<string, DexObservationProgram>

  constructor(programs: readonly DexObservationProgram[]) {
    this.programsById = new Map(programs.map(program => [program.programId, program]))
  }

  observe(history: PoolHistory): DexObservationResult {
    const observations: CanonicalDexObservation[] = []
    const rejections: DexObservationRejection[] = []

    for (const transaction of history.transactions) {
      const programIds = referencedProgramIds(transaction.raw)
      if (!programIds.length) {
        rejections.push({ signature: transaction.signature, poolAddress: history.pool.poolAddress, reason: 'MISSING_PROGRAM' })
        continue
      }

      let decoded = false
      for (const programId of programIds) {
        const adapter = this.programsById.get(programId)
        if (!adapter) continue
        decoded = true
        try {
          const events = classifySemanticLiquidityEvent({ transaction, pool: history.pool, decoder: adapter.decoder })
          for (const event of events) {
            observations.push({
              observationId: observationId(transaction.signature, event),
              signature: transaction.signature,
              observedAt: event.observedAt,
              poolAddress: event.poolAddress,
              programId,
              venue: adapter.venue,
              event,
              evidenceIds: [...new Set([transaction.evidenceId, ...event.evidenceIds])],
              provenance: {
                source: event.source,
                transactionSignature: transaction.signature,
              },
            })
          }
        } catch {
          rejections.push({
            signature: transaction.signature,
            poolAddress: history.pool.poolAddress,
            reason: 'DECODER_ERROR',
            programId,
          })
        }
      }

      if (!decoded) {
        rejections.push({
          signature: transaction.signature,
          poolAddress: history.pool.poolAddress,
          reason: 'UNSUPPORTED_PROGRAM',
          programId: programIds[0],
        })
      }
    }

    return {
      observations: observations.sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)),
      rejections,
    }
  }
}
