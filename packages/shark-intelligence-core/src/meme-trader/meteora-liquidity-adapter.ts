import type { LiquidityEventEvidence } from './liquidity-event-semantics'
import type { MeteoraDlmmLiquidityDelta } from './meteora-dlmm'

/**
 * Adapts verified DLMM snapshot deltas into SHARK's venue-neutral liquidity
 * evidence. Rebalances are intentionally suppressed from withdrawal semantics.
 */
export function meteoraDlmmLiquidityEvidence(
  delta: MeteoraDlmmLiquidityDelta,
): LiquidityEventEvidence[] {
  if (delta.kind === 'REBALANCE' || delta.kind === 'UNKNOWN') return []

  const amountRaw =
    (delta.tokenXDelta < 0n ? -delta.tokenXDelta : delta.tokenXDelta)
    + (delta.tokenYDelta < 0n ? -delta.tokenYDelta : delta.tokenYDelta)

  return [{
    eventId: `meteora-dlmm:${delta.position}:${delta.evidenceId}:${delta.kind}`,
    // Snapshot reconciliation may not have a transaction signature. Keep the
    // evidence ID as the immutable correlation key instead of inventing one.
    signature: delta.evidenceId,
    kind: delta.kind,
    observedAt: delta.observedAt,
    poolAddress: delta.poolAddress,
    actorId: delta.owner,
    amountRaw,
    source: 'meteora-dlmm-position-reconciliation',
    evidenceIds: [delta.evidenceId],
    confidence: 0.9,
    semantic: 'INFERRED',
  }]
}

export function isMeteoraDlmmWithdrawalEvidence(
  event: LiquidityEventEvidence,
): boolean {
  return event.kind === 'LIQUIDITY_REMOVE'
    && event.source === 'meteora-dlmm-position-reconciliation'
}
