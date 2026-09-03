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
const withinFiveMinutes = (a: string, b: string) => {
  const left = Date.parse(a)
  const right = Date.parse(b)
  return Number.isFinite(left) && Number.isFinite(right) && left >= right && left - right <= 5 * 60 * 1000
}

/**
 * Pure state reconstruction boundary. Raw Solana/Anchor layout knowledge stays
 * in the injected authoritative decoder; this layer owns lifecycle invariants
 * and converts only actual REMOVE transitions into downstream observations.
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
  const lastRebalance = new Map<string, string>()

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
    if (transition.action === 'REBALANCE') {
      lastRebalance.set(transition.positionAddress, transition.observedAt)
      continue
    }

    if (result.withdrawal) {
      const removedBps = result.withdrawal.removedBps ?? 0
      const xDelta = result.withdrawal.tokenXDeltas ?? 0n
      const yDelta = result.withdrawal.tokenYDeltas ?? 0n
      const oneSided = result.withdrawal.oneSided ?? ((xDelta === 0n) !== (yDelta === 0n))
      const rebalanceAt = lastRebalance.get(result.withdrawal.positionAddress)
      const positionClosed = result.state.lifecycle === 'CLOSED'
      const tokenMint = (result.withdrawal as DlmmPositionTransition & { tokenMint?: string }).tokenMint
      if (!tokenMint) {
        rejected.push({ eventId: transition.eventId, reason: 'MISSING_TOKEN_MINT' })
        continue
      }

      withdrawals.push({
        eventId: result.withdrawal.eventId,
        signature: result.withdrawal.signature,
        poolAddress: result.withdrawal.poolAddress,
        tokenMint,
        observedAt: result.withdrawal.observedAt,
        positionAddress: result.withdrawal.positionAddress,
        ownerId: result.state.owner,
        operatorId: result.state.operator,
        removedBps,
        oneSided,
        positionClosed,
        rebalanceBeforeWithdrawal: !!rebalanceAt && withinFiveMinutes(result.withdrawal.observedAt, rebalanceAt),
        evidenceIds: [...new Set([...result.withdrawal.evidenceIds, ...result.state.evidenceIds])],
        confidence: result.withdrawal.confidence,
      })
    }
  }

  return { positions: [...states.values()], withdrawals, rejected }
}
