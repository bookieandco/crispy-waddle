import type { HistoricalPoolTransaction } from './solana-pool-history'
import type { DlmmWithdrawalObservation } from './meteora-liquidity-control-signals'
import { applyDlmmPositionTransition, type DlmmPositionState, type DlmmPositionTransition } from './meteora-dlmm-position-state'

export interface MeteoraDlmmPositionEventDecoder {
  decode(transaction: HistoricalPoolTransaction): DlmmPositionTransition[]
}

export type DlmmReconstructionResult = {
  positions: DlmmPositionState[]
  withdrawals: DlmmWithdrawalObservation[]
  rejected: Array<{ eventId: string; reason: string }>
}

const transitionKey = (t: DlmmPositionTransition) => `${t.signature}:${t.eventId}`

/**
 * Pure state reconstruction boundary. The decoder is deliberately injected:
 * raw Solana/Anchor layout knowledge belongs in the authoritative decoder,
 * while this reducer owns lifecycle invariants and downstream semantics.
 */
export function reconstructMeteoraDlmmPositions(input: {
  transactions: HistoricalPoolTransaction[]
  decoder: MeteoraDlmmPositionEventDecoder
  poolAddress?: string
}): DlmmReconstructionResult {
  const states = new Map<string, DlmmPositionState>()
  const seen = new Set<string>()
  const withdrawals: DlmmWithdrawalObservation[] = []
  const rejected: Array<{ eventId: string; reason: string }> = []

  const transitions = input.transactions
    .flatMap(tx => input.decoder.decode(tx))
    .filter(t => !input.poolAddress || t.poolAddress === input.poolAddress)
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))

  for (const transition of transitions) {
    const key = transitionKey(transition)
    if (seen.has(key)) continue
    seen.add(key)

    const current = states.get(transition.positionAddress)
    const result = applyDlmmPositionTransition(current, transition)
    if (result.rejected) {
      rejected.push({ eventId: transition.eventId, reason: result.rejected })
      continue
    }
    if (!result.state) {
      rejected.push({ eventId: transition.eventId, reason: 'NO_STATE' })
      continue
    }

    states.set(transition.positionAddress, result.state)

    if (result.withdrawal) {
      const before = current
      const removedBps = result.withdrawal.removedBps ?? 0
      const oneSided = result.withdrawal.oneSided ??
        ((result.withdrawal.tokenXDeltas ?? 0n) === 0n) !== ((result.withdrawal.tokenYDeltas ?? 0n) === 0n)
      const positionClosed = result.state.lifecycle === 'CLOSED'
      const priorEvidence = before?.evidenceIds ?? []
      withdrawals.push({
        eventId: result.withdrawal.eventId,
        signature: result.withdrawal.signature,
        poolAddress: result.withdrawal.poolAddress,
        // The authoritative decoder must supply tokenMint through the pool transaction
        // envelope in a later adapter; use the pool address only as an explicit sentinel.
        tokenMint: '',
        observedAt: result.withdrawal.observedAt,
        positionAddress: result.withdrawal.positionAddress,
        ownerId: result.state.owner,
        operatorId: result.state.operator,
        removedBps,
        oneSided,
        positionClosed,
        rebalanceBeforeWithdrawal: priorEvidence.length > 0 &&
          result.state.evidenceIds.some(id => priorEvidence.includes(id)),
        evidenceIds: [...new Set([...result.withdrawal.evidenceIds, ...result.state.evidenceIds])],
        confidence: result.withdrawal.confidence,
      })
    }
  }

  return { positions: [...states.values()], withdrawals, rejected }
}
